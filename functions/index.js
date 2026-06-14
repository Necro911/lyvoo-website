const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY     = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Webhook do Stripe: confirma a compra do Plano Base e avança o cliente
// do estado 1 (sem plano) para o estado 2 (kit a caminho).
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], region: 'europe-west1' },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      console.error('Assinatura do webhook inválida:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.client_reference_id;

      if (!uid) {
        console.warn('checkout.session.completed sem client_reference_id', session.id);
        res.status(200).send('ok (sem uid)');
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
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
          });
          return 'avancado';
        });

        if (resultado === 'inexistente') {
          console.warn('Utilizador não encontrado para uid', uid);
          res.status(200).send('ok (utilizador inexistente)');
          return;
        }
        if (resultado === 'avancado') {
          console.log(`Estado do utilizador ${uid} avançado para 2 (kit a caminho)`);
        } else {
          console.log(`Utilizador ${uid} já tinha plano ativo, ignorado`);
        }

        res.status(200).send('ok');
      } catch (err) {
        console.error('Erro ao atualizar utilizador', uid, err);
        res.status(500).send('Erro interno');
      }
      return;
    }

    // Outros eventos: apenas confirmar receção.
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
    const after  = event.data && event.data.after.exists  ? event.data.after.data()  : null;

    // Recalcular as datas afetadas (antes e depois — cobre criação, alteração de
    // data, cancelamento e eliminação).
    const datas = new Set();
    if (before && before.data) datas.add(before.data);
    if (after  && after.data)  datas.add(after.data);

    for (const data of datas) {
      const snap = await db.collection('agendamentosNutri').where('data', '==', data).get();
      const horas = [...new Set(
        snap.docs
          .map((d) => d.data())
          .filter((a) => a.estado !== 'cancelada')
          .map((a) => a.hora)
          .filter(Boolean)
      )];
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
// Chamável só por admin (claim ou email da equipa). Correr UMA vez após o deploy
// se já existirem marcações: no browser, autenticado como admin →
//   const fn = httpsCallable(getFunctions(app,'europe-west1'),'backfillBusySlots'); await fn();
exports.backfillBusySlots = require('firebase-functions/v2/https').onCall(
  { region: 'europe-west1' },
  async (request) => {
    const token = request.auth && request.auth.token;
    const isAdmin = token && (token.admin === true ||
      ['ricardo.lyvoo@gmail.com', 'hello@lyvoo.pt'].includes(token.email));
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
