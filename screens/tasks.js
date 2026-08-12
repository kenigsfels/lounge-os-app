import { getEmployees } from '../core/employees.js';
import { createTask, deleteTask, getTaskOverview, getTasks, setTaskCompleted, updateTask } from '../core/tasks.js';

const LANE_LABELS = { now: 'Сейчас', today: 'Сегодня', later: 'Позже' };

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
    .format(new Date(`${value}T12:00:00`));
}

function getAssignee(task, employees) {
  return employees.find((employee) => employee.id === task.assigneeId)?.name || '';
}

function renderTaskMeta(task, employees, currentDay) {
  const assignee = getAssignee(task, employees);
  const overdue = task.dueDate && task.dueDate < currentDay;
  const pieces = [];
  if (assignee) pieces.push(`<span class="task-chip task-chip--person">${escapeHtml(assignee)}</span>`);
  if (task.dueDate) {
    pieces.push(`<span class="task-chip ${overdue ? 'task-chip--overdue' : ''}">${overdue ? 'Срок прошёл · ' : ''}${escapeHtml(formatDate(task.dueDate))}${task.dueTime ? ` · ${escapeHtml(task.dueTime)}` : ''}</span>`);
  }
  if (task.shiftDate) pieces.push(`<span class="task-chip">Смена · ${escapeHtml(formatDate(task.shiftDate))}</span>`);
  return pieces.length > 0 ? pieces.join('') : '<span class="task-chip task-chip--quiet">Без деталей</span>';
}

function renderTaskCard(task, employees, currentDay, expandedId) {
  const expanded = expandedId === task.id;
  return `
    <article class="task-card ${expanded ? 'is-expanded' : ''}" data-task-id="${escapeHtml(task.id)}">
      <div class="task-card__row">
        <button class="task-check" type="button" data-task-complete aria-label="Выполнить задачу"><span></span></button>
        <button class="task-card__summary" type="button" data-task-toggle aria-expanded="${expanded}">
          <strong>${escapeHtml(task.title)}</strong>
          <span class="task-card__meta">${renderTaskMeta(task, employees, currentDay)}</span>
        </button>
        <button class="task-card__expand" type="button" data-task-toggle aria-label="${expanded ? 'Свернуть' : 'Раскрыть'} задачу">⌄</button>
      </div>
      <form class="task-editor" data-task-editor ${expanded ? '' : 'hidden'}>
        <label class="task-field task-field--wide"><span>Задача</span><input name="title" value="${escapeHtml(task.title)}" required></label>
        <label class="task-field"><span>Поток</span><select name="lane">${Object.entries(LANE_LABELS).map(([value, label]) => `<option value="${value}" ${task.lane === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="task-field"><span>Ответственный</span><select name="assigneeId"><option value="">Не назначен</option>${employees.filter((employee) => employee.status === 'active').map((employee) => `<option value="${escapeHtml(employee.id)}" ${task.assigneeId === employee.id ? 'selected' : ''}>${escapeHtml(employee.name)}</option>`).join('')}</select></label>
        <label class="task-field"><span>Срок</span><input name="dueDate" type="date" value="${escapeHtml(task.dueDate)}"></label>
        <label class="task-field"><span>Время</span><input name="dueTime" type="time" value="${escapeHtml(task.dueTime)}"></label>
        <label class="task-field"><span>Связать со сменой</span><input name="shiftDate" type="date" value="${escapeHtml(task.shiftDate)}"></label>
        <label class="task-field task-field--wide"><span>Контекст</span><textarea name="notes" rows="2" placeholder="Что важно знать перед выполнением">${escapeHtml(task.notes)}</textarea></label>
        <div class="task-editor__actions"><button class="task-delete-button" type="button" data-task-delete>Удалить</button><span></span><button class="secondary-button" type="button" data-task-collapse>Закрыть</button><button class="primary-button" type="submit">Сохранить</button></div>
      </form>
    </article>`;
}

function renderLane(key, title, subtitle, tasks, employees, overview, expandedId) {
  return `
    <section class="task-lane task-lane--${key}" aria-labelledby="taskLane${key}">
      <header><div><p>${escapeHtml(subtitle)}</p><h2 id="taskLane${key}">${escapeHtml(title)}</h2></div><span>${tasks.length}</span></header>
      <div class="task-lane__list">
        ${tasks.length > 0
          ? tasks.map((task) => renderTaskCard(task, employees, overview.currentDay, expandedId)).join('')
          : `<div class="task-lane__empty"><i></i><p>${key === 'now' ? 'Фокус свободен' : key === 'today' ? 'Добавь первое действие' : 'Пока ничего не отложено'}</p></div>`}
      </div>
    </section>`;
}

function renderFocus(overview, employees) {
  if (!overview.focus) {
    return `
      <div class="task-focus__empty"><span>○</span><div><strong>Сегодня можно двигаться спокойно</strong><p>Добавь задачу — SYLON поможет удержать главное в фокусе.</p></div></div>`;
  }
  const task = overview.focus;
  return `
    <button class="task-focus__content" type="button" data-task-focus="${escapeHtml(task.id)}">
      <span class="task-focus__pulse" aria-hidden="true"></span>
      <span><small>${escapeHtml(overview.focusReason)}</small><strong>${escapeHtml(task.title)}</strong><i>${renderTaskMeta(task, employees, overview.currentDay)}</i></span>
      <b>Открыть ↗</b>
    </button>`;
}

function renderHistory(tasks, employees) {
  return `
    <details class="task-history glass-panel">
      <summary><span><small>Архив действий</small><strong>Выполнено</strong></span><b>${tasks.length}</b></summary>
      <div class="task-history__list">
        ${tasks.length > 0 ? tasks.map((task) => `
          <article data-task-id="${escapeHtml(task.id)}"><span>✓</span><div><strong>${escapeHtml(task.title)}</strong><small>${getAssignee(task, employees) ? escapeHtml(getAssignee(task, employees)) : 'Без ответственного'}</small></div><button type="button" data-task-reopen>Вернуть</button></article>`).join('') : '<p>Здесь появятся завершённые задачи.</p>'}
      </div>
    </details>`;
}

function renderTasksContent(tasks, employees, expandedId = '') {
  const overview = getTaskOverview(tasks);
  const attentionLabel = overview.overdue.length === 1
    ? '1 требует внимания'
    : `${overview.overdue.length} требуют внимания`;
  return `
    <section class="task-focus glass-panel" aria-labelledby="taskFocusTitle">
      <header><p class="overline">Фокус дня</p><span>${overview.overdue.length > 0 ? attentionLabel : `${overview.open.length} в работе`}</span></header>
      <h2 id="taskFocusTitle" class="visually-hidden">Главная задача дня</h2>
      ${renderFocus(overview, employees)}
    </section>
    <div class="task-streams">
      ${renderLane('now', 'Сейчас', 'Текущий фокус', overview.now, employees, overview, expandedId)}
      ${renderLane('today', 'Сегодня', 'Рабочий ритм', overview.today, employees, overview, expandedId)}
      ${renderLane('later', 'Позже', 'Следующий горизонт', overview.later, employees, overview, expandedId)}
    </div>
    ${renderHistory(overview.completed, employees)}`;
}

export function renderTasksScreen() {
  const tasks = getTasks();
  const employees = getEmployees();
  const overview = getTaskOverview(tasks);
  return `
    <section class="view tasks-screen is-active" aria-labelledby="tasksTitle">
      <header class="tasks-header glass-panel">
        <div class="tasks-header__copy"><p class="overline">Рабочий фокус</p><h1 id="tasksTitle">Задачи</h1><p>Только то, что действительно требует движения.</p></div>
        <div class="tasks-header__signal" data-task-header-signal><span class="${overview.overdue.length > 0 ? 'is-attention' : ''}"></span><p>${overview.overdue.length > 0 ? 'Есть просроченное' : 'Ритм спокойный'}</p></div>
        <form class="task-quick-add" data-task-quick-add>
          <label class="visually-hidden" for="newTaskTitle">Новая задача</label>
          <span aria-hidden="true">＋</span><input id="newTaskTitle" name="title" autocomplete="off" placeholder="Что нужно сделать?" required>
          <button type="submit">Добавить</button>
        </form>
      </header>
      <div data-task-content>${renderTasksContent(tasks, employees)}</div>
    </section>`;
}

export function initTasksScreen(root, { showToast = () => {} } = {}) {
  const screen = root.querySelector('.tasks-screen');
  const content = root.querySelector('[data-task-content]');
  const quickForm = root.querySelector('[data-task-quick-add]');
  let expandedId = '';
  if (!screen || !content || !quickForm) return () => {};

  const refresh = () => {
    const tasks = getTasks();
    const overview = getTaskOverview(tasks);
    content.innerHTML = renderTasksContent(tasks, getEmployees(), expandedId);
    const signal = screen.querySelector('[data-task-header-signal]');
    signal?.querySelector('span')?.classList.toggle('is-attention', overview.overdue.length > 0);
    if (signal?.querySelector('p')) signal.querySelector('p').textContent = overview.overdue.length > 0 ? 'Есть просроченное' : 'Ритм спокойный';
  };

  const onQuickSubmit = (event) => {
    event.preventDefault();
    const input = quickForm.elements.title;
    const result = createTask({ title: input.value, lane: 'today' });
    if (!result.success) return showToast(result.errors.join('. '));
    input.value = '';
    expandedId = result.task.id;
    refresh();
    showToast('Задача добавлена в «Сегодня»');
  };

  const onContentClick = (event) => {
    const card = event.target.closest('[data-task-id]');
    const taskId = card?.dataset.taskId;
    const focusButton = event.target.closest('[data-task-focus]');

    if (focusButton) {
      expandedId = focusButton.dataset.taskFocus;
      refresh();
      requestAnimationFrame(() => content.querySelector(`[data-task-id="${expandedId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    if (!taskId) return;
    if (event.target.closest('[data-task-complete]')) {
      const result = setTaskCompleted(taskId, true);
      if (result.success) {
        expandedId = '';
        refresh();
        showToast('Задача выполнена');
      }
      return;
    }
    if (event.target.closest('[data-task-reopen]')) {
      const result = setTaskCompleted(taskId, false);
      if (result.success) {
        refresh();
        showToast('Задача возвращена в работу');
      }
      return;
    }
    if (event.target.closest('[data-task-delete]')) {
      const task = getTasks().find((item) => item.id === taskId);
      if (!task || !globalThis.confirm(`Удалить задачу «${task.title}»?`)) return;
      if (deleteTask(taskId)) {
        expandedId = '';
        refresh();
        showToast('Задача удалена');
      }
      return;
    }
    if (event.target.closest('[data-task-toggle]')) {
      expandedId = expandedId === taskId ? '' : taskId;
      refresh();
      return;
    }
    if (event.target.closest('[data-task-collapse]')) {
      expandedId = '';
      refresh();
    }
  };

  const onContentSubmit = (event) => {
    const form = event.target.closest('[data-task-editor]');
    if (!form) return;
    event.preventDefault();
    const card = form.closest('[data-task-id]');
    const result = updateTask(card.dataset.taskId, Object.fromEntries(new FormData(form)));
    if (!result.success) return showToast(result.errors.join('. '));
    expandedId = '';
    refresh();
    showToast('Задача обновлена');
  };

  quickForm.addEventListener('submit', onQuickSubmit);
  content.addEventListener('click', onContentClick);
  content.addEventListener('submit', onContentSubmit);
  return () => {
    quickForm.removeEventListener('submit', onQuickSubmit);
    content.removeEventListener('click', onContentClick);
    content.removeEventListener('submit', onContentSubmit);
  };
}
