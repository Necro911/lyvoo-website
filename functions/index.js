const { onRequest } = require('firebase-functions/v2/https');
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
        const snap = await userRef.get();

        if (!snap.exists) {
          console.warn('Utilizador não encontrado para uid', uid);
          res.status(200).send('ok (utilizador inexistente)');
          return;
        }

        const estadoAtual = snap.data().estado || 1;

        // Só avança quem ainda não comprou o plano base.
        // Evita reabrir/repetir o ciclo se o pagamento for re-processado.
        if (estadoAtual <= 1) {
          const validoAte = new Date();
          validoAte.setFullYear(validoAte.getFullYear() + 1);
          await userRef.update({
            estado: 2,
            estadoLabel: 'Kit a caminho',
            stripeSessionId: session.id,
            cicloAtual: 1,
            planoValidoAte: validoAte.toISOString(),
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Estado do utilizador ${uid} avançado para 2 (kit a caminho)`);
        } else {
          console.log(`Utilizador ${uid} já em estado ${estadoAtual}, ignorado`);
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
