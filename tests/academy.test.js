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
const academy = await import('../core/academy.js');

const initial = academy.getAcademyState();
assert.equal(initial.view.activeId, 'base');
assert.equal(initial.view.entered, false);
assert.deepEqual(academy.getAcademyChildren('base', initial).map((node) => node.id), ['darkside', 'science']);
console.log('✓ личная Academy начинается с Базы и двух главных направлений');

assert.deepEqual(academy.getAcademyPath('lesson_heat', initial).map((node) => node.id), ['base', 'science', 'science_heat', 'lesson_heat']);
assert.equal(academy.getAcademyChildren('darkside', initial).length, 6);
assert.equal(academy.getAcademyChildren('science', initial).length, 7);
console.log('✓ дерево сохраняет порядок, родителей и путь к уроку');

assert.equal(academy.setAcademyLessonStatus('lesson_heat', 'learning'), true);
assert.equal(academy.getAcademyProgress('science').status, 'learning');
assert.equal(academy.setAcademyLessonStatus('lesson_heat', 'mastered'), true);
assert.equal(academy.getAcademyProgress('science_heat').percent, 100);
assert.equal(academy.setAcademyLessonStatus('science_heat', 'mastered'), false);
console.log('✓ прогресс урока поднимается по ветвям, а папку нельзя отметить уроком');

assert.equal(academy.rememberAcademyView({ activeId: 'science', entered: true, rotation: 1.2, scale: 9 }), true);
const restored = academy.getAcademyState();
assert.equal(restored.view.activeId, 'science');
assert.equal(restored.view.entered, true);
assert.equal(restored.view.rotation, 1.2);
assert.equal(restored.view.scale, 1.35);
console.log('✓ позиция карты восстанавливается с безопасными границами масштаба');
