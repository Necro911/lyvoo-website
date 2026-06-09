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

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ── Emails dos administradores ───────────────────────────────────────────────
const ADMIN_EMAILS = [
  'ricardo.lyvoo@gmail.com',
  'hello@lyvoo.pt',
];

async function setAdminClaims() {
  for (const email of ADMIN_EMAILS) {
    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, { admin: true });
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
