const nodes = [
  {
    id: 'sylon',
    kind: 'system',
    label: 'SYLON',
    eyebrow: 'Центр карты',
    detail: 'Система связей активна',
    position: { x: 50, y: 50, z: 0 },
    spatial: { x: 0, y: 0, z: 0 }
  },
  {
    id: 'employees',
    kind: 'workspace',
    label: 'Команда',
    detail: 'Люди и роли',
    route: 'employees',
    tone: 'moss',
    position: { x: 22, y: 27, z: 0.18 },
    spatial: { x: -2.45, y: 1.55, z: 0.2 }
  },
  {
    id: 'schedule',
    kind: 'workspace',
    label: 'График',
    detail: 'Сегодня и дальше',
    route: 'schedule',
    tone: 'amber',
    position: { x: 77, y: 25, z: 0.1 },
    spatial: { x: 2.35, y: 1.7, z: 0.08 }
  },
  {
    id: 'tasks',
    kind: 'workspace',
    label: 'Задачи',
    detail: 'Фокус и действия',
    route: 'tasks',
    tone: 'stone',
    position: { x: 23, y: 74, z: 0.28 },
    spatial: { x: -2.55, y: -1.7, z: 0.28 }
  },
  {
    id: 'warehouse',
    kind: 'workspace',
    label: 'Склад',
    detail: 'Остатки и движение',
    route: 'warehouse',
    tone: 'moss',
    position: { x: 79, y: 70, z: 0.2 },
    spatial: { x: 2.55, y: -1.55, z: 0.2 }
  },
  {
    id: 'training',
    kind: 'workspace',
    label: 'Обучение',
    detail: 'База и развитие',
    route: 'training',
    tone: 'moss',
    position: { x: 17, y: 52, z: 0.34 },
    spatial: { x: -3.05, y: -0.08, z: 0.34 }
  },
  {
    id: 'finance',
    kind: 'workspace',
    label: 'Финансы',
    detail: 'Расчёты и выплаты',
    route: 'salary',
    tone: 'amber',
    position: { x: 83, y: 49, z: 0.26 },
    spatial: { x: 3.08, y: 0.08, z: 0.26 }
  }
];

const edges = [
  { id: 'sylon-employees', source: 'sylon', target: 'employees', relation: 'объединяет команду' },
  { id: 'sylon-schedule', source: 'sylon', target: 'schedule', relation: 'координирует смены' },
  { id: 'sylon-tasks', source: 'sylon', target: 'tasks', relation: 'направляет действия' },
  { id: 'sylon-warehouse', source: 'sylon', target: 'warehouse', relation: 'отслеживает запасы' },
  { id: 'sylon-training', source: 'sylon', target: 'training', relation: 'развивает знания команды' },
  { id: 'sylon-finance', source: 'sylon', target: 'finance', relation: 'связывает смены и выплаты' },
  { id: 'employees-schedule', source: 'employees', target: 'schedule', relation: 'работает по графику' },
  { id: 'tasks-schedule', source: 'tasks', target: 'schedule', relation: 'связаны со сменами' },
  { id: 'warehouse-tasks', source: 'warehouse', target: 'tasks', relation: 'создаёт точки внимания' },
  { id: 'training-employees', source: 'training', target: 'employees', relation: 'развивает навыки людей' },
  { id: 'finance-schedule', source: 'finance', target: 'schedule', relation: 'считает рабочее время' }
];

export const SYLON_MAP = Object.freeze({
  rootId: 'sylon',
  nodes: Object.freeze(nodes.map((node) => Object.freeze(node))),
  edges: Object.freeze(edges.map((edge) => Object.freeze(edge)))
});

export function getVisibleMapNodes(map = SYLON_MAP) {
  return map.nodes.filter((node) => node.id === map.rootId || node.enabled !== false);
}

export function getMapNode(nodeId, map = SYLON_MAP) {
  return map.nodes.find((node) => node.id === nodeId) || null;
}

export function getMapNeighbors(nodeId, map = SYLON_MAP) {
  const neighborIds = new Set();
  map.edges.forEach((edge) => {
    if (edge.source === nodeId) neighborIds.add(edge.target);
    if (edge.target === nodeId) neighborIds.add(edge.source);
  });
  return map.nodes.filter((node) => neighborIds.has(node.id));
}
