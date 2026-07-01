// Testes das Firestore Security Rules (correm contra o emulador via
// `firebase emulators:exec`). Trancam o modelo de segurança construído na
// auditoria — se um futuro edit às regras reabrir um buraco, isto fica vermelho.
//
// Correr: npm run test:rules  (precisa de JDK 21+ para o emulador)
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, setLogLevel } from 'firebase/firestore';

setLogLevel('error');
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-lyvoo',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const admin = () => env.authenticatedContext('admin1', { admin: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

// ── users: criação ────────────────────────────────────────────────────────
test('users: owner cria o seu doc em estado 1', async () => {
  await assertSucceeds(
    setDoc(doc(alice(), 'users/alice'), { estado: 1, email: 'a@x.pt', firstName: 'A' })
  );
});
test('users: owner NÃO cria em estado != 1', async () => {
  await assertFails(setDoc(doc(alice(), 'users/alice'), { estado: 2, email: 'a@x.pt' }));
});
test('users: owner NÃO cria com stripeSessionId/clienteId', async () => {
  await assertFails(setDoc(doc(alice(), 'users/alice'), { estado: 1, stripeSessionId: 'x' }));
  await assertFails(setDoc(doc(alice(), 'users/alice'), { estado: 1, clienteId: 'C0001' }));
});
test('users: não-owner NÃO cria o doc de outro', async () => {
  await assertFails(setDoc(doc(bob(), 'users/alice'), { estado: 1 }));
});

// ── users: field-lock (CRÍTICO — anti auto-escalação de pagamento) ─────────
test('users: owner NÃO auto-escala estado (field-lock)', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice'), { estado: 1, email: 'a@x.pt' }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { estado: 4 }));
});
test('users: owner NÃO altera plano/stripeSessionId/clienteId/arquivado', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice'), { estado: 1, clienteId: 'C0001' }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { plano: 'premium' }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { stripeSessionId: 'x' }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { clienteId: 'C9999' }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { arquivado: true }));
});
test('users: owner NÃO escreve prioridades (field-lock, DA-05)', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice'), { estado: 1 }));
  await assertFails(
    updateDoc(doc(alice(), 'users/alice'), { prioridades: [{ texto: 'x' }] })
  );
});
test('users: owner PODE editar campos de perfil', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice'), { estado: 1, email: 'a@x.pt' }));
  await assertSucceeds(
    updateDoc(doc(alice(), 'users/alice'), { firstName: 'Alice', phone: '912345678' })
  );
});
test('users: admin PODE alterar estado', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice'), { estado: 1 }));
  await assertSucceeds(
    updateDoc(doc(admin(), 'users/alice'), { estado: 4, estadoLabel: 'Resultados' })
  );
});

// ── D4: validação de tipos/tamanhos do perfil ─────────────────────────────
test('users: owner NÃO põe firstName gigante (>100)', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice'), { estado: 1 }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { firstName: 'x'.repeat(500) }));
});
test('users: owner NÃO põe firstName com tipo errado', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice'), { estado: 1 }));
  await assertFails(updateDoc(doc(alice(), 'users/alice'), { firstName: 12345 }));
});

// ── isolamento de leitura ─────────────────────────────────────────────────
test('users: owner lê o seu doc; outro utilizador não', async () => {
  await seed((db) => setDoc(doc(db, 'users/alice'), { estado: 1 }));
  await assertSucceeds(getDoc(doc(alice(), 'users/alice')));
  await assertFails(getDoc(doc(bob(), 'users/alice')));
});

// ── agendamentosNutri (PII) ───────────────────────────────────────────────
test('agendamentosNutri: só o dono e o admin leem', async () => {
  await seed((db) =>
    setDoc(doc(db, 'agendamentosNutri/ag1'), { uid: 'alice', nome: 'A', email: 'a@x.pt' })
  );
  await assertSucceeds(getDoc(doc(alice(), 'agendamentosNutri/ag1')));
  await assertFails(getDoc(doc(bob(), 'agendamentosNutri/ag1')));
  await assertSucceeds(getDoc(doc(admin(), 'agendamentosNutri/ag1')));
});

// ── busySlots (espelho sem PII) ───────────────────────────────────────────
test('busySlots: autenticado lê, cliente NÃO escreve', async () => {
  await seed((db) =>
    setDoc(doc(db, 'busySlots/2026-06-20'), { data: '2026-06-20', horas: ['09:00'] })
  );
  await assertSucceeds(getDoc(doc(alice(), 'busySlots/2026-06-20')));
  await assertFails(
    setDoc(doc(alice(), 'busySlots/2026-06-21'), { data: '2026-06-21', horas: [] })
  );
});

// ── waitlist (form público validado) ──────────────────────────────────────
test('waitlist: criação válida passa; inválida falha', async () => {
  await assertSucceeds(
    setDoc(doc(anon(), 'waitlist/e1'), { email: 'a@x.pt', criadoEm: new Date() })
  );
  await assertFails(setDoc(doc(anon(), 'waitlist/e2'), { criadoEm: new Date() })); // sem email
  await assertFails(
    setDoc(doc(anon(), 'waitlist/e3'), {
      email: 'a@x.pt',
      criadoEm: new Date(),
      mensagem: 'x'.repeat(2001),
    })
  );
});
test('waitlist: leitura só admin', async () => {
  await seed((db) => setDoc(doc(db, 'waitlist/e1'), { email: 'a@x.pt', criadoEm: new Date() }));
  await assertFails(getDoc(doc(alice(), 'waitlist/e1')));
  await assertSucceeds(getDoc(doc(admin(), 'waitlist/e1')));
});

// ── coleções internas: cliente sem acesso, admin lê, ninguém escreve do cliente
test('counters/webhookErrors/eliminacoesRGPD: cliente sem acesso, admin lê', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'counters/users'), { seq: 5 });
    await setDoc(doc(db, 'webhookErrors/w1'), { tipo: 'x' });
    await setDoc(doc(db, 'eliminacoesRGPD/u1'), { uid: 'u1' });
  });
  await assertFails(getDoc(doc(alice(), 'counters/users')));
  await assertFails(setDoc(doc(alice(), 'webhookErrors/w2'), { tipo: 'y' }));
  await assertFails(setDoc(doc(alice(), 'eliminacoesRGPD/u2'), { uid: 'u2' }));
  await assertSucceeds(getDoc(doc(admin(), 'counters/users')));
  await assertSucceeds(getDoc(doc(admin(), 'webhookErrors/w1')));
  await assertSucceeds(getDoc(doc(admin(), 'eliminacoesRGPD/u1')));
});
