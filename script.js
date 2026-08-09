import { renderHeader, initHeader } from './components/header.js?v=0.2.1';
import { renderDock, initDock, dockItems } from './components/dock.js?v=0.2.1';
import { renderToast, createToast } from './components/toast.js?v=0.2.1';
import { renderDashboardScreen } from './screens/dashboard.js?v=0.2.1';
import { renderEmployeesScreen, initEmployeesScreen } from './screens/employees.js?v=0.2.1';
import { renderScheduleScreen } from './screens/schedule.js?v=0.2.1';
import { renderSalaryScreen } from './screens/salary.js?v=0.2.1';
import { renderWarehouseScreen } from './screens/warehouse.js?v=0.2.1';
import { renderKnowledgeScreen } from './screens/knowledge.js?v=0.2.1';
import { renderTrainingScreen } from './screens/training.js?v=0.2.1';
import { renderTasksScreen } from './screens/tasks.js?v=0.2.1';
import { renderSettingsScreen, initSettingsScreen } from './screens/settings.js?v=0.2.1';

const screens = {
  dashboard: renderDashboardScreen,
  employees: renderEmployeesScreen,
  schedule: renderScheduleScreen,
  salary: renderSalaryScreen,
  warehouse: renderWarehouseScreen,
  knowledge: renderKnowledgeScreen,
  training: renderTrainingScreen,
  tasks: renderTasksScreen,
  settings: renderSettingsScreen
};

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

  function navigate(route, { updateHistory = true } = {}) {
    const normalizedRoute = screens[route] ? route : 'dashboard';
    workspace.innerHTML = screens[normalizedRoute]();
    setActiveDockItem(normalizedRoute);

    if (normalizedRoute === 'settings') {
      initSettingsScreen(workspace, { showToast });
    }

    if (normalizedRoute === 'employees') {
      initEmployeesScreen(workspace, { showToast });
    }

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
