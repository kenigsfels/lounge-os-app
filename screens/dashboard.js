import { getEmployees } from '../core/employees.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderDashboardScreen() {
  const employees = getEmployees();
  const activeEmployees = employees.filter((employee) => employee.status === 'active');
  const teamRows = activeEmployees.length > 0
    ? activeEmployees.slice(0, 4).map((employee) => `<li><span>${escapeHtml(employee.position)}</span><strong>${escapeHtml(employee.name)}</strong></li>`).join('')
    : '<li><span>Сотрудники</span><strong>Команда пока пуста</strong></li>';

  return `
    <section class="view is-active" aria-labelledby="dashboardTitle">
      <div class="welcome-panel glass-panel">
        <div>
          <p class="overline">Lounge OS · Dashboard</p>
          <h1 id="dashboardTitle">Добро пожаловать</h1>
          <p>Всё необходимое для управления кальянной — в одном пространстве.</p>
        </div>
        <div class="welcome-panel__summary"><span>В команде</span><strong>${activeEmployees.length}</strong></div>
      </div>
      <div class="widget-grid">
        <article class="widget glass-panel widget--team">
          <header class="widget__header"><div><span class="widget__icon icon-blue">●</span><h2>Команда</h2></div><span class="counter">${activeEmployees.length}</span></header>
          <ul class="team-list">${teamRows}</ul>
        </article>
        <article class="widget glass-panel">
          <header class="widget__header"><div><span class="widget__icon icon-violet">⌁</span><h2>Ближайшие смены</h2></div><button class="text-button" type="button" data-route-link="schedule">Открыть</button></header>
          <div class="empty-state"><span>○</span><strong>Смен пока нет</strong><p>Добавьте первую смену в график</p></div>
        </article>
        <article class="widget glass-panel">
          <header class="widget__header"><div><span class="widget__icon icon-amber">!</span><h2>Требует внимания</h2></div><span class="counter">0</span></header>
          <div class="attention-row"><span class="checkmark">✓</span><div><strong>Всё в порядке</strong><p>Новых задач и уведомлений нет</p></div></div>
        </article>
        <article class="widget glass-panel widget--actions">
          <header class="widget__header"><div><span class="widget__icon icon-green">＋</span><h2>Быстрые действия</h2></div></header>
          <div class="action-grid"><button type="button" data-route-link="schedule"><span>＋</span>Добавить смену</button><button type="button" data-route-link="employees"><span>♙</span>Сотрудник</button><button type="button" data-route-link="warehouse"><span>□</span>Инвентаризация</button><button type="button" data-route-link="tasks"><span>✓</span>Новая задача</button></div>
        </article>
      </div>
    </section>`;
}
