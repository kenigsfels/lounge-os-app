import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { executeSylonCommand, resolveSylonCommand } from '../core/command-router.js';
import {
  cycleSylonMode,
  getSylonQualityProfile,
  getSylonMode,
  setSylonMode,
  subscribeSylonMode,
  SYLON_MODES,
  SYLON_MODULES
} from '../core/sylon-state.js';
import { getMapNeighbors, getVisibleMapNodes, SYLON_MAP } from '../core/sylon-map-model.js';
import { supportsMapWebGL } from '../components/sylon-map.js';

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
  assert.equal(resolveSylonCommand('Открой пульс заведения').route, 'analytics');
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

test('карта содержит центральный узел и четыре рабочих пространства', () => {
  assert.equal(SYLON_MAP.rootId, 'sylon');
  assert.deepEqual(
    getVisibleMapNodes().filter((node) => node.route).map((node) => node.route),
    ['employees', 'schedule', 'tasks', 'warehouse']
  );
  assert.equal(getMapNeighbors('sylon').filter((node) => node.enabled !== false).length, 4);
  assert.ok(SYLON_MAP.edges.every((edge) => edge.relation));
});

test('проверка WebGL безопасно включает CSS fallback', () => {
  assert.equal(supportsMapWebGL({ createElement: () => ({ getContext: () => null }) }), false);
  assert.equal(supportsMapWebGL({ createElement: () => ({ getContext: (name) => name === 'webgl' ? {} : null }) }), true);
  assert.equal(supportsMapWebGL(null), false);
});

const mapSource = await readFile(new URL('../components/sylon-map.js', import.meta.url), 'utf8');
const mapModelSource = await readFile(new URL('../core/sylon-map-model.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const homeStyles = await readFile(new URL('../styles/sylon-home.css', import.meta.url), 'utf8');
const homeSource = await readFile(new URL('../screens/home.js', import.meta.url), 'utf8');
const workspaceStyles = await readFile(new URL('../styles/workspace-shell.css', import.meta.url), 'utf8');
const desktopMainSource = await readFile(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const desktopSplashSource = await readFile(new URL('../electron/splash.html', import.meta.url), 'utf8');

test('пространственный слой Map приостанавливается со вкладкой и освобождает WebGL', () => {
  assert.match(mapSource, /visibilitychange/);
  assert.match(mapSource, /cancelAnimationFrame/);
  assert.match(mapSource, /renderer\.dispose\(\)/);
  assert.match(mapSource, /forceContextLoss/);
});

test('Map содержит независимый от WebGL fallback и адаптивный профиль качества', () => {
  assert.match(mapSource, /supportsMapWebGL/);
  assert.match(mapSource, /renderFallback/);
  assert.match(mapSource, /getSylonQualityProfile/);
});

test('SPA вызывает очистку экрана при навигации', () => {
  assert.match(appSource, /cleanupScreen\(\)/);
  assert.match(appSource, /initSylonHomeScreen/);
});

test('Home имеет доступную клавиатурную fallback-навигацию', () => {
  assert.match(homeStyles, /focus-within/);
  assert.match(homeStyles, /focus-visible/);
});

test('пространственная сцена показывает четыре ближайших рабочих узла и смысловые связи', () => {
  assert.match(homeSource, /data-map-node/);
  assert.match(homeSource, /data-map-edge/);
  assert.match(homeSource, /ArrowLeft/);
  assert.match(homeSource, /sylon:map-focus/);
  assert.match(mapModelSource, /relation:/);
});

test('сцена держит навигационный путь в DOM и не записывает его в LocalStorage', () => {
  assert.match(homeSource, /data-map-path/);
  assert.match(homeSource, /setMapFocus/);
  assert.doesNotMatch(homeSource, /localStorage/);
});

test('узел раскрывается в рабочую оболочку, а Dock остаётся резервной навигацией', () => {
  assert.match(homeSource, /sylon-focus-shell/);
  assert.match(homeSource, /getBoundingClientRect/);
  assert.match(homeSource, /dataset\.focusNode/);
  assert.match(homeSource, /dataset\.openingNode/);
  assert.match(appSource, /is-workspace-route/);
  assert.match(workspaceStyles, /\.sylon-focus-shell\.is-active/);
  assert.match(workspaceStyles, /clip-path:circle/);
  assert.match(workspaceStyles, /sylon-map-unfold/);
  assert.match(workspaceStyles, /\.dock:hover/);
});

test('четыре состояния SYLON переключаются в памяти сессии', () => {
  assert.deepEqual(SYLON_MODES.map((mode) => mode.id), ['calm', 'attention', 'analysis', 'issue']);
  const observed = [];
  const unsubscribe = subscribeSylonMode((mode) => observed.push(mode.id));
  setSylonMode('calm');
  cycleSylonMode();
  assert.equal(getSylonMode().id, 'attention');
  assert.equal(getSylonMode().linkedRoute, 'schedule');
  assert.deepEqual(observed.slice(-2), ['calm', 'attention']);
  unsubscribe();
  setSylonMode('calm');
  setSylonMode('calm', { message: 'Реальная сводка', linkedRoute: 'schedule' });
  assert.equal(getSylonMode().message, 'Реальная сводка');
  assert.equal(getSylonMode().linkedRoute, 'schedule');
  setSylonMode('calm');
});

test('состояние меняет Map, контекст, связанный узел и строку SYLON', () => {
  assert.match(mapSource, /subscribeSylonMode/);
  assert.match(mapSource, /mode\.linkedRoute/);
  assert.match(homeSource, /data-sylon-state-toggle/);
  assert.match(homeSource, /mode\.linkedRoute/);
  assert.match(homeStyles, /data-sylon-mode="attention"/);
  assert.match(homeStyles, /data-sylon-mode="issue"/);
});

test('Desktop Preview сохраняет профиль данных и показывает фирменный splash', () => {
  assert.match(desktopMainSource, /setPath\('userData', STABLE_USER_DATA_ROOT\)/);
  assert.match(desktopMainSource, /desktop-window\.json/);
  assert.match(desktopMainSource, /createSplashWindow/);
  assert.match(desktopSplashSource, /Desktop Preview/);
});

console.log(`\nВсе тесты SYLON Home пройдены: ${passed}`);
