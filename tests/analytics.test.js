import assert from 'node:assert/strict';
import { buildOperationalPulse } from '../core/analytics.js';

const today = new Date('2026-08-12T12:00:00');
const schedule = { weeks: [{ start: '2026-08-10', end: '2026-08-16', days: [
  { date: '2026-08-12', masters: [{ name: 'Юра', shift: '12-01' }], administrators: [{ name: 'Анна', shift: '18-01' }] },
  { date: '2026-08-13', masters: [{ name: 'Юра', shift: '12-01' }], administrators: [] },
  { date: '2026-08-15', masters: [{ name: 'Женя', shift: '18-01' }], administrators: [] }
] }] };
const tasks = [
  { id: 'one', title: 'Срочно', lane: 'today', status: 'open', dueDate: '2026-08-11', completedAt: '' },
  { id: 'two', title: 'Сегодня', lane: 'today', status: 'open', dueDate: '2026-08-12', completedAt: '' },
  { id: 'three', title: 'Готово', lane: 'today', status: 'completed', dueDate: '2026-08-12', completedAt: '2026-08-12T10:00:00.000Z' }
];
const warehouse = [{ id: 'stock', name: 'Уголь', unit: 'кг', category: 'coal', quantity: 2, minimum: 3 }];

const daily = buildOperationalPulse({ schedule, tasks, warehouse, period: 'today', today });
assert.equal(daily.team.people, 2);
assert.equal(daily.team.staffedDays, 1);
assert.equal(daily.tasks.open, 2);
assert.equal(daily.tasks.overdue, 1);
assert.equal(daily.tasks.completed, 1);
assert.equal(daily.warehouse.attention, 1);
assert.equal(daily.mode, 'attention');
assert.equal(daily.conclusion.route, 'tasks');
console.log('✓ пульс сегодня собирает только реальные данные модулей');

const weekly = buildOperationalPulse({ schedule, tasks, warehouse: [], period: 'week', today });
assert.equal(weekly.team.people, 3);
assert.equal(weekly.team.staffedDays, 3);
assert.equal(weekly.team.totalDays, 7);
assert.equal(weekly.upcoming.length, 3);
assert.equal(weekly.warehouse.attention, 0);
console.log('✓ недельный пульс показывает покрытие смен и ближайший ритм');

const empty = buildOperationalPulse({ schedule: null, period: 'today', today });
assert.equal(empty.team.status, 'attention');
assert.equal(empty.conclusion.route, 'schedule');
console.log('✓ пустые источники не превращаются в выдуманные показатели');
