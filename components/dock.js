export const dockItems = [
  { route: 'dashboard', label: 'Вернуться к карте', icon: '<path d="M4.5 7.2 12 3.5l7.5 3.7L12 11 4.5 7.2Z"/><path d="m4.5 11 7.5 3.8 7.5-3.8M4.5 14.8l7.5 3.7 7.5-3.7"/><circle cx="12" cy="11" r="1.2"/>' },
  { route: 'analytics', label: 'Пульс заведения', icon: '<path d="M3 12h4l2-6 4 12 2-6h6"/><circle cx="12" cy="12" r="9"/>' },
  { route: 'employees', label: 'Сотрудники', icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M16 5a3 3 0 0 1 0 6m1 3c2.7.3 4 2.3 4 5"/>' },
  { route: 'schedule', label: 'График смен', icon: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4m8-4v4M3 10h18"/>' },
  { route: 'salary', label: 'Зарплата', icon: '<path d="M3 7a3 3 0 0 1 3-3h13v16H6a3 3 0 0 1-3-3V7Zm0 1h16m-5 5h7v4h-7a2 2 0 0 1 0-4Z"/>' },
  { route: 'warehouse', label: 'Склад', icon: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9"/>' },
  { route: 'knowledge', label: 'База знаний', icon: '<path d="M5 4h14a2 2 0 0 1 2 2v14H7a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2Zm2 12h14M8 8h8M8 11h6"/>' },
  { route: 'training', label: 'Обучение', icon: '<path d="M4 5a4 4 0 0 1 4-2h4v17H8a4 4 0 0 0-4 2V5Zm16 0a4 4 0 0 0-4-2h-4v17h4a4 4 0 0 1 4 2V5Z"/>' },
  { route: 'tasks', label: 'Задачи', icon: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7 12 3 3 7-7"/>' },
  { route: 'settings', label: 'Настройки', icon: '<circle cx="12" cy="12" r="3"/><path d="M19 14.5v-5l-2-.7-.8-1.8.9-2-3.5-2-1.5 1.5-2-.1L8.8 2.8 5.2 5l.4 2.1-1 1.7-2.1.7v5l2.1.7 1 1.7-.4 2.1 3.6 2.2 1.4-1.6 2 .1 1.4 1.5 3.5-2-.9-2 .8-1.8 2-.7Z"/>' }
];

export function renderDock() {
  return dockItems.map((item) => `
    <button class="dock-item" type="button" data-route="${item.route}" aria-label="${item.label}">
      <span class="dock-item__icon"><svg viewBox="0 0 24 24">${item.icon}</svg></span>
      <span class="dock-item__label">${item.label}</span>
    </button>`).join('');
}

export function initDock(root, onNavigate) {
  const buttons = [...root.querySelectorAll('.dock-item')];

  root.addEventListener('click', (event) => {
    const button = event.target.closest('.dock-item');
    if (button) onNavigate(button.dataset.route);
  });

  return function setActiveDockItem(route) {
    buttons.forEach((button) => {
      const isActive = button.dataset.route === route;
      button.classList.toggle('is-active', isActive);
      if (isActive) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  };
}
