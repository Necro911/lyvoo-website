/**
 * Lyvoo - Gestão de cookies RGPD
 * Incluir com: <script src="cookie-banner.js" defer></script>
 *
 * localStorage: lyvoo_cookies = "all" | "essential"
 * Eventos: lyvoo:cookies:all | lyvoo:cookies:essential
 * API: window.LyvooCookies.abrir() | .abrirDefinicoes() | .resetar()
 */

(function () {
  'use strict';

  const KEY = 'lyvoo_cookies';

  /* ─────────── CSS ─────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* ── BANNER (primeira visita) ── */
    #lc-banner {
      position: fixed; bottom: 24px; left: 24px;
      transform: translateY(130%);
      z-index: 9998;
      width: calc(100% - 48px); max-width: 340px;
      background: #0E1417;
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 18px; padding: 20px 22px;
      display: flex; flex-direction: column; gap: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.55);
      transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s;
      font-family: 'Inter', sans-serif;
    }
    #lc-banner.show { transform: translateY(0); }
    #lc-banner-icon {
      flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px;
      background: rgba(61,217,232,0.10); display: flex;
      align-items: center; justify-content: center; color: #3DD9E8;
    }
    #lc-banner-text { flex: 1; font-size: 13.5px; line-height: 1.6; color: rgba(255,255,255,0.55); }
    #lc-banner-text strong { color: rgba(255,255,255,0.9); font-weight: 600; display: block; margin-bottom: 3px; }
    #lc-banner-text a { color: #3DD9E8; text-decoration: none; }
    #lc-banner-text a:hover { text-decoration: underline; }
    #lc-banner-actions { display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap; }
    .lc-btn {
      font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
      padding: 8px 16px; border-radius: 9px; cursor: pointer;
      white-space: nowrap; text-align: center; flex: 1;
      transition: opacity 0.18s, transform 0.15s, background 0.18s;
    }
    .lc-btn:hover { opacity: 0.88; transform: translateY(-1px); }
    .lc-btn:active { transform: translateY(0); }
    #lc-btn-essential {
      background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.6);
      border: 1.5px solid rgba(255,255,255,0.14);
    }
    #lc-btn-essential:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
    #lc-btn-all {
      background: rgba(61,217,232,0.12); color: #3DD9E8;
      border: 1.5px solid rgba(61,217,232,0.35);
    }
    #lc-btn-all:hover { background: rgba(61,217,232,0.20); }
    #lc-btn-settings {
      background: none; color: rgba(255,255,255,0.35);
      border: none; font-size: 12px; padding: 4px 0;
      text-decoration: underline; cursor: pointer;
      font-family: 'Inter', sans-serif; text-align: center;
    }
    #lc-btn-settings:hover { color: rgba(255,255,255,0.65); }

    /* ── PAINEL DE DEFINIÇÕES (modal) ── */
    #lc-modal-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      opacity: 0; transition: opacity 0.25s;
    }
    #lc-modal-overlay.show { opacity: 1; }
    #lc-modal {
      background: #0E1417; border: 1px solid rgba(255,255,255,0.10);
      border-radius: 18px; padding: 22px 24px; width: 100%; max-width: 420px;
      font-family: 'Inter', sans-serif;
      transform: translateY(16px); transition: transform 0.25s;
    }
    #lc-modal-overlay.show #lc-modal { transform: translateY(0); }
    #lc-modal-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 16px;
    }
    #lc-modal-title { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 3px; }
    #lc-modal-sub { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5; }
    #lc-modal-close {
      background: none; border: none; color: rgba(255,255,255,0.3);
      cursor: pointer; padding: 2px; flex-shrink: 0; margin-left: 10px;
      transition: color 0.2s;
    }
    #lc-modal-close:hover { color: rgba(255,255,255,0.7); }

    /* Categorias */
    .lc-category {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px; padding: 12px 14px; margin-bottom: 8px;
    }
    .lc-cat-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .lc-cat-name { font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 3px; }
    .lc-cat-desc { font-size: 11.5px; color: rgba(255,255,255,0.38); line-height: 1.5; }

    /* Toggle switch */
    .lc-toggle { position: relative; width: 38px; height: 21px; flex-shrink: 0; }
    .lc-toggle input { opacity: 0; width: 0; height: 0; }
    .lc-slider {
      position: absolute; inset: 0; border-radius: 999px;
      cursor: pointer; transition: background 0.2s;
      background: rgba(255,255,255,0.12);
    }
    .lc-slider::before {
      content: ''; position: absolute;
      width: 15px; height: 15px; border-radius: 50%; background: #fff;
      left: 3px; top: 3px; transition: transform 0.2s;
    }
    .lc-toggle input:checked + .lc-slider { background: #0B525A; border: 1px solid rgba(61,217,232,0.35); }
    .lc-toggle input:checked + .lc-slider::before { transform: translateX(17px); }
    .lc-toggle input:disabled + .lc-slider { opacity: 0.55; cursor: not-allowed; }
    .lc-always-on {
      font-size: 10px; font-weight: 700; color: #3DD9E8;
      background: rgba(61,217,232,0.10); border: 1px solid rgba(61,217,232,0.2);
      border-radius: 999px; padding: 2px 8px; flex-shrink: 0; white-space: nowrap;
    }

    /* Footer do modal */
    #lc-modal-footer {
      display: flex; gap: 8px; margin-top: 18px; justify-content: flex-end;
    }
    .lc-modal-btn {
      font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
      padding: 9px 18px; border-radius: 9px; cursor: pointer;
      transition: opacity 0.18s, transform 0.15s;
    }
    .lc-modal-btn:hover { opacity: 0.88; transform: translateY(-1px); }
    #lc-modal-save {
      background: #0B525A; color: #fff;
      border: 1px solid rgba(61,217,232,0.25);
    }
    #lc-modal-reject {
      background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5);
      border: 1px solid rgba(255,255,255,0.12);
    }
    #lc-modal-reject:hover { color: rgba(255,255,255,0.85); }

    /* Botão persistente no rodapé do site */
    .lc-manage-btn {
      font-size: 13px; color: rgba(255,255,255,0.4);
      background: none; border: none; cursor: pointer;
      font-family: 'Inter', sans-serif; transition: color 0.2s;
      padding: 0; text-decoration: none;
    }
    .lc-manage-btn:hover { color: rgba(255,255,255,0.75); }

    @media (max-width: 480px) {
      #lc-banner { left: 16px; bottom: 16px; width: calc(100% - 32px); max-width: none; }
      #lc-modal-footer { flex-direction: column-reverse; }
      .lc-modal-btn { text-align: center; }
    }
  `;
  document.head.appendChild(style);

  /* ─────────── Banner (primeira visita) ─────────── */
  function mostrarBanner() {
    if (document.getElementById('lc-banner')) return;
    const el = document.createElement('div');
    el.id = 'lc-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Consentimento de cookies');
    el.innerHTML = `
      <div id="lc-banner-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>
          <path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/>
        </svg>
      </div>
      <div id="lc-banner-text">
        <strong>Este site utiliza cookies</strong>
        Cookies essenciais para o funcionamento e, com o seu consentimento, cookies analíticos.
        <a href="https://lyvoo.pt/privacidade.html#cookies">Saber mais</a>
      </div>
      <div id="lc-banner-actions">
        <button class="lc-btn" id="lc-btn-essential">Apenas essenciais</button>
        <button class="lc-btn" id="lc-btn-all">Aceitar todos</button>
        <button id="lc-btn-settings">Personalizar definições</button>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => setTimeout(() => el.classList.add('show'), 100));

    el.querySelector('#lc-btn-essential').addEventListener('click', () => { guardar('essential'); fecharBanner(); });
    el.querySelector('#lc-btn-all').addEventListener('click', () => { guardar('all'); fecharBanner(); });
    el.querySelector('#lc-btn-settings').addEventListener('click', () => { fecharBanner(); abrirModal(); });
  }

  function fecharBanner() {
    const el = document.getElementById('lc-banner');
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(130%)';
    setTimeout(() => el.remove(), 300);
  }

  /* ─────────── Modal de definições ─────────── */
  function abrirModal() {
    if (document.getElementById('lc-modal-overlay')) return;
    fecharBanner();

    const atual = localStorage.getItem(KEY);
    const analiticosOn = atual === 'all';

    const overlay = document.createElement('div');
    overlay.id = 'lc-modal-overlay';
    overlay.innerHTML = `
      <div id="lc-modal" role="dialog" aria-modal="true" aria-label="Definições de cookies">
        <div id="lc-modal-header">
          <div>
            <div id="lc-modal-title">Definições de cookies</div>
            <div id="lc-modal-sub">Escolha quais os cookies que aceita. Pode alterar esta preferência a qualquer momento.</div>
          </div>
          <button id="lc-modal-close" aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="lc-category">
          <div class="lc-cat-header">
            <div>
              <div class="lc-cat-name">Cookies essenciais</div>
              <div class="lc-cat-desc">Necessários para o funcionamento da plataforma. Autenticação, segurança da sessão e preferências básicas. Não podem ser desativados.</div>
            </div>
            <span class="lc-always-on">Sempre ativos</span>
          </div>
        </div>

        <div class="lc-category">
          <div class="lc-cat-header">
            <div>
              <div class="lc-cat-name">Cookies analíticos</div>
              <div class="lc-cat-desc">Permitem-nos compreender como os visitantes interagem com o site (páginas visitadas, duração da sessão). Utilizamos o Google Analytics. Os dados são anónimos e agregados.</div>
            </div>
            <label class="lc-toggle">
              <input type="checkbox" id="lc-toggle-analytics" ${analiticosOn ? 'checked' : ''}>
              <span class="lc-slider"></span>
            </label>
          </div>
        </div>

        <div id="lc-modal-footer">
          <button class="lc-modal-btn" id="lc-modal-reject">Recusar todos</button>
          <button class="lc-modal-btn" id="lc-modal-save">Guardar preferências</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => setTimeout(() => overlay.classList.add('show'), 20));

    // Fechar ao clicar fora
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharModal(); });
    overlay.querySelector('#lc-modal-close').addEventListener('click', fecharModal);
    overlay.querySelector('#lc-modal-reject').addEventListener('click', () => { guardar('essential'); fecharModal(); });
    overlay.querySelector('#lc-modal-save').addEventListener('click', () => {
      const analytics = overlay.querySelector('#lc-toggle-analytics').checked;
      guardar(analytics ? 'all' : 'essential');
      fecharModal();
    });

    // ESC fecha o modal
    document.addEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape') { fecharModal(); document.removeEventListener('keydown', escHandler); }
  }

  function fecharModal() {
    const overlay = document.getElementById('lc-modal-overlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 250);
    document.removeEventListener('keydown', escHandler);
  }

  /* ─────────── Guardar & disparar evento ─────────── */
  function guardar(valor) {
    localStorage.setItem(KEY, valor);
    window.dispatchEvent(new CustomEvent('lyvoo:cookies:' + valor));
  }

  /* ─────────── Botão persistente no rodapé ─────────── */
  function injectarBotaoRodape() {
    if (document.querySelector('.lc-manage-btn')) return;
    const alvo = document.querySelector('.footer-bottom-links') ||
                 document.querySelector('.footer-bottom') ||
                 document.querySelector('.footer-mini p') ||
                 document.querySelector('footer');
    if (!alvo) return;
    const btn = document.createElement('button');
    btn.className = 'lc-manage-btn';
    btn.textContent = 'Gerir cookies';
    btn.setAttribute('aria-label', 'Gerir preferências de cookies');
    btn.addEventListener('click', abrirModal);
    if (alvo.classList.contains('footer-bottom-links') || alvo.classList.contains('footer-bottom')) {
      alvo.appendChild(btn);
    } else {
      alvo.insertAdjacentElement('afterend', btn);
    }
  }

  /* ─────────── API pública ─────────── */
  window.LyvooCookies = {
    abrir: mostrarBanner,
    abrirDefinicoes: abrirModal,
    resetar: function () { localStorage.removeItem(KEY); mostrarBanner(); }
  };

  /* ─────────── Inicialização ─────────── */
  if (!localStorage.getItem(KEY)) {
    mostrarBanner();
  } else {
    injectarBotaoRodape();
  }

})();
