/**
 * Lyvoo - Botão "voltar ao topo"
 * Incluir com: <script src="scroll-top.js" defer></script>
 *
 * Aparece após scroll > 400px, scroll suave até ao topo ao clicar.
 */

(function () {
  'use strict';

  /* ─────────── CSS ─────────── */
  const style = document.createElement('style');
  style.textContent = `
    #scroll-top-btn {
      position: fixed; bottom: 28px; right: 28px;
      z-index: 9000;
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(11, 82, 90, 0.9);
      border: 1.5px solid rgba(61, 217, 232, 0.25);
      color: #3DD9E8;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      opacity: 0; transform: translateY(12px);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease, background 0.18s, border-color 0.18s;
      backdrop-filter: blur(6px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }
    #scroll-top-btn.visible {
      opacity: 1; transform: translateY(0);
      pointer-events: auto;
    }
    #scroll-top-btn:hover {
      background: rgba(61, 217, 232, 0.18);
      border-color: rgba(61, 217, 232, 0.5);
    }
    #scroll-top-btn svg { width: 20px; height: 20px; }
    @media (max-width: 560px) {
      #scroll-top-btn { bottom: 20px; right: 18px; width: 40px; height: 40px; }
    }
  `;
  document.head.appendChild(style);

  /* ─────────── HTML ─────────── */
  const btn = document.createElement('button');
  btn.id = 'scroll-top-btn';
  btn.setAttribute('aria-label', 'Voltar ao topo');
  btn.setAttribute('title', 'Voltar ao topo');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 19V5"/>
      <path d="M5 12l7-7 7 7"/>
    </svg>
  `;
  document.body.appendChild(btn);

  /* ─────────── Lógica ─────────── */
  function toggle() {
    if (window.scrollY > 400) btn.classList.add('visible');
    else btn.classList.remove('visible');
  }

  window.addEventListener('scroll', toggle, { passive: true });
  toggle();

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
