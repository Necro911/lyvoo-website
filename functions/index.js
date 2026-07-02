const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Regista uma falha crítica do webhook Stripe: log estruturado em severidade
// ERROR com o marcador { alert: 'stripe-webhook' } (para um alerta baseado em
// logs no Cloud Monitoring) E um registo durável em webhookErrors/ para
// reconciliação manual (ex.: alguém pagou mas não conseguimos processar). (B3)
async function registarErroWebhook(tipo, dados) {
  logger.error(`[stripe-webhook] ${tipo}`, { alert: 'stripe-webhook', tipo, ...dados });
  try {
    await db.collection('webhookErrors').add({
      tipo,
      ...dados,
      resolvido: false,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    logger.error('[stripe-webhook] falha ao gravar webhookErrors', { erro: e.message });
  }
}

// Webhook do Stripe: confirma a compra do Plano Base e avança o cliente
// do estado 1 (sem plano) para o estado 2 (kit a caminho).
// (B4) região já é europe-west1 (perto de utilizador e Stripe EU);
// minInstances NÃO definido pré-lançamento (custo recorrente) — Stripe re-tenta
// entregas, por isso um cold-start ocasional é inofensivo.
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], region: 'europe-west1' },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      // Assinatura inválida: pode ser ruído de scanners OU um webhook secret mal
      // configurado (que faria FALHAR todos os pagamentos reais). Log em ERROR
      // com marcador para o alerta apanhar um pico — sem gravar em webhookErrors
      // (evita encher a coleção com tentativas aleatórias).
      logger.error('[stripe-webhook] assinatura inválida', {
        alert: 'stripe-webhook',
        motivo: err.message,
      });
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.client_reference_id;

      if (!uid) {
        // Pagamento concluído sem referência ao utilizador → não conseguimos
        // atribuir. Crítico: alguém pagou e não sabemos quem.
        await registarErroWebhook('checkout_sem_uid', {
          sessionId: session.id,
          eventId: event.id,
          mensagem: 'checkout.session.completed sem client_reference_id',
        });
        res.status(200).send('ok (sem uid)');
        return;
      }

      // Só avançamos quando o pagamento está efetivamente liquidado. Para métodos
      // de pagamento assíncronos/atrasados o Stripe emite checkout.session.completed
      // com payment_status != 'paid' (seguido de async_payment_succeeded); avançar
      // aqui entregaria o kit sem a cobrança estar confirmada. (auditoria 2026-07-01, L4)
      if (session.payment_status !== 'paid') {
        logger.info('[stripe-webhook] checkout ainda não pago — ignorado', {
          uid,
          sessionId: session.id,
          eventId: event.id,
          payment_status: session.payment_status || null,
        });
        res.status(200).send('ok (nao pago)');
        return;
      }

      try {
        const userRef = db.collection('users').doc(uid);

        // Transação: read-check-write atómico. Evita que eventos concorrentes ou
        // reenviados pelo Stripe processem o mesmo pagamento duas vezes. (Fix 4)
        const resultado = await db.runTransaction(async (tx) => {
          const snap = await tx.get(userRef);
          if (!snap.exists) return 'inexistente';

          const estadoAtual = snap.data().estado || 1;
          // Só avança quem ainda não comprou o plano base.
          if (estadoAtual > 1) return 'ignorado';

          const validoAte = new Date();
          validoAte.setFullYear(validoAte.getFullYear() + 1);
          tx.update(userRef, {
            estado: 2,
            estadoLabel: 'Kit a caminho',
            stripeSessionId: session.id,
            cicloAtual: 1,
            planoValidoAte: validoAte.toISOString(),
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });
          return 'avancado';
        });

        if (resultado === 'inexistente') {
          // Pagou, mas o uid não tem documento em users → crítico (conta paga
          // sem perfil). Regista para reconciliação manual.
          await registarErroWebhook('utilizador_inexistente', {
            uid,
            sessionId: session.id,
            eventId: event.id,
            mensagem: 'Pagamento recebido para um uid sem documento em users',
          });
          res.status(200).send('ok (utilizador inexistente)');
          return;
        }
        if (resultado === 'avancado') {
          logger.info('[stripe-webhook] utilizador avançado para estado 2 (kit a caminho)', {
            uid,
            sessionId: session.id,
            eventId: event.id,
          });
        } else {
          logger.info('[stripe-webhook] ignorado — utilizador já tinha plano ativo', {
            uid,
            sessionId: session.id,
            eventId: event.id,
          });
        }

        res.status(200).send('ok');
      } catch (err) {
        // Erro a processar um pagamento válido → crítico. Devolve 500 para o
        // Stripe RE-TENTAR o evento, e regista para reconciliação manual.
        await registarErroWebhook('erro_processamento', {
          uid,
          sessionId: session.id,
          eventId: event.id,
          mensagem: err.message,
        });
        res.status(500).send('Erro interno');
      }
      return;
    }

    // Outros eventos: apenas confirmar receção.
    logger.info('[stripe-webhook] evento ignorado', { tipo: event.type, eventId: event.id });
    res.status(200).send('ok (evento ignorado)');
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// busySlots — espelho SEM PII da ocupação de agendamentosNutri. (Fix 3)
//
// agendamentosNutri contém PII (nome, email, link de videochamada), por isso
// deixou de ser legível por qualquer cliente. O calendário de marcação precisa
// apenas de saber QUE horas estão ocupadas por dia — este trigger mantém
// busySlots/{data} = { data, horas:[...] } (só horas), que é o único que o
// cliente lê. Escrito via Admin SDK, logo ignora as regras de segurança.
// ─────────────────────────────────────────────────────────────────────────────
exports.syncBusySlots = onDocumentWritten(
  { document: 'agendamentosNutri/{agId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after.exists ? event.data.after.data() : null;

    // Recalcular as datas afetadas (antes e depois — cobre criação, alteração de
    // data, cancelamento e eliminação).
    const datas = new Set();
    if (before && before.data) datas.add(before.data);
    if (after && after.data) datas.add(after.data);

    for (const data of datas) {
      const snap = await db.collection('agendamentosNutri').where('data', '==', data).get();
      const horas = [
        ...new Set(
          snap.docs
            .map((d) => d.data())
            .filter((a) => a.estado !== 'cancelada')
            .map((a) => a.hora)
            .filter(Boolean)
        ),
      ];
      const ref = db.collection('busySlots').doc(data);
      if (horas.length) {
        await ref.set({ data, horas });
      } else {
        await ref.delete().catch(() => {});
      }
    }
  }
);

// Backfill único da coleção busySlots a partir dos agendamentos existentes.
// Chamável só por admin (custom claim { admin:true }). Correr UMA vez após o deploy
// se já existirem marcações: no browser, autenticado como admin →
//   const fn = httpsCallable(getFunctions(app,'europe-west1'),'backfillBusySlots'); await fn();
exports.backfillBusySlots = require('firebase-functions/v2/https').onCall(
  { region: 'europe-west1' },
  async (request) => {
    const token = request.auth && request.auth.token;
    const isAdmin = token && token.admin === true;
    if (!isAdmin) throw new Error('unauthorized');

    const snap = await db.collection('agendamentosNutri').get();
    const porData = {};
    snap.docs.forEach((d) => {
      const a = d.data();
      if (!a.data || !a.hora || a.estado === 'cancelada') return;
      (porData[a.data] = porData[a.data] || new Set()).add(a.hora);
    });
    const batch = db.batch();
    Object.entries(porData).forEach(([data, set]) => {
      batch.set(db.collection('busySlots').doc(data), { data, horas: [...set] });
    });
    await batch.commit();
    return { datas: Object.keys(porData).length };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// assignClienteId — atribui um clienteId sequencial e PERSISTENTE a cada novo
// utilizador (C0001, C0002, …), via um contador atómico em counters/users. (P1)
//
// Antes, o admin numerava os clientes no browser carregando TODA a coleção e
// ordenando por antiguidade — o que obrigava a ler todos os docs em cada abertura.
// Agora o número é gravado uma vez no doc, no momento da criação, e o admin pode
// paginar a lista sem perder a numeração. Também garante arquivado:false para que
// as queries de contagem das stats (where arquivado==false) incluam o doc.
// ─────────────────────────────────────────────────────────────────────────────
exports.assignClienteId = onDocumentCreated(
  { document: 'users/{uid}', region: 'europe-west1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};
    if (data.clienteId) return; // idempotente — já atribuído

    const counterRef = db.doc('counters/users');
    const seq = await db.runTransaction(async (tx) => {
      const c = await tx.get(counterRef);
      const next = ((c.exists && c.data().seq) || 0) + 1;
      tx.set(counterRef, { seq: next }, { merge: true });
      return next;
    });

    await snap.ref.set(
      {
        clienteId: 'C' + String(seq).padStart(4, '0'),
        seq,
        arquivado: data.arquivado === true,
      },
      { merge: true }
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// eliminarUtilizadorRGPD — direito ao apagamento (RGPD art. 17). (D5)
//
// Chamável SÓ por admin. Apaga em cascata os dados do utilizador: perfil
// (users/{uid} + subcoleção analises), chat (chats/{uid} + mensagens), marcações
// (agendamentosNutri do uid — cada delete dispara syncBusySlots, que limpa
// busySlots) e a conta de Auth. Deixa um registo SEM PII em eliminacoesRGPD/{uid}
// para demonstrar conformidade. NÃO toca em registos financeiros (Stripe), que
// têm de ser retidos por obrigação legal.
// ─────────────────────────────────────────────────────────────────────────────
exports.eliminarUtilizadorRGPD = onCall({ region: 'europe-west1' }, async (request) => {
  const token = request.auth && request.auth.token;
  if (!token || token.admin !== true) {
    throw new HttpsError('permission-denied', 'Apenas administradores.');
  }
  const uid = request.data && request.data.uid;
  if (!uid || typeof uid !== 'string') {
    throw new HttpsError('invalid-argument', 'uid em falta.');
  }

  // Salvaguarda: nunca eliminar uma conta de administrador.
  try {
    const alvo = await admin.auth().getUser(uid);
    if (alvo.customClaims && alvo.customClaims.admin === true) {
      throw new HttpsError(
        'failed-precondition',
        'Não é possível eliminar uma conta de administrador.'
      );
    }
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    // A conta Auth pode já não existir — seguir para limpar o Firestore.
  }

  // 1. Marcações do utilizador (cada delete dispara syncBusySlots → busySlots)
  const ags = await db.collection('agendamentosNutri').where('uid', '==', uid).get();
  for (const d of ags.docs) await d.ref.delete();

  // 2. Chat + mensagens, e 3. perfil + subcoleção análises (recursivo)
  await db.recursiveDelete(db.collection('chats').doc(uid));
  await db.recursiveDelete(db.collection('users').doc(uid));

  // 4. Registo de auditoria (sem PII) — prova de conformidade RGPD
  await db
    .collection('eliminacoesRGPD')
    .doc(uid)
    .set({
      uid,
      eliminadoEm: admin.firestore.FieldValue.serverTimestamp(),
      porAdmin: token.email || token.uid || 'admin',
      agendamentosApagados: ags.size,
    });

  // 5. Conta de Auth (por fim)
  let authApagada = false;
  try {
    await admin.auth().deleteUser(uid);
    authApagada = true;
  } catch (e) {
    logger.warn('[rgpd] conta Auth inexistente ao eliminar', { uid, erro: e.message });
  }

  logger.info('[rgpd] utilizador eliminado', { uid, agendamentos: ags.size, authApagada });
  return { ok: true, agendamentos: ags.size, authApagada };
});
