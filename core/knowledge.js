import { generateId } from './ids.js';
import { readStorage, writeStorage } from './storage.js';

const KNOWLEDGE_KEY = 'knowledge';

export const KNOWLEDGE_CATEGORIES = Object.freeze([
  { id: 'shift', label: 'Смена' },
  { id: 'service', label: 'Сервис' },
  { id: 'hookah', label: 'Кальяны' },
  { id: 'bar', label: 'Бар' },
  { id: 'equipment', label: 'Оборудование' },
  { id: 'safety', label: 'Безопасность' },
  { id: 'team', label: 'Команда' }
]);

const DEMO_REGULATIONS = Object.freeze([
  { title: 'Открытие смены', situation: 'Открываю смену', category: 'shift', summary: 'Подготовить пространство, кассу и команду к началу работы.', steps: ['Проверить чистоту гостевой зоны и санузлов', 'Включить оборудование и проверить рабочее состояние', 'Сверить команду с графиком', 'Проверить основные остатки и стоп-лист'], checklist: ['Гостевая зона готова', 'Оборудование работает', 'Команда на месте', 'Стоп-лист актуален'], warnings: ['Это демонстрационный регламент — адаптируй его под реальные правила заведения.'], pinned: true },
  { title: 'Закрытие заведения', situation: 'Закрываю заведение', category: 'shift', summary: 'Спокойно завершить смену и оставить готовое пространство следующей команде.', steps: ['Проверить закрытие гостевых заказов', 'Убрать рабочие зоны', 'Выключить оборудование по правилам', 'Передать важные события следующей смене'], checklist: ['Заказы закрыты', 'Рабочие зоны убраны', 'Оборудование выключено', 'Комментарий о смене передан'], warnings: [], pinned: true },
  { title: 'Гость недоволен', situation: 'Гость недоволен', category: 'service', summary: 'Сначала услышать гостя, затем предложить понятное решение.', steps: ['Спокойно выслушать гостя, не перебивая', 'Уточнить, что именно не соответствует ожиданию', 'Предложить решение в пределах полномочий', 'Проверить результат через несколько минут'], checklist: ['Причина понятна', 'Решение предложено', 'Результат проверен'], warnings: ['Не спорить с гостем и не обещать компенсацию, которая не утверждена.'], pinned: true },
  { title: 'Проблема с оборудованием', situation: 'Не работает оборудование', category: 'equipment', summary: 'Безопасно остановить использование и зафиксировать проблему.', steps: ['Прекратить использование оборудования', 'Отключить питание, если это безопасно', 'Сообщить ответственному', 'Создать задачу на проверку или ремонт'], checklist: ['Использование остановлено', 'Ответственный уведомлён', 'Проблема зафиксирована'], warnings: ['Не разбирай оборудование под напряжением.'], pinned: false },
  { title: 'Приготовление кальяна', situation: 'Готовлю кальян', category: 'hookah', summary: 'Базовый демонстрационный порядок контроля качества.', steps: ['Уточнить пожелания гостя', 'Подобрать чашу и крепость', 'Проверить чистоту оборудования', 'Приготовить и проверить вкус перед подачей'], checklist: ['Пожелания уточнены', 'Оборудование чистое', 'Вкус проверен'], warnings: ['Замени этот пример своей утверждённой технологической картой.'], pinned: false },
  { title: 'Первый день сотрудника', situation: 'Обучаю нового сотрудника', category: 'team', summary: 'Дать человеку понятную опору в первый рабочий день.', steps: ['Познакомить с командой и пространством', 'Показать правила безопасности', 'Объяснить роль и границы ответственности', 'Назначить человека для вопросов'], checklist: ['Команда представлена', 'Безопасность объяснена', 'Наставник назначен'], warnings: [], pinned: false }
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function strings(value) {
  return (Array.isArray(value) ? value : []).map((item) => String(item ?? '').trim()).filter(Boolean);
}

function normalizeRegulation(value) {
  const category = KNOWLEDGE_CATEGORIES.some((item) => item.id === value?.category) ? value.category : 'service';
  return {
    id: String(value?.id ?? ''), title: String(value?.title ?? '').trim(), situation: String(value?.situation ?? '').trim(),
    category, summary: String(value?.summary ?? '').trim(), steps: strings(value?.steps), checklist: strings(value?.checklist),
    warnings: strings(value?.warnings), pinned: Boolean(value?.pinned), demo: Boolean(value?.demo),
    createdAt: String(value?.createdAt ?? ''), updatedAt: String(value?.updatedAt ?? '')
  };
}

function seededState() {
  const now = new Date().toISOString();
  return { version: 1, items: DEMO_REGULATIONS.map((item, index) => normalizeRegulation({ ...item, id: `demo_regulation_${index + 1}`, demo: true, createdAt: now, updatedAt: now })), progress: {} };
}

function normalizeState(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.items)) return seededState();
  const items = value.items.map(normalizeRegulation).filter((item) => item.id && item.title);
  const progress = value.progress && typeof value.progress === 'object' && !Array.isArray(value.progress) ? value.progress : {};
  return { version: 1, items, progress: clone(progress) };
}

function saveState(state) {
  return writeStorage(KNOWLEDGE_KEY, normalizeState(state));
}

export function getKnowledgeState() {
  const stored = readStorage(KNOWLEDGE_KEY, null);
  if (stored) return normalizeState(stored);
  const initial = seededState();
  saveState(initial);
  return clone(initial);
}

export function getRegulations() {
  return getKnowledgeState().items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

export function createRegulation(data) {
  const title = String(data?.title ?? '').trim();
  const situation = String(data?.situation ?? '').trim();
  if (!title || !situation) return { success: false, errors: ['Укажи название и ситуацию'] };
  const state = getKnowledgeState();
  const now = new Date().toISOString();
  const item = normalizeRegulation({ ...data, id: generateId('regulation'), title, situation, demo: false, createdAt: now, updatedAt: now });
  if (!saveState({ ...state, items: [...state.items, item] })) return { success: false, errors: ['Не удалось сохранить регламент'] };
  return { success: true, item: clone(item) };
}

export function updateRegulation(id, changes) {
  const state = getKnowledgeState();
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return { success: false, errors: ['Регламент не найден'] };
  const item = normalizeRegulation({ ...state.items[index], ...changes, id, demo: state.items[index].demo, createdAt: state.items[index].createdAt, updatedAt: new Date().toISOString() });
  if (!item.title || !item.situation) return { success: false, errors: ['Укажи название и ситуацию'] };
  const items = state.items.map((value, itemIndex) => itemIndex === index ? item : value);
  if (!saveState({ ...state, items })) return { success: false, errors: ['Не удалось обновить регламент'] };
  return { success: true, item: clone(item) };
}

export function deleteRegulation(id) {
  const state = getKnowledgeState();
  const items = state.items.filter((item) => item.id !== id);
  if (items.length === state.items.length) return false;
  const progress = { ...state.progress };
  delete progress[id];
  return saveState({ ...state, items, progress });
}

export function setRegulationPinned(id, pinned) {
  return updateRegulation(id, { pinned: Boolean(pinned) });
}

export function setChecklistItem(id, index, completed) {
  const state = getKnowledgeState();
  const item = state.items.find((value) => value.id === id);
  if (!item || index < 0 || index >= item.checklist.length) return false;
  const current = new Set(Array.isArray(state.progress[id]) ? state.progress[id] : []);
  if (completed) current.add(index); else current.delete(index);
  return saveState({ ...state, progress: { ...state.progress, [id]: [...current].sort((a, b) => a - b) } });
}

export function resetRegulationProgress(id) {
  const state = getKnowledgeState();
  const progress = { ...state.progress, [id]: [] };
  return saveState({ ...state, progress });
}
