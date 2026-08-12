import { buildOperationalPulse } from '../core/analytics.js';
import { getEmployees } from '../core/employees.js';
import { readScheduleSnapshot } from '../core/schedule.js';
import { getTasks } from '../core/tasks.js';
import { getWarehouseItems } from '../core/warehouse.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (symbol) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[symbol]);
}

function formatDay(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

function renderContour({ route, title, value, label, status, footnote }) {
  return `<button class="pulse-contour pulse-contour--${status}" type="button" data-route-link="${route}">
    <span class="pulse-contour__signal" aria-hidden="true"></span>
    <small>${title}</small><strong>${value}</strong><p>${label}</p><i>${footnote}</i><b aria-hidden="true">↗</b>
  </button>`;
}

function renderPulse(pulse) {
  const periodLabel = pulse.period === 'week' ? 'Ближайшие семь дней' : 'Сегодня';
  return `<div class="pulse-layout pulse-layout--${pulse.mode}">
    <section class="pulse-hero glass-panel">
      <div class="pulse-hero__top"><div><p class="overline">Операционная картина</p><h1>Пульс заведения</h1></div>
        <div class="pulse-period" role="group" aria-label="Период аналитики">
          <button type="button" data-pulse-period="today" class="${pulse.period === 'today' ? 'is-active' : ''}">Сегодня</button>
          <button type="button" data-pulse-period="week" class="${pulse.period === 'week' ? 'is-active' : ''}">Неделя</button>
        </div>
      </div>
      <div class="pulse-core" aria-label="${escapeHtml(pulse.conclusion.title)}">
        <span class="pulse-core__orbit pulse-core__orbit--one"></span><span class="pulse-core__orbit pulse-core__orbit--two"></span>
        <div><small>${periodLabel}</small><strong>${escapeHtml(pulse.conclusion.title)}</strong><p>${escapeHtml(pulse.conclusion.message)}</p></div>
      </div>
      <div class="pulse-conclusion">
        <span></span><div><small>${escapeHtml(pulse.conclusion.eyebrow)}</small><p>${escapeHtml(pulse.conclusion.detail)}</p></div>
        ${pulse.conclusion.route ? `<button type="button" data-route-link="${pulse.conclusion.route}">Посмотреть ↗</button>` : ''}
      </div>
    </section>
    <section class="pulse-contours" aria-label="Контуры заведения">
      ${renderContour({ route: 'employees', title: 'Команда', value: pulse.team.people, label: pulse.team.label, status: pulse.team.status, footnote: pulse.period === 'week' ? `Покрыто ${pulse.team.staffedDays} из 7 дней` : 'По актуальному графику' })}
      ${renderContour({ route: 'tasks', title: 'Задачи', value: pulse.tasks.open, label: pulse.tasks.label, status: pulse.tasks.status, footnote: `${pulse.tasks.completed} завершено за период` })}
      ${renderContour({ route: 'warehouse', title: 'Запасы', value: pulse.warehouse.attention, label: pulse.warehouse.label, status: pulse.warehouse.status, footnote: `${pulse.warehouse.total} позиций отслеживается` })}
    </section>
    <section class="pulse-upcoming glass-panel"><header><div><p class="overline">Ближайший ритм</p><h2>Что впереди</h2></div><span>${pulse.upcoming.length}</span></header>
      <div>${pulse.upcoming.length ? pulse.upcoming.map((day) => `<article><time>${formatDay(day.date)}</time><strong>${[...(day.administrators || []), ...(day.masters || [])].length} назначений</strong><p>${escapeHtml(day.note || 'Смена по графику')}</p></article>`).join('') : '<p class="pulse-upcoming__empty">В графике пока нет ближайших событий.</p>'}</div>
    </section>
  </div>`;
}

export function renderAnalyticsScreen() {
  return `<section class="view analytics-space is-active" aria-live="polite" data-analytics-screen><div class="pulse-loading glass-panel"><span></span><p>SYLON собирает операционную картину…</p></div></section>`;
}

export function initAnalyticsScreen(root, { showToast = () => {} } = {}) {
  const screen = root.querySelector('[data-analytics-screen]');
  let disposed = false;
  let period = 'today';
  let schedule = null;

  const paint = () => {
    if (!screen || disposed || !schedule) return;
    screen.innerHTML = renderPulse(buildOperationalPulse({ schedule, employees: getEmployees(), tasks: getTasks(), warehouse: getWarehouseItems(), period }));
  };

  const onClick = (event) => {
    const button = event.target.closest('[data-pulse-period]');
    if (!button || button.dataset.pulsePeriod === period) return;
    period = button.dataset.pulsePeriod;
    paint();
  };

  screen?.addEventListener('click', onClick);
  readScheduleSnapshot().then((value) => { schedule = value; paint(); }).catch(() => {
    showToast('Не удалось прочитать график');
    schedule = { weeks: [] };
    paint();
  });

  return () => { disposed = true; screen?.removeEventListener('click', onClick); };
}
