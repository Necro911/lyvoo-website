/**
 * set-admin-claims.js
 * Corre uma vez para definir custom claim { admin: true } nos admins da Lyvoo.
 *
 * Pré-requisitos:
 *   npm install firebase-admin
 *
 * Uso:
 *   node set-admin-claims.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

// ── Emails dos administradores ───────────────────────────────────────────────
const ADMIN_EMAILS = [
  'ricardo.lyvoo@gmail.com',
  'hello@lyvoo.pt',
];

async function setAdminClaims() {
  for (const email of ADMIN_EMAILS) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { admin: true });
      console.log(`✓ admin claim definida para ${email} (uid: ${user.uid})`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.warn(`⚠ Utilizador não encontrado: ${email}`);
      } else {
        console.error(`✗ Erro em ${email}:`, err.message);
      }
    }
  }
  console.log('\nFeito. Os utilizadores têm de fazer logout/login para o token ser renovado.');
  process.exit(0);
}

setAdminClaims();
