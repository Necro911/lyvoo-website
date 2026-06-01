/**
 * Lyvoo — Banner de consentimento de cookies (RGPD)
 * Incluir com: <script src="cookie-banner.js" defer></script>
 *
 * Preferências guardadas em localStorage:
 *   lyvoo_cookies = "all" | "essential"
 *
 * Eventos despachados em window:
 *   lyvoo:cookies:all       — utilizador aceitou todos
 *   lyvoo:cookies:essential — utilizador aceitou apenas essenciais
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lyvoo_cookies';

  // Se já escolheu, não mostra o banner
  if (localStorage.getItem(STORAGE_KEY)) return;

  /* ── CSS ── */
  const style = document.createElement('style');
  style.textContent = `
    #lyvoo-cookie-banner {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(120%);
      z-index: 9999;
      width: calc(100% - 32px);
      max-width: 740px;
      background: #0E1417;
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 20px;
      padding: 22px 26px;
      display: flex;
      align-items: center;
      gap: 20px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.55);
      transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
    }
    #lyvoo-cookie-banner.visible {
      transform: translateX(-50%) translateY(0);
    }
    #lyvoo-cookie-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(61,217,232,0.10);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #3DD9E8;
    }
    #lyvoo-cookie-text {
      flex: 1;
      font-family: 'Inter', sans-serif;
      font-size: 13.5px;
      line-height: 1.6;
      color: rgba(255,255,255,0.55);
    }
    #lyvoo-cookie-text strong {
      color: rgba(255,255,255,0.9);
      font-weight: 600;
      display: block;
      margin-bottom: 3px;
    }
    #lyvoo-cookie-text a {
      color: #3DD9E8;
      text-decoration: none;
    }
    #lyvoo-cookie-text a:hover { text-decoration: underline; }
    #lyvoo-cookie-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }
    .lyvoo-cookie-btn {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 9px 20px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.18s, transform 0.15s;
    }
    .lyvoo-cookie-btn:hover { opacity: 0.88; transform: translateY(-1px); }
    .lyvoo-cookie-btn:active { transform: translateY(0); }
    #lyvoo-btn-all {
      background: #0B525A;
      color: #fff;
      border: 1px solid rgba(61,217,232,0.25);
    }
    #lyvoo-btn-essential {
      background: transparent;
      color: rgba(255,255,255,0.45);
      border: 1px solid rgba(255,255,255,0.12);
    }
    #lyvoo-btn-essential:hover { color: rgba(255,255,255,0.75); border-color: rgba(255,255,255,0.25); }

    @media (max-width: 600px) {
      #lyvoo-cookie-banner {
        flex-direction: column;
        align-items: flex-start;
        bottom: 16px;
        padding: 20px;
        gap: 16px;
      }
      #lyvoo-cookie-actions {
        flex-direction: row;
        width: 100%;
      }
      .lyvoo-cookie-btn { flex: 1; text-align: center; }
    }
  `;
  document.head.appendChild(style);

  /* ── HTML ── */
  const banner = document.createElement('div');
  banner.id = 'lyvoo-cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Consentimento de cookies');
  banner.innerHTML = `
    <div id="lyvoo-cookie-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>
        <path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/>
      </svg>
    </div>
    <div id="lyvoo-cookie-text">
      <strong>Este site utiliza cookies</strong>
      Utilizamos cookies essenciais para o funcionamento da plataforma e, com o seu consentimento, cookies analíticos para melhorar a sua experiência.
      Consulte a nossa <a href="privacidade.html#cookies">Política de Privacidade</a>.
    </div>
    <div id="lyvoo-cookie-actions">
      <button class="lyvoo-cookie-btn" id="lyvoo-btn-all">Aceitar todos</button>
      <button class="lyvoo-cookie-btn" id="lyvoo-btn-essential">Apenas essenciais</button>
    </div>
  `;

  document.body.appendChild(banner);

  // Anima a entrada após um pequeno delay
  requestAnimationFrame(() => {
    setTimeout(() => banner.classList.add('visible'), 120);
  });

  /* ── Helpers ── */
  function fechar(escolha) {
    banner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    banner.style.opacity = '0';
    banner.style.transform = 'translateX(-50%) translateY(120%)';
    setTimeout(() => banner.remove(), 320);
    localStorage.setItem(STORAGE_KEY, escolha);
    window.dispatchEvent(new CustomEvent('lyvoo:cookies:' + escolha));
  }

  document.getElementById('lyvoo-btn-all').addEventListener('click', () => fechar('all'));
  document.getElementById('lyvoo-btn-essential').addEventListener('click', () => fechar('essential'));

})();
