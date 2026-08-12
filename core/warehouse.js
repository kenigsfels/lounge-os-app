import { generateId } from './ids.js';
import { readStorage, writeStorage } from './storage.js';

const ITEMS_KEY = 'warehouse_items';
const MOVEMENTS_KEY = 'warehouse_movements';
export const WAREHOUSE_CATEGORIES = Object.freeze([
  { id: 'tobacco', label: 'Табак' }, { id: 'coal', label: 'Уголь' },
  { id: 'supplies', label: 'Расходники' }, { id: 'bar', label: 'Бар' },
  { id: 'equipment', label: 'Оборудование' }
]);

const clone = (value) => JSON.parse(JSON.stringify(value));
const number = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const categoryIds = new Set(WAREHOUSE_CATEGORIES.map((category) => category.id));

function normalizeItem(value) {
  return {
    id: String(value?.id || ''), name: String(value?.name || '').trim(),
    category: categoryIds.has(value?.category) ? value.category : 'supplies',
    unit: String(value?.unit || 'шт.').trim(), quantity: number(value?.quantity),
    minimum: number(value?.minimum), notes: String(value?.notes || '').trim(),
    createdAt: String(value?.createdAt || ''), updatedAt: String(value?.updatedAt || '')
  };
}

function saveItems(items) { return writeStorage(ITEMS_KEY, items.map(normalizeItem)); }
function saveMovements(items) { return writeStorage(MOVEMENTS_KEY, items); }
export function getWarehouseItems() {
  const items = readStorage(ITEMS_KEY, []);
  return Array.isArray(items) ? clone(items.map(normalizeItem).filter((item) => item.id && item.name)) : [];
}
export function getWarehouseMovements() {
  const items = readStorage(MOVEMENTS_KEY, []);
  return Array.isArray(items) ? clone(items).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
}

export function getStockState(item) {
  if (item.quantity <= 0) return 'empty';
  if (item.minimum > 0 && item.quantity <= item.minimum) return 'low';
  return 'ok';
}

export function getWarehouseOverview(items = getWarehouseItems()) {
  const states = items.map((item) => ({ ...item, stockState: getStockState(item) }));
  const attention = states.filter((item) => item.stockState !== 'ok')
    .sort((a, b) => (a.stockState === 'empty' ? -1 : 1));
  return { items: states, attention, empty: attention.filter((item) => item.stockState === 'empty'), ok: states.filter((item) => item.stockState === 'ok') };
}

export function createWarehouseItem(data) {
  const name = String(data?.name || '').trim();
  if (!name) return { success: false, errors: ['Укажи название позиции'] };
  const now = new Date().toISOString();
  const item = normalizeItem({ ...data, id: generateId('stock'), name, createdAt: now, updatedAt: now });
  if (!saveItems([...getWarehouseItems(), item])) return { success: false, errors: ['Не удалось сохранить позицию'] };
  return { success: true, item: clone(item) };
}

export function updateWarehouseItem(id, changes) {
  const items = getWarehouseItems();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return { success: false, errors: ['Позиция не найдена'] };
  const item = normalizeItem({ ...items[index], ...changes, id, createdAt: items[index].createdAt, updatedAt: new Date().toISOString() });
  if (!item.name) return { success: false, errors: ['Укажи название позиции'] };
  if (!saveItems(items.map((value, itemIndex) => itemIndex === index ? item : value))) return { success: false, errors: ['Не удалось обновить позицию'] };
  return { success: true, item: clone(item) };
}

export function recordStockMovement(id, { type, amount, comment = '' } = {}) {
  const items = getWarehouseItems();
  const item = items.find((value) => value.id === id);
  const delta = number(amount);
  if (!item) return { success: false, errors: ['Позиция не найдена'] };
  if (!['income', 'expense'].includes(type) || delta <= 0) return { success: false, errors: ['Укажи корректное движение и количество'] };
  if (type === 'expense' && delta > item.quantity) return { success: false, errors: ['Нельзя списать больше текущего остатка'] };
  const nextQuantity = type === 'income' ? item.quantity + delta : item.quantity - delta;
  const movement = { id: generateId('movement'), itemId: id, itemName: item.name, type, amount: delta, before: item.quantity, after: nextQuantity, comment: String(comment).trim(), createdAt: new Date().toISOString() };
  const originalItems = clone(items);
  const updated = updateWarehouseItem(id, { quantity: nextQuantity });
  if (!updated.success) return updated;
  if (!saveMovements([movement, ...getWarehouseMovements()])) {
    saveItems(originalItems);
    return { success: false, errors: ['Не удалось сохранить движение'] };
  }
  return { success: true, item: updated.item, movement: clone(movement) };
}

export function reconcileWarehouseItem(id, actualQuantity, comment = 'Инвентаризация') {
  const item = getWarehouseItems().find((value) => value.id === id);
  const actual = number(actualQuantity);
  if (!item) return { success: false, errors: ['Позиция не найдена'] };
  if (actual === item.quantity) return { success: true, item, movement: null };
  return recordStockMovement(id, { type: actual > item.quantity ? 'income' : 'expense', amount: Math.abs(actual - item.quantity), comment });
}

export function deleteWarehouseItem(id) {
  const items = getWarehouseItems();
  const next = items.filter((item) => item.id !== id);
  return next.length !== items.length && saveItems(next);
}
