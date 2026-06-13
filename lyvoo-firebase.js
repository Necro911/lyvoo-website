// Configuração Firebase partilhada - Lyvoo
// Importado por registar.html, login.html, dashboard.html, admin.html, contacto.html
import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }                from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore }           from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initializeAppCheck, ReCaptchaV3Provider }
                                  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';

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

// ── App Check: modo debug em localhost ────────────────────────────────────────
// O reCAPTCHA v3 não valida localhost (devolve 403). Em ambiente local ativamos
// o debug token: com `true` o Firebase gera um token novo (aleatório) a cada
// reload, o que obriga a registar um token diferente sempre. Por isso fixamos
// aqui o token já registado em Firebase Console → App Check → Apps → ⋮ →
// Manage debug tokens, para ser estável entre reloads. Não afeta produção.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = '1bb5cd7b-e99f-4bbe-8948-88d35e009f14';
}

// ── App Check (reCAPTCHA v3) ──────────────────────────────────────────────────
// Garante que só o domínio lyvoo.pt pode aceder ao Firestore e Auth.
// SUBSTITUI '6LeiwBQtAAAAAPHxgJAnSv0FwV6CZiN1VQVUSAM4' pela chave obtida em google.com/recaptcha/admin
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LeiwBQtAAAAAPHxgJAnSv0FwV6CZiN1VQVUSAM4'),
  isTokenAutoRefreshEnabled: true   // renova o token em background automaticamente
});

export const auth = getAuth(app);
auth.languageCode = 'pt';

export const db = getFirestore(app);
