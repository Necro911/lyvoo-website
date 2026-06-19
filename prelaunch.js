/**
 * Lyvoo - Modo pré-lançamento
 * Incluir com: <script src="prelaunch.js" defer></script>
 *
 * Enquanto a marca não está operacional, este script:
 *  1) troca os CTAs de registo/login/dashboard por um CTA para a lista de espera
 *  2) esconde blocos de preço estruturados (com selo "Em breve")
 *  3) mascara menções textuais ao preço do Programa Lyvoo (qualquer valor: €359, €365, …)
 *
 * INTERRUPTOR ÚNICO - para repor o site normal, basta mudar para `false`
 * (ou remover a tag <script src="prelaunch.js">). Nada mais precisa de mudar.
 */
(function () {
  'use strict';

  const PRELAUNCH = true;
  if (!PRELAUNCH) return;

  const isEN = (document.documentElement.lang || '').toLowerCase().startsWith('en');

  const WAITLIST_HREF     = isEN ? 'https://lyvoo.pt/en/contact.html#contactForm' : 'https://lyvoo.pt/contacto.html#contactForm';
  const WAITLIST_LABEL    = isEN ? 'Join the waitlist' : 'Junte-se à lista de espera';
  const SOON_LABEL        = isEN ? 'Coming soon - pricing to be announced' : 'Em breve - preço a confirmar';
  const PRICE_PLACEHOLDER = isEN ? 'pricing to be announced' : 'preço a confirmar';
  const STORIES_SOON      = isEN ? 'Soon, you could be part of the Lyvoo story.' : 'Em breve poderá fazer parte da história da Lyvoo.';
  const GUARANTEE_NOTE    = isEN ? 'No commitment to join · we’ll email you the moment spots open' : 'Entrada sem compromisso · avisamos assim que a lista abrir';

  /* ─────────── CSS ─────────── */
  const style = document.createElement('style');
  style.textContent = `
    .prelaunch-hide { display: none !important; }
    .prelaunch-soon-badge {
      display: inline-block; font-size: 13px; font-weight: 600;
      color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 999px; padding: 8px 20px; font-family: 'Inter', sans-serif;
    }
    .prelaunch-stories-soon {
      text-align: center; max-width: 540px; margin: 0 auto;
      padding: 56px 36px; border: 1.5px dashed rgba(11,82,90,0.2);
      border-radius: 22px; background: rgba(11,82,90,0.035);
    }
    .prelaunch-stories-soon svg { color: #0B525A; opacity: 0.45; margin-bottom: 16px; }
    .prelaunch-stories-soon p {
      font-family: 'Inter', sans-serif; font-size: 17px; font-weight: 600;
      line-height: 1.7; color: var(--ink-2, #5B6B6E); margin: 0;
    }
  `;
  document.head.appendChild(style);

  /* ─────────── 1a. Links de login → escondidos (ninguém tem conta ainda) ─────────── */
  const loginPattern = /(^|\/)login\.html(\?|#|$)/i;
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!loginPattern.test(href)) return;
    a.classList.add('prelaunch-hide');
  });

  /* ─────────── 1b. CTAs de registo/dashboard → lista de espera (1 só botão) ─────────── */
  const signupPattern = /(^|\/)(registar|register|dashboard)\.html(\?|#|$)/i;
  document.querySelectorAll('a[href]').forEach((a) => {
    if (a.closest('.lang-toggle')) return;
    const href = a.getAttribute('href') || '';
    if (!signupPattern.test(href)) return;
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

  /* ─────────── 2b. Micro-cópia de subscrição/cancelamento sob o CTA → nota de lista de espera ───────────
     Com o preço escondido, falar de "cancelamento" / "sem renovação" mesmo por baixo do botão
     "Junte-se à lista de espera" levanta a pergunta do dinheiro sem a responder. Trocamos por uma
     garantia adequada à lista de espera (reduz o atrito de entrar, sem mencionar pagamento). */
  document.querySelectorAll('.sp-guarantee').forEach((el) => {
    el.textContent = GUARANTEE_NOTE;
  });

  /* ─────────── 3b. Secção "Histórias reais" → ainda sem testemunhos ─────────── */
  const tstGrid = document.querySelector('#testemunhos .tst-grid');
  if (tstGrid && !document.querySelector('.prelaunch-stories-soon')) {
    tstGrid.classList.add('prelaunch-hide');
    const soon = document.createElement('div');
    soon.className = 'prelaunch-stories-soon';
    soon.innerHTML = `
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.65-9.5 9-9.5 9z"/></svg>
      <p>${STORIES_SOON}</p>
    `;
    tstGrid.insertAdjacentElement('afterend', soon);
  }

  /* ─────────── 3. Menções textuais a "€XXX/ano" ou "€XXX/year" → mascaradas ───────────
     Usa \d{2,4} (e não um número fixo) porque €359 e €365 coexistem no site — assim
     nenhum preço do programa escapa no pré-lançamento. Não apanha "€800-1500" (anchor
     de mercado) nem "€15" (taxa logística), pois esses não têm "/ano" ou "/year". */
  const priceTestRe    = /\(?\s*€\s?\d{2,4}\s?\/\s?(ano|year)\s*\)?/i;
  const priceReplaceRe = /\(?\s*€\s?\d{2,4}\s?\/\s?(ano|year)\s*\)?/gi;

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
