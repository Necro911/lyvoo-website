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
 *
 * API pública:
 *   window.LyvooCookies.abrir()   — (re)abre o banner
 *   window.LyvooCookies.resetar() — apaga preferência e reabre
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lyvoo_cookies';

  /* ── CSS (banner + botão persistente no rodapé) ── */
  const style = document.createElement('style');
  style.textContent = `
    /* Banner */
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
      transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
    }
    #lyvoo-cookie-banner.visible {
      transform: translateX(-50%) translateY(0);
    }
    #lyvoo-cookie-icon {
      flex-shrink: 0;
      width: 40px; height: 40px;
      border-radius: 12px;
      background: rgba(61,217,232,0.10);
      display: flex; align-items: center; justify-content: center;
      color: #3DD9E8;
    }
    #lyvoo-cookie-text {
      flex: 1;
      font-family: 'Inter', sans-serif;
      font-size: 13.5px; line-height: 1.6;
      color: rgba(255,255,255,0.55);
    }
    #lyvoo-cookie-text strong {
      color: rgba(255,255,255,0.9);
      font-weight: 600;
      display: block; margin-bottom: 3px;
    }
    #lyvoo-cookie-text a { color: #3DD9E8; text-decoration: none; }
    #lyvoo-cookie-text a:hover { text-decoration: underline; }

    /* Botões — peso visual IGUAL (correcção RGPD) */
    #lyvoo-cookie-actions {
      display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
    }
    .lyvoo-cookie-btn {
      font-family: 'Inter', sans-serif;
      font-size: 13px; font-weight: 600;
      padding: 9px 20px; border-radius: 10px;
      cursor: pointer; white-space: nowrap;
      transition: opacity 0.18s, transform 0.15s, background 0.18s;
      min-width: 160px; text-align: center;
    }
    .lyvoo-cookie-btn:hover { opacity: 0.88; transform: translateY(-1px); }
    .lyvoo-cookie-btn:active { transform: translateY(0); }
    /* Ambos com peso visual equivalente: borda + fundo semitransparente */
    #lyvoo-btn-all {
      background: rgba(61,217,232,0.12);
      color: #3DD9E8;
      border: 1.5px solid rgba(61,217,232,0.35);
    }
    #lyvoo-btn-all:hover { background: rgba(61,217,232,0.20); }
    #lyvoo-btn-essential {
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.6);
      border: 1.5px solid rgba(255,255,255,0.14);
    }
    #lyvoo-btn-essential:hover {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.85);
    }

    /* Botão persistente "Gerir cookies" — injectado no rodapé */
    .lyvoo-manage-cookies {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      background: none; border: none;
      cursor: pointer; padding: 0;
      text-decoration: none;
      transition: color 0.2s;
      font-family: 'Inter', sans-serif;
    }
    .lyvoo-manage-cookies:hover { color: rgba(255,255,255,0.75); }

    @media (max-width: 600px) {
      #lyvoo-cookie-banner {
        flex-direction: column; align-items: flex-start;
        bottom: 16px; padding: 20px; gap: 16px;
      }
      #lyvoo-cookie-actions { flex-direction: row; width: 100%; }
      .lyvoo-cookie-btn { flex: 1; }
    }
  `;
  document.head.appendChild(style);

  /* ── Funções principais ── */
  function construirBanner() {
    if (document.getElementById('lyvoo-cookie-banner')) return;

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
        <button class="lyvoo-cookie-btn" id="lyvoo-btn-essential">Apenas essenciais</button>
        <button class="lyvoo-cookie-btn" id="lyvoo-btn-all">Aceitar todos</button>
      </div>
    `;
    document.body.appendChild(banner);

    requestAnimationFrame(() => {
      setTimeout(() => banner.classList.add('visible'), 120);
    });

    function fechar(escolha) {
      banner.style.opacity = '0';
      banner.style.transform = 'translateX(-50%) translateY(120%)';
      setTimeout(() => banner.remove(), 320);
      localStorage.setItem(STORAGE_KEY, escolha);
      window.dispatchEvent(new CustomEvent('lyvoo:cookies:' + escolha));
      // Mostra o botão "Gerir cookies" no rodapé após escolha
      injectarBotaoGerirCookies();
    }

    document.getElementById('lyvoo-btn-all').addEventListener('click', () => fechar('all'));
    document.getElementById('lyvoo-btn-essential').addEventListener('click', () => fechar('essential'));
  }

  /* ── Botão persistente no rodapé ── */
  function injectarBotaoGerirCookies() {
    // Evita duplicados
    if (document.querySelector('.lyvoo-manage-cookies')) return;

    // Tenta encontrar elementos de rodapé comuns
    const alvos = [
      document.querySelector('.footer-bottom-links'),
      document.querySelector('.footer-bottom'),
      document.querySelector('.footer-mini p'),
      document.querySelector('.footer-copy'),
      document.querySelector('footer')
    ].filter(Boolean);

    if (!alvos.length) return;

    const alvo = alvos[0];
    const btn = document.createElement('button');
    btn.className = 'lyvoo-manage-cookies';
    btn.textContent = 'Gerir cookies';
    btn.setAttribute('aria-label', 'Gerir preferências de cookies');
    btn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      construirBanner();
    });

    // Insere dentro do container ou a seguir
    if (alvo.classList.contains('footer-bottom-links') || alvo.classList.contains('footer-bottom')) {
      alvo.appendChild(btn);
    } else {
      alvo.insertAdjacentElement('afterend', btn);
    }
  }

  /* ── API pública ── */
  window.LyvooCookies = {
    abrir: construirBanner,
    resetar: function () {
      localStorage.removeItem(STORAGE_KEY);
      construirBanner();
    }
  };

  /* ── Inicialização ── */
  if (!localStorage.getItem(STORAGE_KEY)) {
    // Primeira visita — mostra banner
    construirBanner();
  } else {
    // Visita seguinte — injeta botão "Gerir cookies" no rodapé
    injectarBotaoGerirCookies();
  }

})();
