// ─────────────────────────────────────────────────────────────
// Configuração Firebase partilhada — Lyvoo
// Importado por registar.html, login.html, dashboard.html
// ─────────────────────────────────────────────────────────────
import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

export const auth = getAuth(app);
auth.languageCode = 'pt';

export const db = getFirestore(app);

// Catálogo de planos (fonte única de verdade)
export const PLANOS = {
  essencial: { id: 'essencial', nome: 'Lyvoo Essencial', preco: 320 },
  completo:  { id: 'completo',  nome: 'Lyvoo Completo',  preco: 640 }
};
