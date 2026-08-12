import { getEmployees } from './employees.js';
import { hasScheduleData, normalizeScheduleData, readScheduleSnapshot } from './schedule.js';
import { getTaskOverview, getTasks } from './tasks.js';
import { getWarehouseItems, getWarehouseOverview } from './warehouse.js';

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function formatShift(value) {
  const normalized = String(value ?? '').trim();
  const match = normalized.match(/^(\d{2})-(\d{2})$/);
  return match ? `${match[1]}:00–${match[2]}:00` : normalized;
}

function uniqueAssignments(day) {
  const seen = new Set();
  return [...day.masters, ...day.administrators].filter((assignment) => {
    const key = `${assignment.name}\u0000${assignment.shift}`;
    if (!assignment.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSylonBriefing({ schedule, employees = [], tasks = [], warehouse = [], today = new Date() } = {}) {
  const normalizedSchedule = normalizeScheduleData(schedule);
  const activeEmployees = Array.isArray(employees)
    ? employees.filter((employee) => employee?.status === 'active')
    : [];
  const taskOverview = getTaskOverview(Array.isArray(tasks) ? tasks : [], today);
  const warehouseOverview = getWarehouseOverview(Array.isArray(warehouse) ? warehouse : []);

  if (taskOverview.overdue.length > 0) {
    const focus = taskOverview.overdue[0];
    return {
      kind: 'overdue-task',
      mode: 'attention',
      label: 'Нужно внимание',
      eyebrow: 'Фокус дня',
      message: taskOverview.overdue.length === 1
        ? 'Одна задача требует внимания.'
        : `${taskOverview.overdue.length} задач требуют внимания.`,
      detail: focus.title,
      teamLine: `${taskOverview.open.length} в работе · ${taskOverview.completed.length} выполнено.`,
      linkedRoute: 'tasks'
    };
  }

  if (warehouseOverview.attention.length > 0) {
    const focus = warehouseOverview.attention[0];
    return {
      kind: 'warehouse-attention', mode: 'attention', label: 'Нужно пополнить',
      eyebrow: 'Состояние запасов',
      message: warehouseOverview.attention.length === 1 ? 'Одна позиция требует внимания.' : `${warehouseOverview.attention.length} позиций требуют внимания.`,
      detail: `${focus.name} · осталось ${focus.quantity} ${focus.unit}`,
      teamLine: `${warehouseOverview.ok.length} позиций в норме.`, linkedRoute: 'warehouse'
    };
  }

  if (!hasScheduleData(normalizedSchedule)) {
    return {
      kind: 'missing-schedule',
      mode: 'attention',
      label: 'Нужно внимание',
      eyebrow: 'График не подключён',
      message: 'Я пока не вижу актуальный график.',
      detail: 'Подключи или импортируй его, и я соберу сводку.',
      teamLine: activeEmployees.length > 0 ? `В активной команде: ${activeEmployees.length}.` : 'Команда пока не заполнена.',
      linkedRoute: 'schedule'
    };
  }

  const todayKey = toDateKey(today);
  const todayEntry = normalizedSchedule.weeks
    .flatMap((week) => week.days)
    .find((day) => day.date === todayKey);
  const assignments = todayEntry ? uniqueAssignments(todayEntry) : [];

  if (assignments.length === 0) {
    return {
      kind: 'empty-today',
      mode: 'attention',
      label: 'Стоит проверить график',
      eyebrow: 'Сегодняшняя смена',
      message: 'На сегодня никто не назначен.',
      detail: todayEntry?.note || 'Проверь, запланирован ли сегодня рабочий день.',
      teamLine: activeEmployees.length > 0 ? `В активной команде: ${activeEmployees.length}.` : 'Команда пока не заполнена.',
      linkedRoute: 'schedule'
    };
  }

  const names = [...new Set(assignments.map((assignment) => assignment.name))];
  const shiftSummary = assignments
    .slice(0, 3)
    .map((assignment) => `${assignment.name} · ${formatShift(assignment.shift) || 'время не указано'}`)
    .join(', ');

  return {
    kind: 'today-ready',
    mode: 'calm',
    label: 'Система спокойна',
    eyebrow: 'Сегодняшняя смена',
    message: `Сегодня работают: ${names.join(', ')}.`,
    detail: shiftSummary,
    teamLine: `${names.length} ${names.length === 1 ? 'человек' : names.length < 5 ? 'человека' : 'человек'} в сегодняшнем графике.`,
    linkedRoute: 'schedule'
  };
}

export async function loadSylonBriefing(options = {}) {
  const [schedule, employees, tasks, warehouse] = await Promise.all([
    readScheduleSnapshot(),
    Promise.resolve(getEmployees()),
    Promise.resolve(getTasks()), Promise.resolve(getWarehouseItems())
  ]);
  return buildSylonBriefing({ schedule, employees, tasks, warehouse, today: options.today || new Date() });
}
