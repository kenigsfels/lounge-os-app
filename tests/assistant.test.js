import assert from 'node:assert/strict';
import { resolveSylonAssistantQuery } from '../core/sylon-assistant.js';
import { normalizeScheduleData } from '../core/schedule.js';

const today = new Date('2026-08-12T12:00:00');
const schedule = normalizeScheduleData({
  weeks: [{
    start: '2026-08-10',
    end: '2026-08-16',
    days: [
      {
        date: '2026-08-12',
        dayLabel: 'Сегодня',
        masters: [{ name: 'Юра', shift: '12-01' }, { name: 'Женя', shift: '18-01' }],
        administrators: [{ name: 'Кристина', shift: '20-01' }]
      },
      {
        date: '2026-08-13',
        dayLabel: 'Четверг',
        masters: [{ name: 'Саша', shift: '12-01' }],
        administrators: []
      }
    ]
  }]
});
const context = { schedule, employees: [{ name: 'Юра', status: 'active' }], today };

const roster = resolveSylonAssistantQuery('Кто сегодня работает?', context);
assert.equal(roster.intent, 'today-roster');
assert.match(roster.text, /Юра, Женя, Кристина/);
assert.match(roster.detail, /12:00–01:00/);
console.log('✓ помощник отвечает, кто работает сегодня');

const person = resolveSylonAssistantQuery('Во сколько сегодня Юра?', context);
assert.equal(person.intent, 'person-time');
assert.match(person.text, /Юра сегодня работает 12:00–01:00/);
console.log('✓ помощник находит время конкретного человека');

const attention = resolveSylonAssistantQuery('Что требует внимания?', context);
assert.equal(attention.intent, 'attention');
assert.equal(attention.mode, 'calm');
assert.match(attention.text, /Сегодня работают/);
console.log('✓ помощник собирает локальную сводку внимания');

const taskAttention = resolveSylonAssistantQuery('Что требует внимания?', {
  ...context,
  tasks: [{ id: 'task_1', title: 'Проверить кассу', lane: 'today', status: 'open', dueDate: '2026-08-11' }]
});
assert.equal(taskAttention.route, 'tasks');
assert.match(taskAttention.text, /задача требует внимания/);
assert.match(taskAttention.detail, /Проверить кассу/);
console.log('✓ помощник связывает сигнал внимания с задачами');

const upcoming = resolveSylonAssistantQuery('Покажи ближайшие смены', context);
assert.equal(upcoming.intent, 'upcoming');
assert.match(upcoming.text, /Сегодня: Юра, Женя, Кристина/);
assert.match(upcoming.text, /Четверг: Саша/);
console.log('✓ помощник показывает ближайшие смены');

const missing = resolveSylonAssistantQuery('Кто сегодня работает?', { schedule: null, today });
assert.equal(missing.intent, 'missing-schedule');
assert.equal(missing.mode, 'attention');
assert.match(missing.text, /не вижу график/);
console.log('✓ помощник честно сообщает об отсутствии данных');

assert.equal(resolveSylonAssistantQuery('Открой склад', context), null);
console.log('✓ команды навигации остаются у существующего маршрутизатора');
