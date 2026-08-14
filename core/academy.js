import { readStorage, writeStorage } from './storage.js';

const ACADEMY_KEY = 'ambassador_academy';
const VALID_STATUSES = new Set(['not_started', 'learning', 'mastered']);

const SEED_NODES = Object.freeze([
  { id: 'base', parentId: '', type: 'root', title: 'База', subtitle: 'Личная Academy', order: 0 },
  { id: 'darkside', parentId: 'base', type: 'branch', title: 'DARKSIDE', subtitle: 'Продукт и работа амбассадора', order: 0 },
  { id: 'science', parentId: 'base', type: 'branch', title: 'Физика и химия', subtitle: 'Наука курения', order: 1 },
  { id: 'ds_brand', parentId: 'darkside', type: 'folder', title: 'Бренд', subtitle: 'История и философия', order: 0 },
  { id: 'ds_product', parentId: 'darkside', type: 'folder', title: 'Продукт', subtitle: 'Линейки, вкусы и сырьё', order: 1 },
  { id: 'ds_technology', parentId: 'darkside', type: 'folder', title: 'Технология', subtitle: 'Работа с продуктом', order: 2 },
  { id: 'ds_mixology', parentId: 'darkside', type: 'folder', title: 'Миксология', subtitle: 'Сочетания и профили', order: 3 },
  { id: 'ds_ambassador', parentId: 'darkside', type: 'folder', title: 'Амбассадор', subtitle: 'Презентация и партнёры', order: 4 },
  { id: 'ds_internal', parentId: 'darkside', type: 'folder', title: 'Материалы компании', subtitle: 'Личное хранилище', order: 5 },
  { id: 'science_heat', parentId: 'science', type: 'folder', title: 'Тепло', subtitle: 'Передача и режимы', order: 0 },
  { id: 'science_air', parentId: 'science', type: 'folder', title: 'Воздушный поток', subtitle: 'Тяга и сопротивление', order: 1 },
  { id: 'science_coal', parentId: 'science', type: 'folder', title: 'Горение угля', subtitle: 'Тепло и продукты горения', order: 2 },
  { id: 'science_aerosol', parentId: 'science', type: 'folder', title: 'Аэрозоль и дым', subtitle: 'Образование и охлаждение', order: 3 },
  { id: 'science_materials', parentId: 'science', type: 'folder', title: 'Сырьё', subtitle: 'Лист, глицерин, аромат', order: 4 },
  { id: 'science_sensory', parentId: 'science', type: 'folder', title: 'Вкус и аромат', subtitle: 'Восприятие и баланс', order: 5 },
  { id: 'science_safety', parentId: 'science', type: 'folder', title: 'Безопасность', subtitle: 'Риски и гигиена', order: 6 },
  { id: 'lesson_academy', parentId: 'ds_brand', type: 'lesson', title: 'Карта DARKSIDE Academy', subtitle: 'Демонстрационный урок', order: 0, summary: 'Как устроить официальные и внутренние материалы в единую личную систему обучения.', sections: ['Официальная Academy остаётся первичным источником.', 'Внутренние материалы компании хранятся отдельно и дополняют публичную базу.', 'Каждый итоговый урок должен сохранять источники и дату проверки.'], takeaways: ['Не копировать курс целиком', 'Отделять факт от личной заметки', 'Обновлять конспект при изменении источника'], sources: [{ title: 'ACADEMY by DARKSIDE CORP.', url: 'https://darkside-world.com/academy' }] },
  { id: 'lesson_heat', parentId: 'science_heat', type: 'lesson', title: 'Три пути передачи тепла', subtitle: 'Демонстрационный урок', order: 0, summary: 'Теплопроводность, конвекция и излучение одновременно влияют на нагрев чаши и смеси.', sections: ['Теплопроводность передаёт энергию через прямой контакт материалов.', 'Конвекция переносит тепло движущимся воздухом.', 'Излучение передаёт энергию от горячих поверхностей без прямого контакта.'], takeaways: ['Способ размещения угля меняет баланс механизмов', 'Воздушный поток влияет не только на тягу, но и на перенос тепла'], sources: [] },
  { id: 'lesson_safety', parentId: 'science_safety', type: 'lesson', title: 'Уголь и угарный газ', subtitle: 'Научная основа', order: 0, summary: 'Уголь является отдельным источником угарного газа и других продуктов горения.', sections: ['Вода не делает вдыхаемый аэрозоль безопасным.', 'Состав выбросов зависит от топлива, смеси и режима использования.', 'Научные и медицинские утверждения должны опираться на проверяемые источники.'], takeaways: ['Проветривание не отменяет риск', 'Безопасность нельзя заменять маркетинговыми утверждениями'], sources: [{ title: 'WHO: Waterpipe tobacco smoking', url: 'https://www.who.int/publications-detail-redirect/fact-sheet-waterpipe-tobacco-smoking-and-health' }] }
]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function normalizeNode(value) {
  return {
    id: String(value?.id ?? ''), parentId: String(value?.parentId ?? ''),
    type: ['root', 'branch', 'folder', 'lesson'].includes(value?.type) ? value.type : 'folder',
    title: String(value?.title ?? '').trim(), subtitle: String(value?.subtitle ?? '').trim(),
    order: Number(value?.order) || 0, summary: String(value?.summary ?? '').trim(),
    sections: Array.isArray(value?.sections) ? value.sections.map(String).filter(Boolean) : [],
    takeaways: Array.isArray(value?.takeaways) ? value.takeaways.map(String).filter(Boolean) : [],
    sources: Array.isArray(value?.sources) ? value.sources.map((source) => ({ title: String(source?.title ?? ''), url: String(source?.url ?? '') })).filter((source) => source.title && /^https?:\/\//.test(source.url)) : []
  };
}

function seedState() {
  return { version: 1, nodes: SEED_NODES.map(normalizeNode), progress: {}, view: { activeId: 'base', rotation: 0, scale: 1, entered: false } };
}

function normalizeState(value) {
  if (!value || !Array.isArray(value.nodes)) return seedState();
  const nodes = value.nodes.map(normalizeNode).filter((node) => node.id && node.title);
  const ids = new Set(nodes.map((node) => node.id));
  const progress = Object.fromEntries(Object.entries(value.progress || {}).filter(([id, status]) => ids.has(id) && VALID_STATUSES.has(status)));
  const activeId = ids.has(value.view?.activeId) ? value.view.activeId : 'base';
  return { version: 1, nodes, progress, view: { activeId, rotation: Number(value.view?.rotation) || 0, scale: Math.min(1.35, Math.max(.72, Number(value.view?.scale) || 1)), entered: Boolean(value.view?.entered) } };
}

function save(state) { return writeStorage(ACADEMY_KEY, normalizeState(state)); }

export function getAcademyState() {
  const stored = readStorage(ACADEMY_KEY, null);
  if (stored) return normalizeState(stored);
  const initial = seedState(); save(initial); return clone(initial);
}

export function getAcademyNode(id, state = getAcademyState()) { return clone(state.nodes.find((node) => node.id === id) || null); }
export function getAcademyChildren(id, state = getAcademyState()) { return clone(state.nodes.filter((node) => node.parentId === id).sort((a, b) => a.order - b.order)); }

export function getAcademyPath(id, state = getAcademyState()) {
  const path = []; let node = state.nodes.find((item) => item.id === id); const visited = new Set();
  while (node && !visited.has(node.id)) { visited.add(node.id); path.unshift(node); node = state.nodes.find((item) => item.id === node.parentId); }
  return clone(path);
}

export function getAcademyProgress(id, state = getAcademyState()) {
  const node = state.nodes.find((item) => item.id === id);
  if (!node) return { status: 'not_started', completed: 0, total: 0, percent: 0 };
  const descendants = [];
  const visit = (parentId) => state.nodes.filter((item) => item.parentId === parentId).forEach((child) => { if (child.type === 'lesson') descendants.push(child); else visit(child.id); });
  if (node.type === 'lesson') descendants.push(node); else visit(node.id);
  const total = descendants.length;
  const completed = descendants.filter((item) => state.progress[item.id] === 'mastered').length;
  const learning = descendants.some((item) => state.progress[item.id] === 'learning');
  const status = total > 0 && completed === total ? 'mastered' : (completed > 0 || learning ? 'learning' : 'not_started');
  return { status, completed, total, percent: total ? Math.round(completed / total * 100) : 0 };
}

export function setAcademyLessonStatus(id, status) {
  const state = getAcademyState(); const node = state.nodes.find((item) => item.id === id);
  if (!node || node.type !== 'lesson' || !VALID_STATUSES.has(status)) return false;
  return save({ ...state, progress: { ...state.progress, [id]: status } });
}

export function rememberAcademyView(changes) {
  const state = getAcademyState();
  return save({ ...state, view: { ...state.view, ...changes } });
}
