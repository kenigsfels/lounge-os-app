const MAX_DAYS = 62;

function clean(value, limit = 160) {
  return String(value ?? '').trim().slice(0, limit);
}

function dateKey(value) {
  const normalized = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function shiftHours(value) {
  const match = clean(value, 16).match(/^(\d{1,2})(?::\d{2})?-(\d{1,2})(?::\d{2})?$/);
  if (!match) return 0;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (start > 23 || end > 23) return 0;
  return end >= start ? end - start : 24 - start + end;
}

function allDays(context) {
  return (Array.isArray(context?.schedule?.weeks) ? context.schedule.weeks : [])
    .flatMap((week) => Array.isArray(week?.days) ? week.days : [])
    .filter((day) => dateKey(day?.date))
    .slice(0, MAX_DAYS);
}

function assignments(day) {
  return [
    ...(Array.isArray(day?.masters) ? day.masters.map((item) => ({ ...item, role: 'master' })) : []),
    ...(Array.isArray(day?.administrators) ? day.administrators.map((item) => ({ ...item, role: 'administrator' })) : [])
  ].map((item) => ({ name: clean(item.name), shift: clean(item.shift, 16), role: item.role })).filter((item) => item.name);
}

function workload(context, from, to) {
  const result = new Map();
  allDays(context).filter((day) => day.date >= from && day.date <= to).forEach((day) => {
    assignments(day).forEach((assignment) => {
      const current = result.get(assignment.name) || { name: assignment.name, shifts: 0, hours: 0, dates: [] };
      current.shifts += 1;
      current.hours += shiftHours(assignment.shift);
      current.dates.push(day.date);
      result.set(assignment.name, current);
    });
  });
  return [...result.values()].sort((a, b) => b.hours - a.hours || b.shifts - a.shifts || a.name.localeCompare(b.name, 'ru'));
}

function addDays(key, amount) {
  const date = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function roleMatches(position, role) {
  const normalized = clean(position).toLocaleLowerCase('ru-RU');
  if (role === 'administrator') return normalized.includes('админ') || normalized.includes('управ');
  return !normalized.includes('админ') || normalized.includes('мастер');
}

export const SYLON_AGENT_TOOLS = Object.freeze([
  {
    type: 'function',
    function: {
      name: 'get_schedule_window',
      description: 'Показать назначения команды за указанный период. Используй перед выводами о конкретных сменах.',
      parameters: { type: 'object', additionalProperties: false, properties: {
        date_from: { type: 'string', description: 'Начальная дата YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Конечная дата YYYY-MM-DD' }
      }, required: ['date_from', 'date_to'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_team_workload',
      description: 'Посчитать количество смен и часов каждого сотрудника за период.',
      parameters: { type: 'object', additionalProperties: false, properties: {
        date_from: { type: 'string', description: 'Начальная дата YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Конечная дата YYYY-MM-DD' }
      }, required: ['date_from', 'date_to'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'find_shift_replacements',
      description: 'Подобрать свободных кандидатов на замену отсутствующего сотрудника с учётом роли и нагрузки за соседние 7 дней.',
      parameters: { type: 'object', additionalProperties: false, properties: {
        date: { type: 'string', description: 'Дата смены YYYY-MM-DD' },
        absent_employee: { type: 'string', description: 'Имя отсутствующего сотрудника' }
      }, required: ['date', 'absent_employee'] }
    }
  }
]);

export function sanitizeAgentContext(value) {
  const employees = (Array.isArray(value?.employees) ? value.employees : []).slice(0, 120).map((employee) => ({
    id: clean(employee?.id, 80), name: clean(employee?.name), position: clean(employee?.position),
    status: clean(employee?.status, 32)
  })).filter((employee) => employee.name);
  const weeks = (Array.isArray(value?.schedule?.weeks) ? value.schedule.weeks : []).slice(0, 10).map((week) => ({
    start: dateKey(week?.start), end: dateKey(week?.end),
    days: (Array.isArray(week?.days) ? week.days : []).slice(0, 7).map((day) => ({
      date: dateKey(day?.date), note: clean(day?.note),
      masters: (Array.isArray(day?.masters) ? day.masters : []).slice(0, 20).map((item) => ({ name: clean(item?.name), shift: clean(item?.shift, 16) })),
      administrators: (Array.isArray(day?.administrators) ? day.administrators : []).slice(0, 20).map((item) => ({ name: clean(item?.name), shift: clean(item?.shift, 16) }))
    })).filter((day) => day.date)
  })).filter((week) => week.days.length);
  return { employees, schedule: { weeks } };
}

export function executeSylonTool(name, args, context) {
  if (name === 'get_schedule_window' || name === 'get_team_workload') {
    const from = dateKey(args?.date_from);
    const to = dateKey(args?.date_to);
    if (!from || !to || from > to || addDays(from, MAX_DAYS - 1) < to) return { error: 'Некорректный период: максимум 62 дня.' };
    if (name === 'get_team_workload') return { period: { from, to }, people: workload(context, from, to) };
    return { period: { from, to }, days: allDays(context).filter((day) => day.date >= from && day.date <= to).map((day) => ({ date: day.date, note: clean(day.note), assignments: assignments(day) })) };
  }

  if (name === 'find_shift_replacements') {
    const date = dateKey(args?.date);
    const absent = clean(args?.absent_employee);
    if (!date || !absent) return { error: 'Нужны дата и имя отсутствующего сотрудника.' };
    const day = allDays(context).find((item) => item.date === date);
    if (!day) return { error: 'На эту дату нет данных графика.' };
    const dayAssignments = assignments(day);
    const missing = dayAssignments.find((item) => item.name.toLocaleLowerCase('ru-RU').includes(absent.toLocaleLowerCase('ru-RU')));
    const scheduled = new Set(dayAssignments.map((item) => item.name.toLocaleLowerCase('ru-RU')));
    const loads = new Map(workload(context, addDays(date, -3), addDays(date, 3)).map((item) => [item.name, item]));
    const candidates = (Array.isArray(context?.employees) ? context.employees : [])
      .filter((employee) => employee.status === 'active' && !scheduled.has(employee.name.toLocaleLowerCase('ru-RU')))
      .map((employee) => {
        const load = loads.get(employee.name) || { shifts: 0, hours: 0 };
        const sameRole = missing ? roleMatches(employee.position, missing.role) : true;
        return { name: employee.name, position: employee.position, sameRole, shiftsAroundDate: load.shifts, hoursAroundDate: load.hours,
          score: (sameRole ? 100 : 0) - load.hours - load.shifts * 3 };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ru')).slice(0, 5);
    return { date, absentEmployee: missing?.name || absent, role: missing?.role || 'unknown', shift: missing?.shift || '', candidates };
  }

  return { error: 'Инструмент не разрешён.' };
}
