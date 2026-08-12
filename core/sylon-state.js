export const SYLON_MODULES = Object.freeze([
  { route: 'analytics', label: 'Пульс заведения', shortLabel: 'Пульс', tone: 'moss', active: false },
  { route: 'employees', label: 'Команда', shortLabel: 'Команда', tone: 'moss', active: true, position: 'left-top' },
  { route: 'schedule', label: 'График смен', shortLabel: 'График', tone: 'amber', active: true, position: 'right-top' },
  { route: 'tasks', label: 'Задачи', shortLabel: 'Задачи', tone: 'stone', active: true, position: 'left-bottom' },
  { route: 'warehouse', label: 'Склад', shortLabel: 'Склад', tone: 'moss', active: true, position: 'right-bottom' },
  { route: 'salary', label: 'Финансы', shortLabel: 'Финансы', tone: 'amber', active: false },
  { route: 'training', label: 'Обучение', shortLabel: 'Обучение', tone: 'stone', active: false },
  { route: 'knowledge', label: 'База знаний', shortLabel: 'Знания', tone: 'stone', active: false },
  { route: 'settings', label: 'Настройки', shortLabel: 'Настройки', tone: 'stone', active: false }
]);

export const SYLON_MODES = Object.freeze([
  {
    id: 'calm',
    label: 'Система спокойна',
    eyebrow: 'Состояние заведения',
    message: 'Сегодня всё спокойно.',
    detail: 'Можно двигаться в обычном ритме.',
    linkedRoute: null
  },
  {
    id: 'attention',
    label: 'Нужно внимание',
    eyebrow: 'Стоит проверить',
    message: 'Есть одна вещь, которую стоит проверить.',
    detail: 'График перед ближайшей сменой.',
    linkedRoute: 'schedule'
  },
  {
    id: 'analysis',
    label: 'SYLON смотрит',
    eyebrow: 'Идёт анализ',
    message: 'Смотрю на связи внутри системы.',
    detail: 'Это займёт несколько мгновений.',
    linkedRoute: null
  },
  {
    id: 'issue',
    label: 'Требуется действие',
    eyebrow: 'Нужен ответ',
    message: 'В графике есть незакрытый участок.',
    detail: 'Лучше решить это до начала смены.',
    linkedRoute: 'schedule'
  }
]);

let activeModeIndex = 0;
let activeModeOverrides = {};
const modeListeners = new Set();

export function getSylonMode() {
  return { ...SYLON_MODES[activeModeIndex], ...activeModeOverrides };
}

export function setSylonMode(modeId, overrides = {}) {
  const nextIndex = SYLON_MODES.findIndex((mode) => mode.id === modeId);
  if (nextIndex < 0) return getSylonMode();
  activeModeIndex = nextIndex;
  activeModeOverrides = overrides && typeof overrides === 'object' ? { ...overrides } : {};
  const mode = getSylonMode();
  modeListeners.forEach((listener) => listener(mode));
  return mode;
}

export function cycleSylonMode() {
  activeModeIndex = (activeModeIndex + 1) % SYLON_MODES.length;
  activeModeOverrides = {};
  const mode = getSylonMode();
  modeListeners.forEach((listener) => listener(mode));
  return mode;
}

export function subscribeSylonMode(listener) {
  modeListeners.add(listener);
  listener(getSylonMode());
  return () => modeListeners.delete(listener);
}

const sceneMemory = {
  orbitStart: 0,
  rotation: 0,
  targetRotation: 0,
  depth: 4.25,
  targetDepth: 4.25
};

export function getSylonOrbitStart() {
  return sceneMemory.orbitStart;
}

export function rememberSylonOrbitStart(index) {
  const moduleCount = SYLON_MODULES.filter((module) => module.active).length;
  sceneMemory.orbitStart = ((Number(index) || 0) + moduleCount) % moduleCount;
}

export function rememberSylonInteractionState(state) {
  sceneMemory.rotation = state.rotation;
  sceneMemory.targetRotation = state.targetRotation;
  sceneMemory.depth = state.depth;
  sceneMemory.targetDepth = state.targetDepth;
}

export function getSylonQualityProfile(environment = globalThis) {
  const reducedMotion = environment.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const cores = environment.navigator?.hardwareConcurrency ?? 4;
  const memory = environment.navigator?.deviceMemory ?? 4;
  const lowPower = reducedMotion || cores <= 4 || memory <= 4;

  return {
    reducedMotion,
    tier: lowPower ? 'balanced' : 'high',
    particles: lowPower ? 72 : 132,
    pixelRatio: Math.min(environment.devicePixelRatio || 1, lowPower ? 1.25 : 1.75)
  };
}

export function createSylonInteractionState() {
  return {
    rotation: sceneMemory.rotation,
    targetRotation: sceneMemory.targetRotation,
    velocity: 0,
    depth: sceneMemory.depth,
    targetDepth: sceneMemory.targetDepth,
    pointerX: 0,
    pointerY: 0,
    hoveredModule: null,
    dragging: false,
    mode: getSylonMode().id,
    modeEnteredAt: 0
  };
}
