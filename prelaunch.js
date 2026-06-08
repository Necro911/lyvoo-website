/**
 * Lyvoo — Modo pré-lançamento
 * Incluir com: <script src="prelaunch.js" defer></script>
 *
 * Enquanto a marca não está operacional, este script:
 *  1) troca os CTAs de registo/login/dashboard por um CTA para a lista de espera
 *  2) esconde blocos de preço estruturados (com selo "Em breve")
 *  3) mascara menções textuais ao preço do Programa Lyvoo (€359/ano)
 *
 * INTERRUPTOR ÚNICO — para repor o site normal, basta mudar para `false`
 * (ou remover a tag <script src="prelaunch.js">). Nada mais precisa de mudar.
 */
(function () {
  'use strict';

  const PRELAUNCH = true;
  if (!PRELAUNCH) return;

  const isEN = (document.documentElement.lang || '').toLowerCase().startsWith('en');

  const WAITLIST_HREF     = isEN ? 'https://lyvoo.pt/en/contact.html#contactForm' : 'https://lyvoo.pt/contacto.html#contactForm';
  const WAITLIST_LABEL    = isEN ? 'Join the waitlist' : 'Junte-se à lista de espera';
  const SOON_LABEL        = isEN ? 'Coming soon — pricing to be announced' : 'Em breve — preço a confirmar';
  const PRICE_PLACEHOLDER = isEN ? 'pricing to be announced' : 'preço a confirmar';

  /* ─────────── CSS ─────────── */
  const style = document.createElement('style');
  style.textContent = `
    .prelaunch-hide { display: none !important; }
    .prelaunch-soon-badge {
      display: inline-block; font-size: 13px; font-weight: 600;
      color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 999px; padding: 8px 20px; font-family: 'Inter', sans-serif;
    }
  `;
  document.head.appendChild(style);

  /* ─────────── 1. CTAs de registo/login/dashboard → lista de espera ─────────── */
  const ctaPattern = /(^|\/)(registar|register|login|dashboard)\.html(\?|#|$)/i;
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!ctaPattern.test(href)) return;
    const svg = a.querySelector('svg');
    a.textContent = WAITLIST_LABEL;
    if (svg) a.appendChild(svg);
    a.setAttribute('href', WAITLIST_HREF);
  });

  /* ─────────── 2. Blocos de preço estruturados → selo "Em breve" ─────────── */
  document.querySelectorAll('.hero-price-wrap, .sp-price-wrap').forEach((el) => {
    el.classList.add('prelaunch-hide');
    const badge = document.createElement('div');
    badge.className = 'prelaunch-soon-badge';
    badge.textContent = SOON_LABEL;
    el.insertAdjacentElement('afterend', badge);
  });

  /* ─────────── 3. Menções textuais a "€359/ano" ou "€359/year" → mascaradas ─────────── */
  const priceTestRe    = /\(?\s*€\s?359\s?\/\s?(ano|year)\s*\)?/i;
  const priceReplaceRe = /\(?\s*€\s?359\s?\/\s?(ano|year)\s*\)?/gi;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement && node.parentElement.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
      return priceTestRe.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });

  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(n);
  textNodes.forEach((node) => {
    node.nodeValue = node.nodeValue.replace(priceReplaceRe, `(${PRICE_PLACEHOLDER})`);
  });
})();
