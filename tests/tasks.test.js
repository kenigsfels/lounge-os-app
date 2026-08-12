import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();

const { createTask, deleteTask, getTasks, getTaskOverview, setTaskCompleted, updateTask } = await import('../core/tasks.js');

const created = createTask({ title: '  Проверить остатки  ' });
assert.equal(created.success, true);
assert.equal(created.task.title, 'Проверить остатки');
assert.equal(created.task.lane, 'today');
assert.equal(getTasks().length, 1);
console.log('✓ задача создаётся локально одной строкой');

const updated = updateTask(created.task.id, {
  lane: 'now',
  assigneeId: 'employee_1',
  dueDate: '2026-08-11',
  dueTime: '18:00',
  shiftDate: '2026-08-12'
});
assert.equal(updated.success, true);
assert.equal(updated.task.assigneeId, 'employee_1');
assert.equal(updated.task.lane, 'now');
console.log('✓ детали, ответственный и связь со сменой сохраняются');

const overview = getTaskOverview(getTasks(), new Date('2026-08-12T12:00:00'));
assert.equal(overview.overdue.length, 1);
assert.equal(overview.focus.id, created.task.id);
assert.match(overview.focusReason, /Срок уже прошёл/);
console.log('✓ просроченная задача автоматически становится фокусом');

const later = createTask({ title: 'Заказать форму', lane: 'later' });
assert.equal(getTaskOverview(getTasks(), new Date('2026-08-12T12:00:00')).later.length, 1);
console.log('✓ потоки «Сейчас», «Сегодня» и «Позже» разделяются');

assert.equal(setTaskCompleted(created.task.id, true).success, true);
const afterComplete = getTaskOverview(getTasks(), new Date('2026-08-12T12:00:00'));
assert.equal(afterComplete.completed.length, 1);
assert.equal(afterComplete.focus.id, later.task.id);
console.log('✓ выполненная задача уходит в историю и сохраняется');

assert.equal(setTaskCompleted(created.task.id, false).success, true);
assert.equal(getTaskOverview(getTasks(), new Date('2026-08-12T12:00:00')).open.length, 2);
console.log('✓ задачу можно вернуть из истории');

assert.equal(createTask({ title: '   ' }).success, false);
console.log('✓ пустая задача не создаётся');

assert.equal(deleteTask(later.task.id), true);
assert.equal(getTasks().some((task) => task.id === later.task.id), false);
console.log('✓ задачу можно удалить с явным действием');
