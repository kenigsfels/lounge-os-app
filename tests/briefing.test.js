import assert from 'node:assert/strict';
import { buildSylonBriefing } from '../core/sylon-briefing.js';
import { normalizeScheduleData } from '../core/schedule.js';

const today = new Date('2026-08-12T12:00:00');
const employees = [
  { name: 'Юра', status: 'active' },
  { name: 'Сотрудник', status: 'inactive' }
];

const missing = buildSylonBriefing({ schedule: null, employees, today });
assert.equal(missing.kind, 'missing-schedule');
assert.equal(missing.mode, 'attention');
assert.equal(missing.linkedRoute, 'schedule');
assert.match(missing.teamLine, /1/);
console.log('✓ отсутствие графика спокойно выводится в состояние внимания');

const emptyToday = buildSylonBriefing({
  schedule: normalizeScheduleData({
    weeks: [{
      start: '2026-08-10',
      end: '2026-08-16',
      days: [{ date: '2026-08-12', masters: [], administrators: [], note: '' }]
    }]
  }),
  employees,
  today
});
assert.equal(emptyToday.kind, 'empty-today');
assert.equal(emptyToday.mode, 'attention');
assert.match(emptyToday.message, /никто не назначен/);
console.log('✓ пустой сегодняшний день предлагает проверить график');

const readyToday = buildSylonBriefing({
  schedule: normalizeScheduleData({
    weeks: [{
      start: '2026-08-10',
      end: '2026-08-16',
      days: [{
        date: '2026-08-12',
        masters: [
          { name: 'Юра', shift: '12-01' },
          { name: 'Женя', shift: '18-01' }
        ],
        administrators: [{ name: 'Кристина', shift: '20-01' }]
      }]
    }]
  }),
  employees,
  today
});
assert.equal(readyToday.kind, 'today-ready');
assert.equal(readyToday.mode, 'calm');
assert.match(readyToday.message, /Юра, Женя, Кристина/);
assert.match(readyToday.detail, /12:00–01:00/);
assert.equal(readyToday.linkedRoute, 'schedule');
console.log('✓ заполненная смена превращается в спокойную реальную сводку');

assert.notEqual(readyToday.mode, 'issue');
assert.notEqual(emptyToday.mode, 'issue');
console.log('✓ автоматический брифинг не включает тревожное состояние');

const overdueTask = buildSylonBriefing({
  schedule: null,
  employees,
  tasks: [{ id: 'task_1', title: 'Закрыть отчёт', lane: 'today', status: 'open', dueDate: '2026-08-11' }],
  today
});
assert.equal(overdueTask.kind, 'overdue-task');
assert.equal(overdueTask.mode, 'attention');
assert.equal(overdueTask.linkedRoute, 'tasks');
assert.match(overdueTask.detail, /Закрыть отчёт/);
console.log('✓ просроченная задача становится сигналом внимания для Core');

const warehouseAlert = buildSylonBriefing({ schedule: null, employees, warehouse: [{ id:'stock_1', name:'Уголь', unit:'кг', quantity:2, minimum:3 }], today });
assert.equal(warehouseAlert.kind, 'warehouse-attention');
assert.equal(warehouseAlert.linkedRoute, 'warehouse');
assert.match(warehouseAlert.detail, /Уголь/);
console.log('✓ критический остаток становится сигналом внимания для Core');
