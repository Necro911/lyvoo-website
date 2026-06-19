/**
 * Lyvoo - Menu mobile partilhado (páginas isoladas)
 * Gera o botão hambúrguer e o painel de menu mobile a partir da lista
 * <ul class="nav-links"> já existente na página, evitando duplicar a
 * mesma navbar em cada ficheiro. (index.html / en/index.html têm o seu
 * próprio menu mobile dedicado e não usam este script.)
 */
(function () {
  'use strict';

  const nav = document.querySelector('.nav');
  const navInner = nav && nav.querySelector('.nav-inner');
  const navLinks = navInner && navInner.querySelector('ul.nav-links');
  if (!nav || !navInner || !navLinks) return;

  const btn = document.createElement('button');
  btn.className = 'nav-mob';
  btn.id = 'mobBtn';
  btn.setAttribute('aria-label', 'Menu');
  btn.setAttribute('aria-controls', 'mobMenu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="19" y2="6"/><line x1="3" y1="11" x2="19" y2="11"/><line x1="3" y1="16" x2="19" y2="16"/></svg>';
  navInner.appendChild(btn);

  const menu = document.createElement('div');
  menu.className = 'mob-menu';
  menu.id = 'mobMenu';

  function closeMob() {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  Array.from(navLinks.children).forEach((li) => {
    if (li.classList.contains('lang-toggle')) {
      const wrap = document.createElement('div');
      wrap.className = 'mob-lang';
      Array.from(li.children).forEach((child) => {
        const clone = child.cloneNode(true);
        if (clone.classList && clone.classList.contains('lang-active')) {
          clone.classList.add('mob-lang-active');
        }
        if (clone.tagName === 'A') clone.addEventListener('click', closeMob);
        wrap.appendChild(clone);
      });
      menu.appendChild(wrap);
      return;
    }
    const a = li.querySelector('a');
    if (!a) return;
    const clone = a.cloneNode(true);
    if (a.classList.contains('nav-cta')) {
      clone.style.background = 'var(--teal)';
      clone.style.color = '#fff';
      clone.style.textAlign = 'center';
      clone.style.marginTop = '6px';
    } else if (a.classList.contains('nav-login')) {
      clone.style.textAlign = 'center';
      clone.style.border = '1.5px solid var(--border)';
      clone.style.marginTop = '6px';
    }
    clone.addEventListener('click', closeMob);
    menu.appendChild(clone);
  });

  nav.insertAdjacentElement('afterend', menu);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== btn) closeMob();
  });
})();
