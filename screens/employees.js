import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee
} from '../core/employees.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0
    ? `${new Intl.NumberFormat('ru-RU').format(rate)} ₽`
    : 'Не указана';
}

function renderEmployeeCards(employees) {
  if (employees.length === 0) {
    return `
      <div class="employee-empty">
        <span>♙</span>
        <strong>Команда пока пуста</strong>
        <p>Добавьте первого сотрудника, чтобы начать вести график и выплаты.</p>
      </div>`;
  }

  return employees.map((employee) => `
    <article class="employee-card" data-employee-id="${escapeHtml(employee.id)}">
      <div class="employee-avatar">${escapeHtml(employee.name.charAt(0).toUpperCase())}</div>
      <div class="employee-card__main">
        <div class="employee-card__title">
          <div>
            <h3>${escapeHtml(employee.name)}</h3>
            <p>${escapeHtml(employee.position)}</p>
          </div>
          <span class="employee-status employee-status--${employee.status}">
            ${employee.status === 'active' ? 'Работает' : 'Неактивен'}
          </span>
        </div>
        <dl class="employee-meta">
          <div><dt>Телефон</dt><dd>${escapeHtml(employee.phone || 'Не указан')}</dd></div>
          <div><dt>Ставка</dt><dd>${formatRate(employee.rate)}</dd></div>
        </dl>
      </div>
      <div class="employee-card__actions">
        <button type="button" data-employee-edit>Изменить</button>
        <button type="button" class="button-danger" data-employee-delete>Удалить</button>
      </div>
    </article>`).join('');
}

function renderEmployeeStats(employees) {
  const active = employees.filter((employee) => employee.status === 'active').length;
  return `
    <div><span>Всего</span><strong>${employees.length}</strong></div>
    <div><span>Работают</span><strong>${active}</strong></div>
    <div><span>Неактивны</span><strong>${employees.length - active}</strong></div>`;
}

export function renderEmployeesScreen() {
  const employees = getEmployees();

  return `
    <section class="view employees-screen is-active" aria-labelledby="employeesTitle">
      <header class="employees-header glass-panel">
        <div>
          <p class="overline">Команда</p>
          <h1 id="employeesTitle">Сотрудники</h1>
          <p>Управление командой, ролями и рабочими данными.</p>
        </div>
        <button class="primary-button" type="button" data-employee-add>＋ Добавить сотрудника</button>
      </header>
      <div class="employee-stats glass-panel" data-employee-stats>${renderEmployeeStats(employees)}</div>
      <section class="employee-directory glass-panel" aria-labelledby="employeeListTitle">
        <div class="employee-directory__heading">
          <div><p class="overline">Состав</p><h2 id="employeeListTitle">Команда заведения</h2></div>
        </div>
        <div class="employee-list" data-employee-list>${renderEmployeeCards(employees)}</div>
      </section>
      <dialog class="employee-dialog" data-employee-dialog>
        <form method="dialog" data-employee-form>
          <input type="hidden" name="employeeId">
          <div class="employee-dialog__heading">
            <div><p class="overline">Карточка сотрудника</p><h2 data-employee-form-title>Новый сотрудник</h2></div>
            <button type="button" aria-label="Закрыть" data-employee-cancel>×</button>
          </div>
          <div class="employee-form-grid">
            <label class="field field--wide"><span>Имя *</span><input name="name" required autocomplete="name" placeholder="Имя сотрудника"></label>
            <label class="field"><span>Должность *</span><input name="position" required placeholder="Например, администратор"></label>
            <label class="field"><span>Телефон</span><input name="phone" autocomplete="tel" placeholder="+7 900 000-00-00"></label>
            <label class="field"><span>Ставка, ₽</span><input name="rate" type="number" min="0" step="1" placeholder="0"></label>
            <label class="field"><span>Статус</span><select name="status"><option value="active">Работает</option><option value="inactive">Неактивен</option></select></label>
            <label class="field field--wide"><span>Заметки</span><textarea name="notes" rows="3" placeholder="Дополнительная информация"></textarea></label>
          </div>
          <p class="form-error" data-employee-error role="alert"></p>
          <div class="employee-dialog__actions">
            <button class="secondary-button" type="button" data-employee-cancel>Отмена</button>
            <button class="primary-button" type="submit">Сохранить</button>
          </div>
        </form>
      </dialog>
    </section>`;
}

export function initEmployeesScreen(root, { showToast = () => {} } = {}) {
  const dialog = root.querySelector('[data-employee-dialog]');
  const form = root.querySelector('[data-employee-form]');
  const error = root.querySelector('[data-employee-error]');
  if (!dialog || !form) return;

  function refresh() {
    const employees = getEmployees();
    root.querySelector('[data-employee-list]').innerHTML = renderEmployeeCards(employees);
    root.querySelector('[data-employee-stats]').innerHTML = renderEmployeeStats(employees);
  }

  function openForm(employee = null) {
    form.reset();
    error.textContent = '';
    form.elements.employeeId.value = employee?.id ?? '';
    form.elements.name.value = employee?.name ?? '';
    form.elements.position.value = employee?.position ?? '';
    form.elements.phone.value = employee?.phone ?? '';
    form.elements.rate.value = employee?.rate || '';
    form.elements.status.value = employee?.status ?? 'active';
    form.elements.notes.value = employee?.notes ?? '';
    root.querySelector('[data-employee-form-title]').textContent = employee ? 'Редактирование' : 'Новый сотрудник';
    dialog.showModal();
    form.elements.name.focus();
  }

  root.querySelector('[data-employee-add]').addEventListener('click', () => openForm());
  root.querySelectorAll('[data-employee-cancel]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  root.querySelector('[data-employee-list]').addEventListener('click', (event) => {
    const card = event.target.closest('[data-employee-id]');
    if (!card) return;
    const employee = getEmployees().find((item) => item.id === card.dataset.employeeId);

    if (event.target.closest('[data-employee-edit]') && employee) openForm(employee);
    if (event.target.closest('[data-employee-delete]') && employee) {
      if (!globalThis.confirm(`Удалить сотрудника «${employee.name}»?`)) return;
      if (deleteEmployee(employee.id)) {
        refresh();
        showToast('Сотрудник удалён');
      }
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const result = data.employeeId
      ? updateEmployee(data.employeeId, data)
      : createEmployee(data);

    if (!result.success) {
      error.textContent = result.errors.join('. ');
      return;
    }

    dialog.close();
    refresh();
    showToast(data.employeeId ? 'Данные сотрудника обновлены' : 'Сотрудник добавлен');
  });
}
