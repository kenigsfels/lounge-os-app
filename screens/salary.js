import { getEmployees } from '../core/employees.js';
import { readScheduleSnapshot } from '../core/schedule.js';
import { takeNavigationContext } from '../core/navigation-context.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (symbol) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[symbol]);
const money = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(value) || 0);

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function getPeriodRange(period, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (period === 'month') start.setDate(1);
  else start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  if (period === 'month') end.setMonth(end.getMonth() + 1, 0);
  else end.setDate(end.getDate() + 6);
  return { start: dateKey(start), end: dateKey(end) };
}

function shiftHours(value) {
  const match = String(value || '').match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return 0;
  const start = Number(match[1]);
  let end = Number(match[2]);
  if (end <= start) end += 24;
  return Math.max(0, end - start);
}

export function buildSalaryOverview(employees = [], schedule = null, period = 'week', today = new Date()) {
  const range = getPeriodRange(period, today);
  const days = (schedule?.weeks || []).flatMap((week) => week.days || []).filter((day) => day.date >= range.start && day.date <= range.end);
  const assignments = days.flatMap((day) => [...(day.masters || []), ...(day.administrators || [])].map((item) => ({ ...item, date: day.date })));
  const rows = employees.filter((employee) => employee.status === 'active').map((employee) => {
    const own = assignments.filter((assignment) => assignment.name.trim().toLowerCase() === employee.name.trim().toLowerCase());
    const rate = Math.max(0, Number(employee.rate) || 0);
    return { id: employee.id, name: employee.name, position: employee.position || 'Сотрудник', rate, shifts: own.length, hours: own.reduce((sum, assignment) => sum + shiftHours(assignment.shift), 0), accrued: own.length * rate };
  }).sort((left, right) => right.accrued - left.accrued || left.name.localeCompare(right.name, 'ru'));
  return {
    period, range, rows,
    total: rows.reduce((sum, row) => sum + row.accrued, 0),
    shifts: rows.reduce((sum, row) => sum + row.shifts, 0),
    hours: rows.reduce((sum, row) => sum + row.hours, 0),
    rated: rows.filter((row) => row.rate > 0).length
  };
}

function renderFinanceContent(overview) {
  return `<div class="finance-summary">
    <article class="finance-summary__primary" data-finance-focus="payments"><small>К выплате</small><strong>${money(overview.total)}</strong><p>${overview.period === 'month' ? 'Текущий месяц' : 'Текущая неделя'}</p></article>
    <article><small>Смен учтено</small><strong>${overview.shifts}</strong><p>${overview.hours} рабочих часов</p></article>
    <article><small>Ставки готовы</small><strong>${overview.rated}/${overview.rows.length}</strong><p>Активная команда</p></article>
  </div>
  <section class="finance-ledger glass-panel" data-finance-focus="period"><header><div><p class="overline">Расчётный контур</p><h2>Начисления команды</h2></div><span>${overview.range.start} — ${overview.range.end}</span></header>
    <div class="finance-ledger__head"><span>Сотрудник</span><span>Ставка за смену</span><span>Смены</span><span>Часы</span><span>Начислено</span></div>
    <div class="finance-ledger__rows">${overview.rows.length ? overview.rows.map((row) => `<article><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.position)}</small></span><span>${money(row.rate)}</span><span>${row.shifts}</span><span>${row.hours}</span><b>${money(row.accrued)}</b></article>`).join('') : '<div class="finance-ledger__empty"><i></i><strong>Команда пока не заполнена</strong><p>Добавь сотрудников и ставки — расчёт появится автоматически.</p></div>'}</div>
  </section>`;
}

export function renderSalaryScreen() {
  return `<section class="view finance-space is-active" aria-labelledby="salaryTitle" data-finance-screen>
    <header class="finance-header glass-panel"><div><p class="overline">Финансы SYLON</p><h1 id="salaryTitle">Расчёт выплат</h1><p>Смены, ставки и начисления в одном спокойном контуре.</p></div><div class="finance-period" role="group" aria-label="Период расчёта"><button type="button" data-finance-period="week">Неделя</button><button type="button" data-finance-period="month">Месяц</button></div></header>
    <div data-finance-content>${renderFinanceContent(buildSalaryOverview(getEmployees(), null, 'week'))}</div>
  </section>`;
}

export function initSalaryScreen(root, { showToast = () => {} } = {}) {
  const screen = root.querySelector('[data-finance-screen]');
  const content = screen?.querySelector('[data-finance-content]');
  const mapContext = takeNavigationContext('salary');
  let period = mapContext?.type === 'finance-period' && mapContext.value === 'month' ? 'month' : 'week';
  let schedule = null;
  let disposed = false;
  if (!screen || !content) return () => {};

  const paint = () => {
    if (disposed) return;
    const overview = buildSalaryOverview(getEmployees(), schedule, period);
    content.innerHTML = renderFinanceContent(overview);
    screen.querySelectorAll('[data-finance-period]').forEach((button) => button.classList.toggle('is-active', button.dataset.financePeriod === period));
    if (mapContext) requestAnimationFrame(() => {
      const focus = mapContext.type === 'finance-period' ? 'period' : 'payments';
      const target = content.querySelector(`[data-finance-focus="${focus}"]`);
      target?.classList.add('is-map-arrival');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };
  const onClick = (event) => {
    const button = event.target.closest('[data-finance-period]');
    if (!button || button.dataset.financePeriod === period) return;
    period = button.dataset.financePeriod;
    paint();
  };
  screen.addEventListener('click', onClick);
  paint();
  readScheduleSnapshot().then((value) => { schedule = value; paint(); }).catch(() => showToast('График недоступен — показаны сохранённые ставки'));
  return () => { disposed = true; screen.removeEventListener('click', onClick); };
}
