import { renderHeader, initHeader } from './components/header.js';
import { renderDock, initDock, dockItems } from './components/dock.js';
import { renderToast, createToast } from './components/toast.js';
import { renderSylonHomeScreen, initSylonHomeScreen } from './screens/home.js';
import { renderEmployeesScreen, initEmployeesScreen } from './screens/employees.js';
import { renderScheduleScreen, initScheduleScreen } from './screens/schedule.js';
import { renderSalaryScreen } from './screens/salary.js';
import { renderWarehouseScreen } from './screens/warehouse.js';
import { renderKnowledgeScreen } from './screens/knowledge.js';
import { renderTrainingScreen } from './screens/training.js';
import { renderTasksScreen } from './screens/tasks.js';
import { renderSettingsScreen, initSettingsScreen } from './screens/settings.js';
import { registerSylonServiceWorker } from './core/pwa.js';

const screens = {
  dashboard: renderSylonHomeScreen,
  employees: renderEmployeesScreen,
  schedule: renderScheduleScreen,
  salary: renderSalaryScreen,
  warehouse: renderWarehouseScreen,
  knowledge: renderKnowledgeScreen,
  training: renderTrainingScreen,
  tasks: renderTasksScreen,
  settings: renderSettingsScreen
};

registerSylonServiceWorker();

function startApp() {
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

  function navigate(route, { updateHistory = true } = {}) {
    const normalizedRoute = screens[route] ? route : 'dashboard';

    const renderRoute = () => {
      cleanupScreen();
      cleanupScreen = () => {};
      document.body.classList.toggle('is-home-route', normalizedRoute === 'dashboard');
      workspace.innerHTML = screens[normalizedRoute]();
      setActiveDockItem(normalizedRoute);

      if (normalizedRoute === 'dashboard') {
        cleanupScreen = initSylonHomeScreen(workspace, { navigate, showToast });
      }

      if (normalizedRoute === 'settings') {
        initSettingsScreen(workspace, { showToast });
      }

      if (normalizedRoute === 'employees') {
        initEmployeesScreen(workspace, { showToast });
      }

      if (normalizedRoute === 'schedule') {
        initScheduleScreen(workspace, { showToast });
      }
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reducedMotion) document.startViewTransition(renderRoute);
    else renderRoute();

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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
  startApp();
}
