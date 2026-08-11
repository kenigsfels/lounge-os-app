export const SYLON_MODULES = Object.freeze([
  { route: 'employees', label: 'Команда', shortLabel: 'Команда', tone: 'moss', active: true, position: 'left-top' },
  { route: 'schedule', label: 'График смен', shortLabel: 'График', tone: 'amber', active: true, position: 'right-top' },
  { route: 'tasks', label: 'Задачи', shortLabel: 'Задачи', tone: 'stone', active: true, position: 'left-bottom' },
  { route: 'warehouse', label: 'Склад', shortLabel: 'Склад', tone: 'moss', active: true, position: 'right-bottom' },
  { route: 'salary', label: 'Финансы', shortLabel: 'Финансы', tone: 'amber', active: false },
  { route: 'training', label: 'Обучение', shortLabel: 'Обучение', tone: 'stone', active: false },
  { route: 'knowledge', label: 'База знаний', shortLabel: 'Знания', tone: 'stone', active: false },
  { route: 'settings', label: 'Настройки', shortLabel: 'Настройки', tone: 'stone', active: false }
]);

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
    rotation: 0,
    targetRotation: 0,
    velocity: 0,
    depth: 4.25,
    targetDepth: 4.25,
    pointerX: 0,
    pointerY: 0,
    hoveredModule: null,
    dragging: false
  };
}
