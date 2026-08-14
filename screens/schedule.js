import {
  getCurrentWeekIndex,
  getUpcomingDays,
  hasScheduleData,
  loadScheduleData,
  normalizeScheduleData,
  parseLocalDate,
  saveScheduleData
} from '../core/schedule.js';
import { synchronizeSchedule } from '../core/cloud-sync.js';
import { takeNavigationContext } from '../core/navigation-context.js';

let rememberedScheduleView = 'today';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
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
  const shift = String(value ?? '').trim();
  const match = shift.match(/^(\d{2})-(\d{2})$/);
  return match ? `${match[1]}:00–${match[2]}:00` : shift || 'Время не указано';
}

function shiftStart(value) {
  const match = String(value ?? '').match(/^(\d{2})/);
  return match ? Number(match[1]) : 99;
}

export function getTodayScheduleDay(schedule, today = new Date()) {
  const normalized = normalizeScheduleData(schedule);
  const key = toDateKey(today);
  return normalized.weeks.flatMap((week) => week.days).find((day) => day.date === key) || null;
}

export function buildScheduleTimeline(day) {
  if (!day) return [];
  return [
    ...day.masters.map((assignment) => ({ ...assignment, role: 'Мастер', roleKey: 'master' })),
    ...day.administrators.map((assignment) => ({ ...assignment, role: 'Администратор', roleKey: 'admin' }))
  ].sort((left, right) => shiftStart(left.shift) - shiftStart(right.shift));
}

export function getScheduleDayState(day) {
  const timeline = buildScheduleTimeline(day);
  if (!day || timeline.length === 0) {
    return {
      id: 'empty',
      label: 'Нужно уточнение',
      title: 'Сегодня смена не собрана',
      detail: day?.note || 'Проверь, выходной это или в графике пока нет назначений.'
    };
  }
  if (day.masters.length === 0 || day.administrators.length === 0) {
    return {
      id: 'partial',
      label: 'Стоит проверить',
      title: 'Состав заполнен частично',
      detail: day.masters.length === 0 ? 'Мастера пока не назначены.' : 'Администратор пока не назначен.'
    };
  }
  return {
    id: 'ready',
    label: 'Смена собрана',
    title: 'Сегодня всё на своих местах',
    detail: `${timeline.length} ${timeline.length === 1 ? 'человек' : timeline.length < 5 ? 'человека' : 'человек'} в сегодняшнем графике.`
  };
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

function renderWeek(week, today = new Date()) {
  const todayKey = toDateKey(today);
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
    : `Обновлено ${new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      }).format(date)}`;
}

function renderTimeline(day) {
  const timeline = buildScheduleTimeline(day);
  if (timeline.length === 0) {
    return `
      <div class="shift-timeline__empty">
        <span>—</span><strong>Назначений пока нет</strong><p>Когда график появится, здесь выстроится маршрут всей смены.</p>
      </div>`;
  }
  return `
    <div class="shift-timeline__track" aria-label="Линия сегодняшней смены">
      ${timeline.map((assignment, index) => `
        <article class="shift-person shift-person--${assignment.roleKey}" style="--shift-index:${index}">
          <span class="shift-person__time">${escapeHtml(formatShift(assignment.shift).split('–')[0])}</span>
          <i aria-hidden="true"></i>
          <div><small>${assignment.role}</small><strong>${escapeHtml(assignment.name)}</strong><p>${escapeHtml(formatShift(assignment.shift))}</p></div>
        </article>`).join('')}
    </div>`;
}

function renderUpcoming(schedule, today) {
  const currentKey = toDateKey(today);
  const upcoming = getUpcomingDays(schedule, today, 6).filter((day) => day.date > currentKey).slice(0, 4);
  if (upcoming.length === 0) {
    return '<div class="schedule-upcoming__empty">Следующие заполненные смены пока не найдены.</div>';
  }
  return upcoming.map((day) => {
    const people = [...new Set([...day.masters, ...day.administrators].map((item) => item.name))];
    return `
      <article class="schedule-upcoming-card">
        <time datetime="${escapeHtml(day.date)}"><strong>${escapeHtml(formatDate(day.date, { day: '2-digit' }))}</strong><span>${escapeHtml(formatDate(day.date, { month: 'short' }))}</span></time>
        <div><small>${escapeHtml(day.dayLabel || day.dayKey || 'Следующая смена')}</small><strong>${people.length > 0 ? escapeHtml(people.join(', ')) : 'Состав не назначен'}</strong>${day.note ? `<p>${escapeHtml(day.note)}</p>` : ''}</div>
        <span>${people.length}</span>
      </article>`;
  }).join('');
}

function renderTodayView(schedule, today = new Date()) {
  const day = getTodayScheduleDay(schedule, today);
  const state = getScheduleDayState(day);
  const fullDate = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(today);
  return `
    <div class="schedule-today-view" data-schedule-view-panel="today">
      <section class="schedule-today-hero schedule-today-hero--${state.id} glass-panel">
        <div class="schedule-today-hero__date"><p class="overline">Сегодня</p><time datetime="${toDateKey(today)}">${escapeHtml(fullDate)}</time></div>
        <div class="schedule-today-hero__state"><span aria-hidden="true"></span><div><small>${escapeHtml(state.label)}</small><h2>${escapeHtml(state.title)}</h2><p>${escapeHtml(state.detail)}</p></div></div>
        ${day?.note ? `<aside><small>Заметка смены</small><p>${escapeHtml(day.note)}</p></aside>` : ''}
      </section>
      <section class="shift-timeline glass-panel" aria-labelledby="shiftTimelineTitle">
        <header><div><p class="overline">Ход смены</p><h2 id="shiftTimelineTitle">Временная линия</h2></div><span>${buildScheduleTimeline(day).length} в составе</span></header>
        ${renderTimeline(day)}
      </section>
      <section class="schedule-upcoming glass-panel" aria-labelledby="scheduleUpcomingTitle">
        <header><div><p class="overline">Следующий горизонт</p><h2 id="scheduleUpcomingTitle">Ближайшие дни</h2></div><button type="button" data-schedule-view="week">Открыть всю неделю ↗</button></header>
        <div class="schedule-upcoming__grid">${renderUpcoming(schedule, today)}</div>
      </section>
    </div>`;
}

function renderWeekView(schedule, activeIndex) {
  const week = schedule.weeks[activeIndex];
  return `
    <section class="schedule-calendar schedule-week-view glass-panel" data-schedule-view-panel="week" aria-labelledby="scheduleWeekTitle">
      <div class="schedule-toolbar">
        <div><p class="overline">Вся неделя</p><h2 id="scheduleWeekTitle">${escapeHtml(formatWeekRange(week))}</h2></div>
        <div class="schedule-toolbar__actions">
          <button class="backup-button" type="button" data-schedule-action="previous" aria-label="Предыдущая неделя" ${activeIndex === 0 ? 'disabled' : ''}>←</button>
          <button class="backup-button" type="button" data-schedule-action="today">Текущая</button>
          <button class="backup-button" type="button" data-schedule-action="next" aria-label="Следующая неделя" ${activeIndex === schedule.weeks.length - 1 ? 'disabled' : ''}>→</button>
        </div>
      </div>
      <div class="schedule-week">${renderWeek(week)}</div>
    </section>`;
}

function renderMissingSchedule() {
  return `
    <section class="schedule-missing glass-panel" data-schedule-view-panel="today">
      <span class="schedule-missing__mark" aria-hidden="true">⌁</span>
      <p class="overline">График не подключён</p>
      <h2>Здесь появится ритм смены</h2>
      <p>Импортируй график или запусти синхронизацию на рабочем компьютере. SYLON ничего не будет заполнять автоматически.</p>
      <button class="primary-button" type="button" data-schedule-empty-import>Импортировать график</button>
    </section>`;
}

export function renderScheduleScreen() {
  return `
    <section class="view schedule-screen schedule-space is-active" aria-labelledby="scheduleTitle">
      <header class="schedule-space-header glass-panel">
        <div><p class="overline">Живой график</p><h1 id="scheduleTitle">График смен</h1><p>Сегодняшний ритм и ближайшие дни.</p></div>
        <div class="schedule-space-header__service">
          <button class="schedule-source" type="button" data-schedule-source>Проверяю источник…</button>
          <button class="backup-button" type="button" data-schedule-import-button>Импорт JSON</button>
          <input type="file" accept="application/json,.json" data-schedule-import hidden>
        </div>
        <nav class="schedule-view-switch" aria-label="Режим графика">
          <button type="button" data-schedule-view="today">Сегодня</button>
          <button type="button" data-schedule-view="week">Вся неделя</button>
        </nav>
      </header>
      <div class="schedule-space__content" data-schedule-content aria-live="polite">
        <div class="schedule-loading glass-panel">Собираю смену…</div>
      </div>
    </section>`;
}

export function initScheduleScreen(root, { showToast = () => {} } = {}) {
  const screen = root.querySelector('.schedule-space');
  const content = root.querySelector('[data-schedule-content]');
  const source = root.querySelector('[data-schedule-source]');
  const importInput = root.querySelector('[data-schedule-import]');
  const importButton = root.querySelector('[data-schedule-import-button]');
  let schedule = normalizeScheduleData(null);
  let activeIndex = 0;
  let cloudConnected = false;
  let disposed = false;
  const mapContext = takeNavigationContext('schedule');
  let contextApplied = false;
  if (mapContext?.type === 'schedule-view' && ['today', 'week'].includes(mapContext.value)) rememberedScheduleView = mapContext.value;

  const updateSwitch = () => {
    screen?.querySelectorAll('[data-schedule-view]').forEach((button) => {
      const active = button.dataset.scheduleView === rememberedScheduleView;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
  };

  const renderActiveView = () => {
    if (!content || disposed) return;
    updateSwitch();
    if (!hasScheduleData(schedule)) {
      content.innerHTML = renderMissingSchedule();
      if (!contextApplied && mapContext?.type === 'schedule-view') {
        contextApplied = true;
        requestAnimationFrame(() => content.querySelector('[data-schedule-view-panel]')?.classList.add('is-map-arrival'));
      }
      return;
    }
    content.innerHTML = rememberedScheduleView === 'week'
      ? renderWeekView(schedule, activeIndex)
      : renderTodayView(schedule);
    if (!contextApplied && mapContext?.type === 'schedule-view') {
      contextApplied = true;
      requestAnimationFrame(() => {
        const target = content.querySelector(`[data-schedule-view-panel="${mapContext.value}"]`);
        target?.classList.add('is-map-arrival');
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const updateSource = () => {
    if (!source) return;
    if (!hasScheduleData(schedule)) {
      source.textContent = 'Источник не подключён';
      source.classList.add('is-missing');
      return;
    }
    source.classList.remove('is-missing');
    source.textContent = formatSyncTime(schedule.source?.syncedAt);
    if (cloudConnected) source.textContent += ' · Supabase';
    source.title = schedule.source?.url || '';
  };

  const loadAndRender = async () => {
    try {
      const result = await synchronizeSchedule();
      schedule = normalizeScheduleData(result.schedule);
      cloudConnected = result.connected;
    } catch (error) {
      schedule = await loadScheduleData();
      if (!disposed) showToast(error?.message || 'Облако недоступно, открыт локальный график');
    }
    if (disposed) return;
    activeIndex = getCurrentWeekIndex(schedule);
    updateSource();
    renderActiveView();
    if (hasScheduleData(schedule)) showToast(cloudConnected ? 'График синхронизирован с Supabase' : 'Открыт локальный график');
  };

  const onImportClick = () => importInput?.click();
  const onImportChange = async () => {
    const file = importInput?.files?.[0];
    if (!file) return;
    try {
      const imported = normalizeScheduleData(JSON.parse(await file.text()));
      if (!hasScheduleData(imported)) throw new Error('В файле нет недель графика');
      saveScheduleData(imported);
      const result = await synchronizeSchedule();
      schedule = normalizeScheduleData(result.schedule || imported);
      cloudConnected = result.connected;
      activeIndex = getCurrentWeekIndex(schedule);
      updateSource();
      renderActiveView();
      showToast(result.connected ? 'График импортирован и отправлен в Supabase' : 'График импортирован локально');
    } catch (error) {
      showToast(error?.message || 'Не удалось импортировать график');
    } finally {
      if (importInput) importInput.value = '';
    }
  };

  const onScreenClick = (event) => {
    if (event.target.closest('[data-schedule-empty-import]')) return onImportClick();
    const view = event.target.closest('[data-schedule-view]')?.dataset.scheduleView;
    if (view) {
      rememberedScheduleView = view;
      renderActiveView();
      return;
    }
    const action = event.target.closest('[data-schedule-action]')?.dataset.scheduleAction;
    if (action) {
      if (action === 'previous' && activeIndex > 0) activeIndex -= 1;
      if (action === 'next' && activeIndex < schedule.weeks.length - 1) activeIndex += 1;
      if (action === 'today') activeIndex = getCurrentWeekIndex(schedule);
      renderActiveView();
      return;
    }
    if (event.target.closest('[data-schedule-source]') && schedule.source?.url) {
      window.open(schedule.source.url, '_blank', 'noopener');
    }
  };

  importButton?.addEventListener('click', onImportClick);
  importInput?.addEventListener('change', onImportChange);
  screen?.addEventListener('click', onScreenClick);
  loadAndRender();

  return () => {
    disposed = true;
    importButton?.removeEventListener('click', onImportClick);
    importInput?.removeEventListener('change', onImportChange);
    screen?.removeEventListener('click', onScreenClick);
  };
}
