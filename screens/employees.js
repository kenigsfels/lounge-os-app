import { createEmployee, deleteEmployee, getEmployees, updateEmployee } from '../core/employees.js';
import { deleteEmployeeFromCloud, saveEmployeeToCloud, synchronizeEmployees } from '../core/cloud-sync.js';
import { normalizeScheduleData, readScheduleSnapshot } from '../core/schedule.js';
import { takeNavigationContext } from '../core/navigation-context.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function formatRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? `${new Intl.NumberFormat('ru-RU').format(rate)} ₽` : 'Не указана';
}

function formatShift(value) {
  const match = String(value ?? '').match(/^(\d{2})-(\d{2})$/);
  return match ? `${match[1]}:00–${match[2]}:00` : String(value || 'Время не указано');
}

export function buildTodayTeam(schedule, today = new Date()) {
  const day = normalizeScheduleData(schedule).weeks.flatMap((week) => week.days)
    .find((item) => item.date === dateKey(today));
  if (!day) return [];
  return [
    ...day.masters.map((person) => ({ ...person, role: 'Мастер', roleKey: 'master' })),
    ...day.administrators.map((person) => ({ ...person, role: 'Администратор', roleKey: 'admin' }))
  ];
}

function groupByRole(employees) {
  const groups = new Map();
  employees.filter((employee) => employee.status === 'active').forEach((employee) => {
    const role = employee.position || 'Без роли';
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(employee);
  });
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, 'ru-RU'));
}

function renderPersonCard(employee) {
  return `
    <button class="team-person" type="button" data-team-person="${escapeHtml(employee.id)}">
      <span class="team-person__avatar">${escapeHtml(employee.name.charAt(0).toUpperCase())}</span>
      <span><strong>${escapeHtml(employee.name)}</strong><small>${escapeHtml(employee.position)}</small></span>
      <i aria-hidden="true"></i><b>Открыть ↗</b>
    </button>`;
}

function renderDirectory(employees) {
  const groups = groupByRole(employees);
  if (groups.length === 0) {
    return '<div class="team-empty"><span>○</span><strong>Команда пока не собрана</strong><p>Добавь первого человека — роли и рабочие связи появятся автоматически.</p></div>';
  }
  return groups.map(([role, people]) => `
    <section class="team-role" aria-labelledby="teamRole${escapeHtml(role).replace(/\s/g, '')}">
      <header><div><small>Роль</small><h2 id="teamRole${escapeHtml(role).replace(/\s/g, '')}">${escapeHtml(role)}</h2></div><span>${people.length}</span></header>
      <div class="team-role__people">${people.map(renderPersonCard).join('')}</div>
    </section>`).join('');
}

function renderInactive(employees) {
  const inactive = employees.filter((employee) => employee.status === 'inactive');
  return `
    <details class="team-inactive glass-panel">
      <summary><span><small>Вне основного состава</small><strong>Неактивные сотрудники</strong></span><b>${inactive.length}</b></summary>
      <div>${inactive.length > 0 ? inactive.map(renderPersonCard).join('') : '<p>Здесь появятся сотрудники, выведенные из активного состава.</p>'}</div>
    </details>`;
}

function renderTodayRoster(people) {
  if (people.length === 0) {
    return '<div class="team-today__empty"><span>—</span><div><strong>На сегодня никто не назначен</strong><p>Если это не выходной, стоит проверить график смен.</p></div></div>';
  }
  return `<div class="team-today__people">${people.map((person) => `
    <article class="team-today-person team-today-person--${person.roleKey}">
      <span>${escapeHtml(person.name.charAt(0).toUpperCase())}</span><div><small>${person.role}</small><strong>${escapeHtml(person.name)}</strong><p>${escapeHtml(formatShift(person.shift))}</p></div>
    </article>`).join('')}</div>`;
}

function renderProfile(employee) {
  return `
    <div class="team-profile" data-team-profile>
      <div class="team-profile__hero"><span>${escapeHtml(employee.name.charAt(0).toUpperCase())}</span><small>${employee.status === 'active' ? 'В активной команде' : 'Неактивен'}</small><h2>${escapeHtml(employee.name)}</h2><p>${escapeHtml(employee.position)}</p></div>
      <dl class="team-profile__facts">
        <div><dt>Телефон</dt><dd>${escapeHtml(employee.phone || 'Не указан')}</dd></div>
        <div><dt>Ставка</dt><dd>${escapeHtml(formatRate(employee.rate))}</dd></div>
        <div><dt>В команде с</dt><dd>${escapeHtml(employee.startDate || 'Не указано')}</dd></div>
      </dl>
      ${employee.notes ? `<div class="team-profile__notes"><small>Контекст</small><p>${escapeHtml(employee.notes)}</p></div>` : ''}
      <div class="team-profile__future"><span>⌁</span><div><strong>Рабочие связи</strong><p>Задачи и смены этого человека появятся здесь на следующем этапе.</p></div></div>
      <div class="team-profile__actions"><button class="team-delete" type="button" data-team-delete>Удалить</button><button class="primary-button" type="button" data-team-edit>Редактировать</button></div>
    </div>`;
}

function renderEmployeeForm(employee = null) {
  return `
    <form class="team-form" data-team-form>
      <input type="hidden" name="employeeId" value="${escapeHtml(employee?.id || '')}">
      <div class="team-form__heading"><p class="overline">Карточка человека</p><h2>${employee ? 'Редактирование' : 'Новый сотрудник'}</h2></div>
      <label class="field"><span>Имя *</span><input name="name" required autocomplete="name" value="${escapeHtml(employee?.name || '')}" placeholder="Имя сотрудника"></label>
      <label class="field"><span>Роль *</span><input name="position" required value="${escapeHtml(employee?.position || '')}" placeholder="Например, администратор"></label>
      <label class="field"><span>Телефон</span><input name="phone" autocomplete="tel" value="${escapeHtml(employee?.phone || '')}" placeholder="+7 900 000-00-00"></label>
      <div class="team-form__pair"><label class="field"><span>Ставка, ₽</span><input name="rate" type="number" min="0" step="1" value="${employee?.rate || ''}"></label><label class="field"><span>Начало работы</span><input name="startDate" type="date" value="${escapeHtml(employee?.startDate || '')}"></label></div>
      <label class="field"><span>Статус</span><select name="status"><option value="active" ${employee?.status !== 'inactive' ? 'selected' : ''}>Работает</option><option value="inactive" ${employee?.status === 'inactive' ? 'selected' : ''}>Неактивен</option></select></label>
      <label class="field"><span>Заметки</span><textarea name="notes" rows="3" placeholder="Что важно знать">${escapeHtml(employee?.notes || '')}</textarea></label>
      <p class="form-error" data-team-error role="alert"></p>
      <div class="team-form__actions">${employee ? '<button class="secondary-button" type="button" data-team-back>Назад</button>' : ''}<button class="primary-button" type="submit">Сохранить</button></div>
    </form>`;
}

export function renderEmployeesScreen() {
  const employees = getEmployees();
  const active = employees.filter((employee) => employee.status === 'active').length;
  return `
    <section class="view team-space is-active" aria-labelledby="employeesTitle">
      <header class="team-space-header glass-panel">
        <div><p class="overline">Люди SYLON</p><h1 id="employeesTitle">Команда</h1><p>Те, кто создаёт рабочий ритм заведения.</p></div>
        <div class="team-space-header__status"><span></span><p>${active} в активном составе</p></div>
        <button class="primary-button" type="button" data-team-add>＋ Добавить человека</button>
      </header>
      <section class="team-today glass-panel" aria-labelledby="teamTodayTitle">
        <header><div><p class="overline">Кто сегодня рядом</p><h2 id="teamTodayTitle">Сегодняшняя смена</h2></div><a href="#schedule">Открыть график ↗</a></header>
        <div data-team-today><div class="team-today__loading">Смотрю на сегодняшний график…</div></div>
      </section>
      <section class="team-directory-space glass-panel" aria-labelledby="teamDirectoryTitle">
        <header><div><p class="overline">Основной состав</p><h2 id="teamDirectoryTitle">Команда по ролям</h2></div><span>${active} человек</span></header>
        <div class="team-roles" data-team-directory>${renderDirectory(employees)}</div>
      </section>
      <div data-team-inactive>${renderInactive(employees)}</div>
      <dialog class="team-drawer" data-team-drawer><button class="team-drawer__close" type="button" data-team-close aria-label="Закрыть профиль">×</button><div data-team-drawer-content></div></dialog>
    </section>`;
}

export function initEmployeesScreen(root, { showToast = () => {} } = {}) {
  const screen = root.querySelector('.team-space');
  const drawer = root.querySelector('[data-team-drawer]');
  const drawerContent = root.querySelector('[data-team-drawer-content]');
  const todayRoot = root.querySelector('[data-team-today]');
  let selectedId = '';
  let disposed = false;
  if (!screen || !drawer || !drawerContent) return () => {};
  const mapContext = takeNavigationContext('employees');

  const refresh = () => {
    const employees = getEmployees();
    const active = employees.filter((employee) => employee.status === 'active').length;
    root.querySelector('[data-team-directory]').innerHTML = renderDirectory(employees);
    root.querySelector('[data-team-inactive]').innerHTML = renderInactive(employees);
    const status = root.querySelector('.team-space-header__status p');
    if (status) status.textContent = `${active} в активном составе`;
    const count = root.querySelector('.team-directory-space > header > span');
    if (count) count.textContent = `${active} человек`;
  };

  const openProfile = (employee) => {
    selectedId = employee.id;
    drawerContent.innerHTML = renderProfile(employee);
    if (!drawer.open) drawer.showModal();
  };

  const openForm = (employee = null) => {
    selectedId = employee?.id || '';
    drawerContent.innerHTML = renderEmployeeForm(employee);
    if (!drawer.open) drawer.showModal();
    drawerContent.querySelector('[name="name"]')?.focus();
  };

  const onScreenClick = (event) => {
    if (event.target.closest('[data-team-add]')) return openForm();
    const person = event.target.closest('[data-team-person]');
    if (person) {
      const employee = getEmployees().find((item) => item.id === person.dataset.teamPerson);
      if (employee) openProfile(employee);
    }
  };

  const onDrawerClick = (event) => {
    if (event.target === drawer || event.target.closest('[data-team-close]')) return drawer.close();
    const employee = getEmployees().find((item) => item.id === selectedId);
    if (event.target.closest('[data-team-edit]') && employee) return openForm(employee);
    if (event.target.closest('[data-team-back]') && employee) return openProfile(employee);
    if (event.target.closest('[data-team-delete]') && employee) {
      if (!globalThis.confirm(`Удалить сотрудника «${employee.name}»?`)) return;
      if (deleteEmployee(employee.id)) {
        drawer.close(); refresh(); showToast('Сотрудник удалён');
        deleteEmployeeFromCloud(employee.id).catch(() => showToast('Удалено локально; облако временно недоступно'));
      }
    }
  };

  const onDrawerSubmit = (event) => {
    const form = event.target.closest('[data-team-form]');
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const result = data.employeeId ? updateEmployee(data.employeeId, data) : createEmployee(data);
    if (!result.success) {
      form.querySelector('[data-team-error]').textContent = result.errors.join('. ');
      return;
    }
    refresh(); openProfile(result.employee);
    showToast(data.employeeId ? 'Данные сотрудника обновлены' : 'Сотрудник добавлен');
    saveEmployeeToCloud(result.employee).catch(() => showToast('Сохранено локально; облако временно недоступно'));
  };

  const loadToday = async () => {
    const schedule = await readScheduleSnapshot();
    if (!disposed && todayRoot) todayRoot.innerHTML = renderTodayRoster(buildTodayTeam(schedule));
  };

  screen.addEventListener('click', onScreenClick);
  drawer.addEventListener('click', onDrawerClick);
  drawer.addEventListener('submit', onDrawerSubmit);
  loadToday().catch(() => { if (!disposed && todayRoot) todayRoot.innerHTML = renderTodayRoster([]); });
  synchronizeEmployees().then((result) => { if (!disposed && result.connected) refresh(); }).catch(() => {});
  requestAnimationFrame(() => {
    const target = mapContext?.type === 'employees-directory'
      ? screen.querySelector('.team-directory-space')
      : mapContext?.type === 'employees-onboarding' ? screen.querySelector('.team-today') : null;
    target?.classList.add('is-map-arrival');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  return () => {
    disposed = true;
    if (drawer.open) drawer.close();
    screen.removeEventListener('click', onScreenClick);
    drawer.removeEventListener('click', onDrawerClick);
    drawer.removeEventListener('submit', onDrawerSubmit);
  };
}
