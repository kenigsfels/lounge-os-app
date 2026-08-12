import { normalizeScheduleData, getUpcomingDays } from './schedule.js';
import { getTaskOverview } from './tasks.js';
import { getWarehouseOverview } from './warehouse.js';
import { buildSylonBriefing } from './sylon-briefing.js';

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function assignments(day) {
  const people = [...(day?.masters || []), ...(day?.administrators || [])];
  return [...new Set(people.map((person) => person.name).filter(Boolean))];
}

function completedInRange(tasks, start, end) {
  return tasks.filter((task) => {
    const completedAt = String(task.completedAt ?? '').slice(0, 10);
    return task.status === 'completed' && completedAt >= start && completedAt <= end;
  });
}

export function buildOperationalPulse({ schedule, employees = [], tasks = [], warehouse = [], period = 'today', today = new Date() } = {}) {
  const normalizedSchedule = normalizeScheduleData(schedule);
  const normalizedPeriod = period === 'week' ? 'week' : 'today';
  const start = dateKey(today);
  const end = normalizedPeriod === 'week' ? dateKey(addDays(today, 6)) : start;
  const days = normalizedSchedule.weeks.flatMap((week) => week.days).filter((day) => day.date >= start && day.date <= end);
  const people = [...new Set(days.flatMap(assignments))];
  const staffedDays = days.filter((day) => assignments(day).length > 0).length;
  const taskOverview = getTaskOverview(tasks, today);
  const relevantTasks = taskOverview.open.filter((task) => {
    if (task.lane === 'now') return true;
    return task.lane === 'today' || Boolean(task.dueDate && task.dueDate <= end);
  });
  const completed = completedInRange(tasks, start, end);
  const stock = getWarehouseOverview(warehouse);
  const briefing = buildSylonBriefing({ schedule: normalizedSchedule, employees, tasks, warehouse, today });
  const upcoming = getUpcomingDays(normalizedSchedule, today, normalizedPeriod === 'week' ? 4 : 2);

  return {
    period: normalizedPeriod,
    range: { start, end },
    mode: briefing.mode,
    conclusion: {
      eyebrow: briefing.eyebrow,
      title: briefing.label,
      message: briefing.message,
      detail: briefing.detail,
      route: briefing.linkedRoute
    },
    team: {
      people: people.length,
      staffedDays,
      totalDays: normalizedPeriod === 'week' ? 7 : 1,
      status: staffedDays > 0 ? 'calm' : 'attention',
      label: normalizedPeriod === 'week' ? `${staffedDays} дней со сменами` : `${people.length} человек сегодня`
    },
    tasks: {
      open: relevantTasks.length,
      overdue: taskOverview.overdue.length,
      completed: completed.length,
      status: taskOverview.overdue.length > 0 ? 'attention' : 'calm',
      label: taskOverview.overdue.length > 0 ? `${taskOverview.overdue.length} просрочено` : `${relevantTasks.length} в фокусе`
    },
    warehouse: {
      total: stock.items.length,
      attention: stock.attention.length,
      ok: stock.ok.length,
      status: stock.attention.length > 0 ? 'attention' : 'calm',
      label: stock.attention.length > 0 ? `${stock.attention.length} требуют внимания` : `${stock.ok.length} позиций в норме`
    },
    upcoming
  };
}
