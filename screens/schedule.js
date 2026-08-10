import {
  getCurrentWeekIndex,
  loadScheduleData,
  parseLocalDate
} from '../core/schedule.js';
import { synchronizeSchedule } from '../core/cloud-sync.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value, options) {
  const date = parseLocalDate(value);
  return date ? new Intl.DateTimeFormat('ru-RU', options).format(date) : '';
}

function formatWeekRange(week) {
  const start = formatDate(week.start, { day: 'numeric', month: 'long' });
  const end = formatDate(week.end, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${start} — ${end}`;
}

function formatShift(value) {
  const shift = String(value ?? '');
  const match = shift.match(/^(\d{2})-01$/);
  return match ? `${match[1]}:00–01:00` : shift;
}

function renderAssignments(title, assignments, modifier) {
  if (assignments.length === 0) return '';
  return `
    <div class="schedule-day__group schedule-day__group--${modifier}">
      <span>${title}</span>
      ${assignments.map((assignment) => `
        <div class="schedule-person">
          <strong>${escapeHtml(assignment.name)}</strong>
          <small>${escapeHtml(formatShift(assignment.shift))}</small>
        </div>`).join('')}
    </div>`;
}

function renderWeek(week) {
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  return week.days.map((day) => {
    const isEmpty = day.masters.length === 0 && day.administrators.length === 0 && !day.note;
    return `
      <article class="schedule-day${day.date === todayKey ? ' is-today' : ''}${isEmpty ? ' is-empty' : ''}">
        <header class="schedule-day__heading">
          <div><span>${escapeHtml(day.dayKey)}</span><strong>${escapeHtml(formatDate(day.date, { day: '2-digit' }))}</strong></div>
          <small>${escapeHtml(formatDate(day.date, { month: 'short' }))}</small>
        </header>
        <div class="schedule-day__content">
          ${renderAssignments('Мастера', day.masters, 'masters')}
          ${renderAssignments('Администратор', day.administrators, 'admins')}
          ${day.note ? `<p class="schedule-note">${escapeHtml(day.note)}</p>` : ''}
          ${isEmpty ? '<p class="schedule-empty">Смены не назначены</p>' : ''}
        </div>
      </article>`;
  }).join('');
}

function formatSyncTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Локальный график'
    : `Google Таблицы · обновлено ${new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date)}`;
}

export function renderScheduleScreen() {
  return `
    <section class="view schedule-screen is-active" aria-labelledby="scheduleTitle">
      <header class="schedule-header glass-panel">
        <div>
          <p class="overline">Планирование · Google Sheets</p>
          <h1 id="scheduleTitle">График смен</h1>
          <p>Текущая и следующие недели из рабочей таблицы.</p>
        </div>
        <button class="schedule-source" type="button" data-schedule-source>Подключение к локальному графику…</button>
      </header>
      <section class="schedule-calendar glass-panel" aria-live="polite">
        <div class="schedule-toolbar">
          <div>
            <p class="overline">Неделя</p>
            <h2 data-schedule-range>Загрузка…</h2>
          </div>
          <div class="schedule-toolbar__actions">
            <button class="backup-button" type="button" data-schedule-action="previous" aria-label="Предыдущая неделя">←</button>
            <button class="backup-button" type="button" data-schedule-action="today">Текущая</button>
            <button class="backup-button" type="button" data-schedule-action="next" aria-label="Следующая неделя">→</button>
          </div>
        </div>
        <div class="schedule-week" data-schedule-week>
          <div class="schedule-loading">Загружаю смены…</div>
        </div>
      </section>
    </section>`;
}

export async function initScheduleScreen(root, { showToast }) {
  const weekRoot = root.querySelector('[data-schedule-week]');
  const range = root.querySelector('[data-schedule-range]');
  const source = root.querySelector('[data-schedule-source]');
  let schedule;
  let cloudConnected = false;

  try {
    const result = await synchronizeSchedule();
    schedule = result.schedule;
    cloudConnected = result.connected;
  } catch (error) {
    schedule = await loadScheduleData();
    showToast(error?.message || 'Облако недоступно, открыт локальный график');
  }

  if (!weekRoot?.isConnected) return;

  if (schedule.weeks.length === 0) {
    range.textContent = 'Нет импортированных недель';
    source.textContent = 'Google-таблица доступна в установленном приложении';
    weekRoot.innerHTML = '<div class="schedule-loading"><strong>График пока не загружен</strong><p>Запустите синхронизацию на рабочем компьютере LoungeOS.</p></div>';
    return;
  }

  let activeIndex = getCurrentWeekIndex(schedule);
  source.textContent = formatSyncTime(schedule.source?.syncedAt);
  if (cloudConnected) source.textContent += ' · Supabase';
  source.title = schedule.source?.url || '';
  source.addEventListener('click', () => {
    if (schedule.source?.url) window.open(schedule.source.url, '_blank', 'noopener');
  });

  function updateWeek() {
    const week = schedule.weeks[activeIndex];
    range.textContent = formatWeekRange(week);
    weekRoot.innerHTML = renderWeek(week);
    root.querySelector('[data-schedule-action="previous"]').disabled = activeIndex === 0;
    root.querySelector('[data-schedule-action="next"]').disabled = activeIndex === schedule.weeks.length - 1;
  }

  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-schedule-action]')?.dataset.scheduleAction;
    if (!action) return;

    if (action === 'previous' && activeIndex > 0) activeIndex -= 1;
    if (action === 'next' && activeIndex < schedule.weeks.length - 1) activeIndex += 1;
    if (action === 'today') activeIndex = getCurrentWeekIndex(schedule);
    updateWeek();
  });

  updateWeek();
  showToast(cloudConnected
    ? 'График синхронизирован с Supabase'
    : 'Открыт локальный график');
}
