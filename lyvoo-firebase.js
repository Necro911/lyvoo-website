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

// ── App Check (reCAPTCHA v3) ─────────────────────────────────────────────────
// Site key v3 NOVA (15 Jun 2026), criada no console clássico (Score based v3).
// NÃO voltar à antiga 6Lei…SAM4: essa foi migrada para Enterprise e, com o
// ReCaptchaV3Provider, fazia o Identity Toolkit rejeitar TODOS os tokens
// (auth/firebase-app-check-token-is-invalid) → bloqueava todo o login.
// O *secret* desta key vive só na Firebase Console → App Check (nunca no código).
//
// PRÉ-REQUISITOS no backend (Firebase Console → App Check), por ordem:
//   1. Registar a app web com o provider reCAPTCHA v3 + o secret desta key nova.
//   2. App Check → Manage debug tokens → adicionar o token que o SDK imprime na
//      consola do browser na 1ª carga em localhost (ver abaixo).
//   3. Manter Authentication e Firestore em UNENFORCED/Monitor; só depois de
//      confirmar tokens válidos no Monitor é que se passa a Enforced.
//
// NÃO hardcodear o valor do debug token: este ficheiro é servido publicamente, e
// um token fixo aqui seria um bypass ao App Check assim que estiver Enforced.
// Com `= true`, o SDK gera um token por-browser e imprime-o na consola; regista-se
// esse em Manage debug tokens. Em produção (lyvoo.pt) esta linha nunca corre.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6Lfbgx8tAAAAAGwkr0VPyki1t9kvAmu8ySjUck58'),
  isTokenAutoRefreshEnabled: true
});

export const auth = getAuth(app);
auth.languageCode = 'pt';

export const db = getFirestore(app);
