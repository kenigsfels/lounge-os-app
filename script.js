import { renderHeader, initHeader } from './components/header.js';
import { renderDock, initDock, dockItems } from './components/dock.js';
import { renderToast, createToast } from './components/toast.js';
import { renderSylonHomeScreen, initSylonHomeScreen } from './screens/home.js';
import { renderEmployeesScreen, initEmployeesScreen } from './screens/employees.js';
import { renderScheduleScreen, initScheduleScreen } from './screens/schedule.js';
import { renderSalaryScreen } from './screens/salary.js';
import { renderWarehouseScreen, initWarehouseScreen } from './screens/warehouse.js';
import { renderAnalyticsScreen, initAnalyticsScreen } from './screens/analytics.js';
import { renderKnowledgeScreen, initKnowledgeScreen } from './screens/knowledge.js';
import { renderTrainingScreen } from './screens/training.js';
import { renderTasksScreen, initTasksScreen } from './screens/tasks.js';
import { renderSettingsScreen, initSettingsScreen } from './screens/settings.js';
import { registerSylonServiceWorker } from './core/pwa.js';

const screens = {
  dashboard: renderSylonHomeScreen,
  employees: renderEmployeesScreen,
  schedule: renderScheduleScreen,
  salary: renderSalaryScreen,
  warehouse: renderWarehouseScreen,
  analytics: renderAnalyticsScreen,
  knowledge: renderKnowledgeScreen,
  training: renderTrainingScreen,
  tasks: renderTasksScreen,
  settings: renderSettingsScreen
};

registerSylonServiceWorker();

function startApp() {
  document.body.classList.toggle('is-desktop-preview', Boolean(globalThis.sylon?.desktop?.preview));
  const headerRoot = document.querySelector('#headerRoot');
  const workspace = document.querySelector('#workspace');
  const dockRoot = document.querySelector('#dockRoot');
  const toastRoot = document.querySelector('#toastRoot');

  headerRoot.innerHTML = renderHeader();
  dockRoot.className = 'dock';
  dockRoot.innerHTML = renderDock();
  toastRoot.innerHTML = renderToast();

  const showToast = createToast(toastRoot.querySelector('.toast'));
  let setActiveDockItem = () => {};
  let cleanupScreen = () => {};
  let currentRoute = null;

  function navigate(route, { updateHistory = true } = {}) {
    const normalizedRoute = screens[route] ? route : 'dashboard';

    const renderRoute = () => {
      cleanupScreen();
      cleanupScreen = () => {};
      document.body.classList.toggle('is-home-route', normalizedRoute === 'dashboard');
      document.body.classList.toggle('is-workspace-route', normalizedRoute !== 'dashboard');
      document.body.dataset.route = normalizedRoute;
      workspace.innerHTML = screens[normalizedRoute]();
      setActiveDockItem(normalizedRoute);
      const sectionLabel = headerRoot.querySelector('[data-workspace-section]');
      const routeItem = dockItems.find((item) => item.route === normalizedRoute);
      if (sectionLabel) sectionLabel.textContent = routeItem?.label || '';

      if (normalizedRoute === 'dashboard') {
        cleanupScreen = initSylonHomeScreen(workspace, { navigate, showToast });
      }

      if (normalizedRoute === 'settings') {
        initSettingsScreen(workspace, { showToast });
      }

      if (normalizedRoute === 'employees') {
        cleanupScreen = initEmployeesScreen(workspace, { showToast });
      }

      if (normalizedRoute === 'schedule') {
        cleanupScreen = initScheduleScreen(workspace, { showToast });
      }

      if (normalizedRoute === 'tasks') {
        cleanupScreen = initTasksScreen(workspace, { showToast });
      }

      if (normalizedRoute === 'warehouse') {
        cleanupScreen = initWarehouseScreen(workspace, { showToast });
      }

      if (normalizedRoute === 'analytics') {
        cleanupScreen = initAnalyticsScreen(workspace, { showToast });
      }

      if (normalizedRoute === 'knowledge') {
        cleanupScreen = initKnowledgeScreen(workspace, { showToast });
      }

      currentRoute = normalizedRoute;
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.toggle('is-returning-home', currentRoute !== null && normalizedRoute === 'dashboard');
    if (document.startViewTransition && !reducedMotion) document.startViewTransition(renderRoute);
    else renderRoute();
    window.setTimeout(() => document.body.classList.remove('is-returning-home'), reducedMotion ? 0 : 540);

    if (updateHistory) {
      window.history.replaceState(null, '', `#${normalizedRoute}`);
    }

    workspace.focus({ preventScroll: true });
  }

  setActiveDockItem = initDock(dockRoot, navigate);
  initHeader(headerRoot, {
    onHome: () => navigate('dashboard'),
    onNotifications: () => showToast('Новых уведомлений нет')
  });

  workspace.addEventListener('click', (event) => {
    const routeLink = event.target.closest('[data-route-link]');
    if (routeLink) {
      navigate(routeLink.dataset.routeLink);
      return;
    }
    if (event.target.closest('[data-action]')) showToast('Раздел в разработке');
  });

  window.addEventListener('hashchange', () => {
    navigate(window.location.hash.slice(1), { updateHistory: false });
  });

  const initialRoute = window.location.hash.slice(1);
  const knownRoute = dockItems.some((item) => item.route === initialRoute);
  navigate(knownRoute ? initialRoute : 'dashboard');
  const boot = document.querySelector('#appBoot');
  window.requestAnimationFrame(() => {
    boot?.classList.add('is-leaving');
    window.setTimeout(() => boot?.remove(), 520);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
  startApp();
}
