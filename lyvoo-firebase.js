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

// ── App Check (reCAPTCHA v3) ──────────────────────────────────────────────────
// Garante que só o domínio lyvoo.pt pode aceder ao Firestore e Auth.
// SUBSTITUI 'RECAPTCHA_SITE_KEY' pela chave obtida em google.com/recaptcha/admin
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('RECAPTCHA_SITE_KEY'),
  isTokenAutoRefreshEnabled: true   // renova o token em background automaticamente
});

export const auth = getAuth(app);
auth.languageCode = 'pt';

export const db = getFirestore(app);
