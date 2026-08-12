import assert from 'node:assert/strict';
import { buildTodayTeam } from '../screens/employees.js';
import { normalizeScheduleData } from '../core/schedule.js';

const schedule = normalizeScheduleData({
  weeks: [{
    start: '2026-08-10', end: '2026-08-16', days: [{
      date: '2026-08-12',
      masters: [{ name: 'Юра', shift: '12-01' }],
      administrators: [{ name: 'Кристина', shift: '10-01' }]
    }]
  }]
});

const today = buildTodayTeam(schedule, new Date('2026-08-12T12:00:00'));
assert.equal(today.length, 2);
assert.equal(today[0].role, 'Мастер');
assert.equal(today[1].role, 'Администратор');
assert.equal(today[1].shift, '10-01');
console.log('✓ экран команды читает сегодняшнюю смену без изменения данных');

assert.deepEqual(buildTodayTeam(schedule, new Date('2026-08-13T12:00:00')), []);
console.log('✓ отсутствие назначений превращается в спокойное пустое состояние');
