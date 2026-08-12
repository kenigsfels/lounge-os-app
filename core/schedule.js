import { readStorage, writeStorage } from './storage.js';

const EMPTY_SCHEDULE = Object.freeze({
  version: 1,
  currentWeek: '',
  source: null,
  weeks: []
});

function normalizeAssignment(value) {
  return {
    name: String(value?.name ?? '').trim(),
    shift: String(value?.shift ?? '').trim()
  };
}

function normalizeDay(value) {
  return {
    date: String(value?.date ?? ''),
    dayKey: String(value?.dayKey ?? ''),
    dayLabel: String(value?.dayLabel ?? ''),
    masters: Array.isArray(value?.masters)
      ? value.masters.map(normalizeAssignment).filter((item) => item.name)
      : [],
    administrators: Array.isArray(value?.administrators)
      ? value.administrators.map(normalizeAssignment).filter((item) => item.name)
      : [],
    note: String(value?.note ?? '').trim()
  };
}

export function normalizeScheduleData(value) {
  const weeks = Array.isArray(value?.weeks)
    ? value.weeks.map((week) => ({
        start: String(week?.start ?? ''),
        end: String(week?.end ?? ''),
        days: Array.isArray(week?.days) ? week.days.map(normalizeDay) : []
      })).filter((week) => week.start && week.days.length > 0)
    : [];

  return {
    version: Number(value?.version) || 1,
    currentWeek: String(value?.currentWeek ?? ''),
    source: value?.source && typeof value.source === 'object'
      ? {
          type: String(value.source.type ?? ''),
          url: String(value.source.url ?? ''),
          syncedAt: String(value.source.syncedAt ?? '')
        }
      : null,
    weeks
  };
}

export function hasScheduleData(value) {
  return normalizeScheduleData(value).weeks.length > 0;
}

export function getScheduleTimestamp(value, fallback = '') {
  const schedule = normalizeScheduleData(value);
  const timestamp = Date.parse(schedule.source?.syncedAt || fallback);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function chooseNewestSchedule(localValue, cloudValue, cloudUpdatedAt = '') {
  const localSchedule = normalizeScheduleData(localValue);
  const cloudSchedule = normalizeScheduleData(cloudValue);
  const localHasData = hasScheduleData(localSchedule);
  const cloudHasData = hasScheduleData(cloudSchedule);

  if (!cloudHasData) return { source: 'local', schedule: localSchedule };
  if (!localHasData) return { source: 'cloud', schedule: cloudSchedule };

  return getScheduleTimestamp(localSchedule) > getScheduleTimestamp(cloudSchedule, cloudUpdatedAt)
    ? { source: 'local', schedule: localSchedule }
    : { source: 'cloud', schedule: cloudSchedule };
}

export function saveScheduleData(value) {
  const schedule = normalizeScheduleData(value);
  writeStorage('schedule', schedule);
  return schedule;
}

export async function loadScheduleData() {
  try {
    if (globalThis.sylon?.schedule?.load) {
      const desktopSchedule = normalizeScheduleData(await globalThis.sylon.schedule.load());
      if (hasScheduleData(desktopSchedule)) return saveScheduleData(desktopSchedule);
    }
  } catch {
    // The browser fallback below keeps the public version usable.
  }

  return normalizeScheduleData(readStorage('schedule', EMPTY_SCHEDULE));
}

export async function readScheduleSnapshot() {
  try {
    if (globalThis.sylon?.schedule?.load) {
      const desktopSchedule = normalizeScheduleData(await globalThis.sylon.schedule.load());
      if (hasScheduleData(desktopSchedule)) return desktopSchedule;
    }
  } catch {
    // Reading the local cache below keeps the briefing available without changing data.
  }

  return normalizeScheduleData(readStorage('schedule', EMPTY_SCHEDULE));
}

export function parseLocalDate(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? new Date(`${normalized}T12:00:00`) : null;
}

export function getCurrentWeekIndex(schedule, today = new Date()) {
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  const containingIndex = schedule.weeks.findIndex((week) => (
    week.start <= todayKey && week.end >= todayKey
  ));
  if (containingIndex >= 0) return containingIndex;

  const configuredIndex = schedule.weeks.findIndex((week) => week.start === schedule.currentWeek);
  return configuredIndex >= 0 ? configuredIndex : 0;
}

export function getUpcomingDays(schedule, today = new Date(), limit = 3) {
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  return schedule.weeks
    .flatMap((week) => week.days)
    .filter((day) => day.date >= todayKey && (
      day.masters.length > 0 || day.administrators.length > 0 || day.note
    ))
    .slice(0, limit);
}
