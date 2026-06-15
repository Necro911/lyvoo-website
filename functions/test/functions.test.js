// Testes das Cloud Functions — correm contra os emuladores firestore+auth via
// `firebase emulators:exec --only firestore,auth`. Cobrem o webhook Stripe
// (assinatura + avanço de estado + idempotência) e a cascata de eliminação RGPD.
//
// Os secrets do webhook são lidos por defineSecret('X').value() em runtime, que
// fora da cloud lê process.env.X — definimos antes de carregar o index.
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';

const test = require('node:test');
const assert = require('node:assert');

const admin = require('firebase-admin');
const Stripe = require('stripe');
const fft = require('firebase-functions-test')();
const fns = require('./../index.js'); // inicializa o admin contra os emuladores

const db = admin.firestore();
const auth = admin.auth();
const stripe = new Stripe('sk_test_dummy');

// ── helpers ────────────────────────────────────────────────────────────────
function mockRes() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.send = (b) => { r.body = b; return r; };
  return r;
}
function webhookReq(eventObj) {
  const payload = JSON.stringify(eventObj);
  const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_secret' });
  return { rawBody: Buffer.from(payload), headers: { 'stripe-signature': sig } };
}
const checkoutEvent = (uid, sessionId = 'cs_1', id = 'evt_1') => ({
  id, type: 'checkout.session.completed',
  data: { object: { id: sessionId, client_reference_id: uid } },
});

test.after(() => fft.cleanup());

// ── Webhook Stripe ──────────────────────────────────────────────────────────
test('webhook: checkout válido avança estado 1 → 2', async () => {
  const uid = 'wh_ok_' + Date.now();
  await db.collection('users').doc(uid).set({ estado: 1, email: 'a@x.pt' });
  const res = mockRes();
  await fns.stripeWebhook(webhookReq(checkoutEvent(uid)), res);
  assert.strictEqual(res.statusCode, 200);
  const snap = await db.collection('users').doc(uid).get();
  assert.strictEqual(snap.data().estado, 2);
  assert.strictEqual(snap.data().estadoLabel, 'Kit a caminho');
});

test('webhook: idempotente — segundo evento não re-avança o estado', async () => {
  const uid = 'wh_idem_' + Date.now();
  await db.collection('users').doc(uid).set({ estado: 1 });
  await fns.stripeWebhook(webhookReq(checkoutEvent(uid)), mockRes());
  const res2 = mockRes();
  await fns.stripeWebhook(webhookReq(checkoutEvent(uid, 'cs_2', 'evt_2')), res2);
  assert.strictEqual(res2.statusCode, 200);
  const snap = await db.collection('users').doc(uid).get();
  assert.strictEqual(snap.data().estado, 2); // continua 2, não avança para 3
});

test('webhook: assinatura inválida → 400', async () => {
  const res = mockRes();
  await fns.stripeWebhook({ rawBody: Buffer.from('{}'), headers: { 'stripe-signature': 'bad' } }, res);
  assert.strictEqual(res.statusCode, 400);
});

// ── eliminarUtilizadorRGPD ───────────────────────────────────────────────────
test('RGPD: admin elimina em cascata (perfil/subcoleções/chat/marcações/Auth) + auditoria', async () => {
  const uid = 'rgpd_' + Date.now();
  await auth.createUser({ uid });
  await db.collection('users').doc(uid).set({ estado: 1, email: 'v@x.pt' });
  await db.collection('users').doc(uid).collection('analises').doc('a1').set({ x: 1 });
  await db.collection('chats').doc(uid).set({ uid });
  await db.collection('chats').doc(uid).collection('mensagens').doc('m1').set({ texto: 'oi' });
  await db.collection('agendamentosNutri').doc(uid + '_ag').set({ uid, data: '2099-01-01', hora: '09:00' });

  const wrapped = fft.wrap(fns.eliminarUtilizadorRGPD);
  const out = await wrapped({ data: { uid }, auth: { uid: 'admin1', token: { admin: true } } });
  assert.strictEqual(out.ok, true);

  assert.strictEqual((await db.collection('users').doc(uid).get()).exists, false);
  assert.strictEqual((await db.collection('users').doc(uid).collection('analises').get()).size, 0);
  assert.strictEqual((await db.collection('chats').doc(uid).get()).exists, false);
  assert.strictEqual((await db.collection('agendamentosNutri').where('uid', '==', uid).get()).size, 0);
  assert.strictEqual((await db.collection('eliminacoesRGPD').doc(uid).get()).exists, true);
  await assert.rejects(auth.getUser(uid)); // conta Auth apagada
});

test('RGPD: não-admin é rejeitado', async () => {
  const wrapped = fft.wrap(fns.eliminarUtilizadorRGPD);
  await assert.rejects(wrapped({ data: { uid: 'qualquer' }, auth: { uid: 'u', token: {} } }));
});

test('RGPD: recusa eliminar uma conta de admin', async () => {
  const uid = 'rgpd_admin_' + Date.now();
  await auth.createUser({ uid });
  await auth.setCustomUserClaims(uid, { admin: true });
  const wrapped = fft.wrap(fns.eliminarUtilizadorRGPD);
  await assert.rejects(wrapped({ data: { uid }, auth: { uid: 'admin1', token: { admin: true } } }));
  assert.ok(await auth.getUser(uid)); // a conta NÃO foi apagada
});
