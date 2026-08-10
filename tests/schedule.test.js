import assert from 'node:assert/strict';
import {
  chooseNewestSchedule,
  getCurrentWeekIndex,
  getUpcomingDays,
  normalizeScheduleData
} from '../core/schedule.js';

const schedule = normalizeScheduleData({
  version: 1,
  currentWeek: '2026-08-10',
  source: { type: 'google-sheets', url: 'https://example.test', syncedAt: '2026-08-10T10:00:00+03:00' },
  weeks: [{
    start: '2026-08-10',
    end: '2026-08-16',
    days: [{
      date: '2026-08-10',
      dayKey: 'Пн',
      dayLabel: 'Понедельник',
      masters: [{ name: 'Сотрудник', shift: '12-01' }],
      administrators: [],
      note: ''
    }]
  }]
});

assert.equal(schedule.weeks.length, 1);
console.log('✓ график нормализован');
assert.equal(getCurrentWeekIndex(schedule, new Date('2026-08-10T12:00:00')), 0);
console.log('✓ текущая неделя определена');
assert.equal(getUpcomingDays(schedule, new Date('2026-08-10T12:00:00')).length, 1);
console.log('✓ ближайшие смены найдены');
assert.equal(schedule.weeks[0].days[0].masters[0].name, 'Сотрудник');
console.log('✓ назначения сотрудников сохранены');

const newerSchedule = normalizeScheduleData({
  ...schedule,
  source: { ...schedule.source, syncedAt: '2026-08-10T11:00:00+03:00' }
});

assert.equal(
  chooseNewestSchedule(newerSchedule, schedule).source,
  'local'
);
console.log('✓ более свежий локальный график выбран для загрузки в облако');

assert.equal(
  chooseNewestSchedule(schedule, newerSchedule).source,
  'cloud'
);
console.log('✓ более свежий облачный график выбран для устройства');

assert.equal(
  chooseNewestSchedule({ weeks: [] }, schedule).source,
  'cloud'
);
console.log('✓ пустое устройство получает график из облака');

assert.equal(
  chooseNewestSchedule(schedule, null).source,
  'local'
);
console.log('✓ первый локальный график готов к загрузке в облако');
