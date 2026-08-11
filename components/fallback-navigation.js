import { SYLON_MODULES } from '../core/sylon-state.js';

export function renderFallbackNavigation() {
  const items = [{ route: 'dashboard', shortLabel: 'Главная' }, ...SYLON_MODULES];
  return `
    <nav class="sylon-fallback-nav" data-sylon-fallback aria-label="Навигация SYLON">
      <span class="sylon-fallback-nav__handle" aria-hidden="true"></span>
      <div class="sylon-fallback-nav__items">
        ${items.map((item) => `<button type="button" data-fallback-route="${item.route}">${item.shortLabel}</button>`).join('')}
      </div>
    </nav>`;
}

export function initFallbackNavigation(root, navigate) {
  const navigation = root.querySelector('[data-sylon-fallback]');
  const onClick = (event) => {
    const button = event.target.closest('[data-fallback-route]');
    if (button) navigate(button.dataset.fallbackRoute);
  };
  const onPointerMove = (event) => {
    navigation?.classList.toggle('is-near', event.clientY > window.innerHeight - 120);
  };
  const onPointerLeave = () => navigation?.classList.remove('is-near');

  navigation?.addEventListener('click', onClick);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onPointerLeave);

  return () => {
    navigation?.removeEventListener('click', onClick);
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('mouseleave', onPointerLeave);
  };
}
