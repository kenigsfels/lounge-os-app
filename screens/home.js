import { getEmployees } from '../core/employees.js';
import { SYLON_MODULES } from '../core/sylon-state.js';
import { initSylonCore } from '../components/sylon-core.js';
import { initAssistantInput, renderAssistantInput } from '../components/assistant-input.js';
import { initContextualCard, renderContextualCard } from '../components/contextual-card.js';
import { initFallbackNavigation, renderFallbackNavigation } from '../components/fallback-navigation.js';

function renderModule(module, index) {
  return `
    <button class="sylon-module sylon-module--${module.position} sylon-module--${module.tone}"
      type="button" data-sylon-module="${module.route}" style="--module-index:${index}">
      <span class="sylon-module__signal" aria-hidden="true"></span>
      <span class="sylon-module__meta">Узел ${String(index + 1).padStart(2, '0')}</span>
      <strong>${module.label}</strong>
      <small>${module.route === 'employees' ? 'Люди и роли' : module.route === 'schedule' ? 'Сегодня и дальше' : module.route === 'tasks' ? 'Фокус и действия' : 'Остатки и движение'}</small>
    </button>`;
}

export function renderSylonHomeScreen() {
  const activeEmployees = getEmployees().filter((employee) => employee.status === 'active').length;
  const activeModules = SYLON_MODULES.filter((module) => module.active);
  const dormantModules = SYLON_MODULES.filter((module) => !module.active);

  return `
    <section class="sylon-home view is-active" data-sylon-home aria-labelledby="sylonHomeTitle">
      <div class="sylon-home__atmosphere" aria-hidden="true"></div>
      <header class="sylon-home__brand">
        <a href="#dashboard" data-sylon-home-link aria-label="SYLON — главная">
          <span class="sylon-home__brand-mark" aria-hidden="true"></span>
          <strong>SYLON</strong>
        </a>
        <p id="sylonHomeTitle">Живая операционная среда</p>
      </header>
      <div class="sylon-home__status" aria-label="Статус системы">
        <span></span> Система спокойна
      </div>
      ${renderContextualCard({ activeEmployees })}
      <div class="sylon-stage" data-sylon-stage>
        <div class="sylon-core" data-sylon-core></div>
        <div class="sylon-core__halo" aria-hidden="true"></div>
        <div class="sylon-connections" aria-hidden="true">
          <i class="connection connection--left-top"></i>
          <i class="connection connection--right-top"></i>
          <i class="connection connection--left-bottom"></i>
          <i class="connection connection--right-bottom"></i>
        </div>
        <div class="sylon-modules" aria-label="Основные модули SYLON">
          ${activeModules.map(renderModule).join('')}
        </div>
        <div class="sylon-dormant" aria-hidden="true">
          ${dormantModules.map((module, index) => `<span style="--dormant-index:${index}">${module.shortLabel}</span>`).join('')}
        </div>
      </div>
      <p class="sylon-core-hint">Потяни, чтобы исследовать <span>·</span> колесо меняет глубину</p>
      ${renderAssistantInput()}
      ${renderFallbackNavigation()}
    </section>`;
}

export function initSylonHomeScreen(root, { navigate, showToast }) {
  const home = root.querySelector('[data-sylon-home]');
  const coreContainer = home?.querySelector('[data-sylon-core]');
  const cleanup = [
    initContextualCard(home, navigate),
    initAssistantInput(home, { navigate, showToast }),
    initFallbackNavigation(home, navigate)
  ];
  let coreCleanup = () => {};
  let disposed = false;
  let navigationTimer = 0;

  initSylonCore(coreContainer).then((disposeCore) => {
    if (disposed) disposeCore();
    else coreCleanup = disposeCore;
  });

  const openRoute = (route) => {
    if (!route) return;
    home.classList.add('is-opening');
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260;
    window.clearTimeout(navigationTimer);
    navigationTimer = window.setTimeout(() => navigate(route), delay);
  };

  const onModuleClick = (event) => openRoute(event.currentTarget.dataset.sylonModule);
  const onModuleEnter = (event) => {
    const route = event.currentTarget.dataset.sylonModule;
    home.dataset.hoveredModule = route;
    coreContainer?.dispatchEvent(new CustomEvent('sylon:module-hover', { detail: { route } }));
  };
  const onModuleLeave = () => {
    delete home.dataset.hoveredModule;
    coreContainer?.dispatchEvent(new CustomEvent('sylon:module-hover', { detail: { route: null } }));
  };

  const modules = [...home.querySelectorAll('[data-sylon-module]')];
  modules.forEach((module) => {
    module.addEventListener('click', onModuleClick);
    module.addEventListener('pointerenter', onModuleEnter);
    module.addEventListener('pointerleave', onModuleLeave);
    module.addEventListener('focus', onModuleEnter);
    module.addEventListener('blur', onModuleLeave);
  });

  return () => {
    disposed = true;
    window.clearTimeout(navigationTimer);
    coreCleanup();
    cleanup.forEach((dispose) => dispose?.());
    modules.forEach((module) => {
      module.removeEventListener('click', onModuleClick);
      module.removeEventListener('pointerenter', onModuleEnter);
      module.removeEventListener('pointerleave', onModuleLeave);
      module.removeEventListener('focus', onModuleEnter);
      module.removeEventListener('blur', onModuleLeave);
    });
  };
}
