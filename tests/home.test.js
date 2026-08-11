import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { executeSylonCommand, resolveSylonCommand } from '../core/command-router.js';
import { createSylonInteractionState, getSylonQualityProfile, SYLON_MODULES } from '../core/sylon-state.js';
import { supportsWebGL } from '../components/sylon-core.js';

let passed = 0;
function test(name, callback) {
  callback();
  passed += 1;
  console.log(`✓ ${name}`);
}

test('команды на русском открывают существующие разделы', () => {
  assert.equal(resolveSylonCommand('Покажи график на пятницу').route, 'schedule');
  assert.equal(resolveSylonCommand('Кто сегодня работает?').route, 'schedule');
  assert.equal(resolveSylonCommand('Открой склад').route, 'warehouse');
  assert.equal(resolveSylonCommand('Покажи команду').route, 'employees');
});

test('неизвестная команда безопасно остаётся в интерфейсе', () => {
  let message = '';
  const result = executeSylonCommand('сделай прогноз', { navigate: () => assert.fail(), showToast: (value) => { message = value; } });
  assert.equal(result.type, 'unknown');
  assert.match(message, /Пока я умею/);
});

test('пустая команда не запускает навигацию', () => {
  assert.equal(resolveSylonCommand('   ').type, 'empty');
});

test('четыре основных модуля ведут в рабочие маршруты', () => {
  assert.deepEqual(SYLON_MODULES.filter((item) => item.active).map((item) => item.route), ['employees', 'schedule', 'tasks', 'warehouse']);
});

test('профиль качества уважает reduced motion и слабое устройство', () => {
  const profile = getSylonQualityProfile({
    devicePixelRatio: 3,
    navigator: { hardwareConcurrency: 2, deviceMemory: 2 },
    matchMedia: () => ({ matches: true })
  });
  assert.equal(profile.reducedMotion, true);
  assert.equal(profile.tier, 'balanced');
  assert.ok(profile.pixelRatio <= 1.25);
  assert.ok(profile.particles < 100);
});

test('начальное состояние Core ограничивает глубину и движение', () => {
  const state = createSylonInteractionState();
  assert.equal(state.depth, 4.25);
  assert.equal(state.dragging, false);
  assert.equal(state.velocity, 0);
});

test('проверка WebGL безопасно включает CSS fallback', () => {
  assert.equal(supportsWebGL({ createElement: () => ({ getContext: () => null }) }), false);
  assert.equal(supportsWebGL({ createElement: () => ({ getContext: (name) => name === 'webgl' ? {} : null }) }), true);
  assert.equal(supportsWebGL(null), false);
});

const coreSource = await readFile(new URL('../components/sylon-core.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const homeStyles = await readFile(new URL('../styles/sylon-home.css', import.meta.url), 'utf8');

test('Core приостанавливается со вкладкой и освобождает WebGL', () => {
  assert.match(coreSource, /visibilitychange/);
  assert.match(coreSource, /cancelAnimationFrame/);
  assert.match(coreSource, /renderer\.dispose\(\)/);
  assert.match(coreSource, /forceContextLoss/);
});

test('Core содержит WebGL fallback и адаптивное качество', () => {
  assert.match(coreSource, /supportsWebGL/);
  assert.match(coreSource, /renderFallback/);
  assert.match(coreSource, /dataset\.quality = 'adaptive'/);
});

test('SPA вызывает очистку экрана при навигации', () => {
  assert.match(appSource, /cleanupScreen\(\)/);
  assert.match(appSource, /initSylonHomeScreen/);
});

test('Home имеет доступную клавиатурную fallback-навигацию', () => {
  assert.match(homeStyles, /focus-within/);
  assert.match(homeStyles, /focus-visible/);
});

console.log(`\nВсе тесты SYLON Home пройдены: ${passed}`);
