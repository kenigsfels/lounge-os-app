import { getEmployees } from './employees.js';
import { buildSylonBriefing } from './sylon-briefing.js';
import { getTasks } from './tasks.js';
import { getWarehouseItems } from './warehouse.js';
import {
  getUpcomingDays,
  hasScheduleData,
  normalizeScheduleData,
  readScheduleSnapshot
} from './schedule.js';

function normalizeQuery(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[?!.,:;]+/g, '')
    .replace(/\s+/g, ' ');
}

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
  return match ? `${match[1]}:00–${match[2]}:00` : normalized || 'время не указано';
}

function assignmentsForDay(day) {
  if (!day) return [];
  const seen = new Set();
  return [...day.masters, ...day.administrators].filter((assignment) => {
    const key = `${assignment.name}\u0000${assignment.shift}`;
    if (!assignment.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findToday(schedule, today) {
  const todayKey = toDateKey(today);
  return schedule.weeks.flatMap((week) => week.days).find((day) => day.date === todayKey);
}

function missingScheduleAnswer() {
  return {
    type: 'answer',
    intent: 'missing-schedule',
    eyebrow: 'Нет актуального графика',
    text: 'Я пока не вижу график, поэтому не могу ответить точно.',
    detail: 'Подключи или импортируй график — после этого я сразу прочитаю смены.',
    mode: 'attention',
    route: 'schedule',
    actionLabel: 'Открыть график'
  };
}

function formatUpcomingDay(day) {
  const label = day.dayLabel || new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short'
  }).format(new Date(`${day.date}T12:00:00`));
  const names = [...new Set(assignmentsForDay(day).map((assignment) => assignment.name))];
  const summary = names.length > 0 ? names.join(', ') : day.note;
  return `${label}: ${summary || 'смена без назначений'}`;
}

function resolveIntent(query) {
  const includesAny = (phrases) => phrases.some((phrase) => query.includes(phrase));
  if ((includesAny(['кто', 'кого']) && includesAny(['сегодня', 'смене', 'работает', 'работают']))
    || (query.includes('сегодня') && includesAny(['работает', 'работают', 'смене']))) {
    return 'today-roster';
  }
  if (query.includes('во сколько')) return 'person-time';
  if (includesAny(['что требует внимания', 'что проверить', 'требует внимания', 'нужно проверить'])) return 'attention';
  if ((includesAny(['ближайшие', 'следующие']) && includesAny(['смены', 'смену', 'график']))
    || query.includes('покажи ближайшие')) return 'upcoming';
  return null;
}

export function resolveSylonAssistantQuery(value, { schedule, employees = [], tasks = [], warehouse = [], today = new Date() } = {}) {
  const query = normalizeQuery(value);
  const intent = resolveIntent(query);
  if (!intent) return null;

  const normalizedSchedule = normalizeScheduleData(schedule);
  if (!hasScheduleData(normalizedSchedule)) return missingScheduleAnswer();

  const todayEntry = findToday(normalizedSchedule, today);
  const todayAssignments = assignmentsForDay(todayEntry);

  if (intent === 'today-roster') {
    if (todayAssignments.length === 0) {
      return {
        type: 'answer', intent, eyebrow: 'Сегодняшняя смена',
        text: 'На сегодня в графике никто не назначен.',
        detail: todayEntry?.note || 'Стоит проверить, запланирован ли сегодня рабочий день.',
        mode: 'attention', route: 'schedule', actionLabel: 'Проверить график'
      };
    }
    const lines = todayAssignments.map((assignment) => `${assignment.name} · ${formatShift(assignment.shift)}`);
    return {
      type: 'answer', intent, eyebrow: 'Сегодня работают',
      text: [...new Set(todayAssignments.map((assignment) => assignment.name))].join(', '),
      detail: lines.join('  ·  '), mode: 'calm', route: 'schedule', actionLabel: 'Открыть график'
    };
  }

  if (intent === 'person-time') {
    const match = todayAssignments.find((assignment) => {
      const name = normalizeQuery(assignment.name);
      return name && (query.includes(name) || name.split(' ').some((part) => part.length > 2 && query.includes(part)));
    });
    if (!match) {
      return {
        type: 'answer', intent, eyebrow: 'Сегодняшняя смена',
        text: todayAssignments.length > 0
          ? 'Не нашёл этого человека в сегодняшней смене.'
          : 'На сегодня в графике никто не назначен.',
        detail: 'Можно открыть график и проверить имя или другую дату.',
        mode: 'attention', route: 'schedule', actionLabel: 'Открыть график'
      };
    }
    return {
      type: 'answer', intent, eyebrow: 'Сегодняшняя смена',
      text: `${match.name} сегодня работает ${formatShift(match.shift)}.`,
      detail: 'По актуальному локальному графику.', mode: 'calm', route: 'schedule', actionLabel: 'Открыть график'
    };
  }

  if (intent === 'attention') {
    const briefing = buildSylonBriefing({ schedule: normalizedSchedule, employees, tasks, warehouse, today });
    return {
      type: 'answer', intent, eyebrow: briefing.eyebrow,
      text: briefing.message, detail: briefing.detail,
      mode: briefing.mode, route: briefing.linkedRoute,
      actionLabel: briefing.linkedRoute ? 'Проверить график' : ''
    };
  }

  const upcoming = getUpcomingDays(normalizedSchedule, today, 3);
  return {
    type: 'answer', intent, eyebrow: 'Ближайшие смены',
    text: upcoming.length > 0 ? upcoming.map(formatUpcomingDay).join('  ·  ') : 'Ближайших заполненных смен не найдено.',
    detail: upcoming.length > 0 ? 'Показываю до трёх ближайших дней.' : 'Можно открыть график и добавить назначения.',
    mode: upcoming.length > 0 ? 'calm' : 'attention', route: 'schedule', actionLabel: 'Открыть график'
  };
}

export async function askSylonLocally(value, options = {}) {
  const [schedule, employees, tasks, warehouse] = await Promise.all([
    readScheduleSnapshot(),
    Promise.resolve(getEmployees()),
    Promise.resolve(getTasks()), Promise.resolve(getWarehouseItems())
  ]);
  return resolveSylonAssistantQuery(value, {
    schedule,
    employees,
    tasks,
    warehouse,
    today: options.today || new Date()
  });
}
