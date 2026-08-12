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
const knowledge = await import('../core/knowledge.js');

const initial = knowledge.getKnowledgeState();
assert.equal(initial.items.length, 6);
assert.equal(initial.items.every((item) => item.demo), true);
assert.equal(initial.items.some((item) => item.situation === 'Гость недоволен'), true);
console.log('✓ при первом открытии доступны заменяемые демонстрационные ситуации');

const created = knowledge.createRegulation({
  title: 'Проверка зала', situation: 'Проверяю зал', category: 'shift', summary: 'Перед открытием',
  steps: ['Проверить столы', 'Проверить свет'], checklist: ['Столы готовы', 'Свет работает'], warnings: ['Не включать повреждённое оборудование'], pinned: true
});
assert.equal(created.success, true);
assert.equal(created.item.steps.length, 2);
assert.equal(created.item.demo, false);
console.log('✓ пользовательский регламент создаётся из шагов и чек-листа');

assert.equal(knowledge.setChecklistItem(created.item.id, 0, true), true);
assert.deepEqual(knowledge.getKnowledgeState().progress[created.item.id], [0]);
knowledge.resetRegulationProgress(created.item.id);
assert.deepEqual(knowledge.getKnowledgeState().progress[created.item.id], []);
console.log('✓ прогресс чек-листа запоминается и сбрасывается');

const updated = knowledge.updateRegulation(created.item.id, { title: 'Проверка гостевого зала', pinned: false });
assert.equal(updated.success, true);
assert.equal(updated.item.title, 'Проверка гостевого зала');
assert.equal(updated.item.steps.length, 2);
console.log('✓ регламент редактируется без потери остальных полей');

assert.equal(knowledge.deleteRegulation(created.item.id), true);
assert.equal(knowledge.getKnowledgeState().items.some((item) => item.id === created.item.id), false);
console.log('✓ регламент удаляется вместе с прогрессом');

for (const item of knowledge.getKnowledgeState().items) knowledge.deleteRegulation(item.id);
assert.equal(knowledge.getRegulations().length, 0);
assert.equal(knowledge.getKnowledgeState().items.length, 0);
console.log('✓ удалённые демонстрационные материалы не появляются повторно');
