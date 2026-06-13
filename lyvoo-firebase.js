// Configuração Firebase partilhada - Lyvoo
// Importado por registar.html, login.html, dashboard.html, admin.html, contacto.html
import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }                from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore }           from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
// App Check desativado temporariamente — ver nota mais abaixo.
// import { initializeAppCheck, ReCaptchaV3Provider }
//                                   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';

const firebaseConfig = {
  apiKey:            "AIzaSyDdz33PHjwC5vDqSMh9ts1H7Q1tuJG6H38",
  authDomain:        "lyvoo-9d54b.firebaseapp.com",
  projectId:         "lyvoo-9d54b",
  storageBucket:     "lyvoo-9d54b.firebasestorage.app",
  messagingSenderId: "623275965506",
  appId:             "1:623275965506:web:f5000cce99b664114381db",
  measurementId:     "G-0P69XJ0XY6"
};

const app = initializeApp(firebaseConfig);

// ── App Check (reCAPTCHA v3) — DESATIVADO TEMPORARIAMENTE ─────────────────────
// O App Check nunca chegou a ser ativado no backend (Firebase Console → App Check
// continua em "Get started"). Entretanto a chave reCAPTCHA foi migrada para a
// gestão "Enterprise" no Cloud Console, o que partiu a validação do token v3:
// o cliente enviava tokens que o Identity Toolkit passou a rejeitar com
// `auth/firebase-app-check-token-is-invalid`, bloqueando TODO o login (email e
// Google). Como o backend não exige App Check, a solução correta é deixar de
// enviar o token partido — o site funciona normalmente sem ele.
//
// PARA REATIVAR (quando o App Check estiver bem configurado):
//   1. Firebase Console → App Check → ativar a API e registar a app web com o
//      provider reCAPTCHA (v3 OU Enterprise — tem de bater certo com o código).
//   2. Registar o debug token para localhost em App Check → Apps → ⋮ → Manage
//      debug tokens (o anterior era 1bb5cd7b-e99f-4bbe-8948-88d35e009f14).
//   3. Descomentar o bloco abaixo (e ajustar o provider para o tipo de chave).
//   4. Só DEPOIS pôr a Authentication/Firestore em "Enforced".
//
// if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
//   self.FIREBASE_APPCHECK_DEBUG_TOKEN = '1bb5cd7b-e99f-4bbe-8948-88d35e009f14';
// }
// initializeAppCheck(app, {
//   provider: new ReCaptchaV3Provider('6LeiwBQtAAAAAPHxgJAnSv0FwV6CZiN1VQVUSAM4'),
//   isTokenAutoRefreshEnabled: true
// });

export const auth = getAuth(app);
auth.languageCode = 'pt';

export const db = getFirestore(app);
