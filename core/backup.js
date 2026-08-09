import { readStorage, writeStorage, removeStorage } from './storage.js';
import { generateId } from './ids.js';

const APP_PREFIX = 'lounge_os_';
const SNAPSHOTS_KEY = 'lounge_os_local_snapshots';
const SNAPSHOTS_STORAGE_NAME = 'local_snapshots';
const APP_NAME = 'Lounge OS';
const APP_VERSION = '0.3.0';
const FORMAT_VERSION = 1;
const MAX_LOCAL_SNAPSHOTS = 10;

function getStorage() {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    ));
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function calculateChecksum(value) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function getRawAppState({ includeSnapshots = true } = {}) {
  const storage = getStorage();
  const state = {};
  if (!storage) return state;

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(APP_PREFIX)) continue;
      if (!includeSnapshots && key === SNAPSHOTS_KEY) continue;
      state[key] = storage.getItem(key);
    }
  } catch {
    return {};
  }
  return state;
}

function restoreRawAppState(state) {
  const storage = getStorage();
  if (!storage) return false;

  try {
    const currentKeys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(APP_PREFIX)) currentKeys.push(key);
    }
    currentKeys.forEach((key) => storage.removeItem(key));
    Object.entries(state).forEach(([key, value]) => storage.setItem(key, value));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canMergeById(value) {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.id === 'string');
}

function mergeValues(currentValue, backupValue) {
  if (!canMergeById(currentValue) || !canMergeById(backupValue)) return clone(backupValue);
  const merged = new Map(currentValue.map((item) => [item.id, clone(item)]));
  backupValue.forEach((item) => merged.set(item.id, clone(item)));
  return [...merged.values()];
}

function buildRestorePlan(keys, mode) {
  const current = getAppStorageSnapshot();
  if (mode === 'replace') return clone(keys);

  const plan = clone(current);
  Object.entries(keys).forEach(([key, value]) => {
    plan[key] = key in current ? mergeValues(current[key], value) : clone(value);
  });
  return plan;
}

function applyRestorePlan(plan, { replace = false } = {}) {
  const storage = getStorage();
  if (!storage) throw new Error('LocalStorage недоступен');

  const serializedEntries = Object.entries(plan).map(([key, value]) => {
    if (!key.startsWith(APP_PREFIX) || key === SNAPSHOTS_KEY) {
      throw new Error(`Недопустимый ключ: ${key}`);
    }
    return [key, JSON.stringify(value)];
  });

  if (replace) {
    const keysToRemove = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(APP_PREFIX) && key !== SNAPSHOTS_KEY) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  }
  serializedEntries.forEach(([key, value]) => storage.setItem(key, value));
}

function validateSnapshot(snapshot) {
  if (!isRecord(snapshot) || !isRecord(snapshot.data) || typeof snapshot.checksum !== 'string') return false;
  const payload = {
    id: snapshot.id,
    reason: snapshot.reason,
    createdAt: snapshot.createdAt,
    data: snapshot.data
  };
  return calculateChecksum(payload) === snapshot.checksum;
}

export function getAppStorageSnapshot() {
  const rawState = getRawAppState({ includeSnapshots: false });
  const snapshot = {};

  Object.entries(rawState).forEach(([key, rawValue]) => {
    try {
      snapshot[key] = JSON.parse(rawValue);
    } catch {
      snapshot[key] = rawValue;
    }
  });
  return clone(snapshot);
}

export function createBackup() {
  const payload = {
    app: APP_NAME,
    formatVersion: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    keys: getAppStorageSnapshot()
  };
  return { ...clone(payload), checksum: calculateChecksum(payload) };
}

export function downloadBackup() {
  let objectUrl;
  try {
    const backup = createBackup();
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const filename = `lounge-os-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    return { success: true, backup: clone(backup), filename };
  } catch (error) {
    return { success: false, errors: [error?.message || 'Не удалось скачать резервную копию'] };
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function validateBackup(data) {
  const errors = [];
  if (!isRecord(data)) return { valid: false, errors: ['Резервная копия должна быть объектом'], backup: null };
  if (data.app !== APP_NAME) errors.push('Файл не является резервной копией Lounge OS');
  if (data.formatVersion !== FORMAT_VERSION) errors.push('Версия формата резервной копии не поддерживается');
  if (!isRecord(data.keys)) errors.push('Поле keys должно быть объектом');

  if (isRecord(data.keys)) {
    Object.keys(data.keys).forEach((key) => {
      if (!key.startsWith(APP_PREFIX)) errors.push(`Недопустимый ключ: ${key}`);
      if (key === SNAPSHOTS_KEY) errors.push('Локальные снимки нельзя импортировать из резервной копии');
    });
  }

  if (typeof data.checksum !== 'string') {
    errors.push('Отсутствует checksum');
  } else {
    const payload = {
      app: data.app,
      formatVersion: data.formatVersion,
      createdAt: data.createdAt,
      appVersion: data.appVersion,
      keys: data.keys
    };
    if (calculateChecksum(payload) !== data.checksum) errors.push('Checksum резервной копии не совпадает');
  }

  return { valid: errors.length === 0, errors, backup: errors.length === 0 ? clone(data) : null };
}

export function restoreBackup(data, options = {}) {
  const validation = validateBackup(data);
  if (!validation.valid) return { success: false, errors: [...validation.errors] };

  const mode = options.mode ?? 'replace';
  if (!['replace', 'merge'].includes(mode)) return { success: false, errors: ['Неизвестный режим восстановления'] };

  const rollbackState = getRawAppState();
  let safetySnapshot = null;
  try {
    if (options.createSafetySnapshot !== false) {
      safetySnapshot = createLocalSnapshot(`Перед восстановлением backup (${mode})`);
      if (!safetySnapshot) throw new Error('Не удалось создать защитный снимок');
    }
    const plan = buildRestorePlan(validation.backup.keys, mode);
    applyRestorePlan(plan, { replace: mode === 'replace' });
    return { success: true, mode, restoredKeys: Object.keys(validation.backup.keys), safetySnapshot: clone(safetySnapshot) };
  } catch (error) {
    const rolledBack = restoreRawAppState(rollbackState);
    return { success: false, errors: [error?.message || 'Не удалось восстановить данные'], rolledBack };
  }
}

export function createLocalSnapshot(reason = 'Ручной снимок') {
  try {
    const payload = {
      id: generateId('snapshot'),
      reason: String(reason || 'Ручной снимок').trim(),
      createdAt: new Date().toISOString(),
      data: getAppStorageSnapshot()
    };
    const snapshot = { ...payload, checksum: calculateChecksum(payload) };
    const current = readStorage(SNAPSHOTS_STORAGE_NAME, []);
    const snapshots = Array.isArray(current) ? current.filter(validateSnapshot) : [];
    const nextSnapshots = [snapshot, ...snapshots].slice(0, MAX_LOCAL_SNAPSHOTS);
    return writeStorage(SNAPSHOTS_STORAGE_NAME, nextSnapshots) ? clone(snapshot) : null;
  } catch {
    return null;
  }
}

export function getLocalSnapshots() {
  try {
    const snapshots = readStorage(SNAPSHOTS_STORAGE_NAME, []);
    if (!Array.isArray(snapshots)) return [];
    return clone(snapshots.filter(validateSnapshot).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  } catch {
    return [];
  }
}

export function restoreLocalSnapshot(snapshotId) {
  const snapshot = getLocalSnapshots().find((item) => item.id === snapshotId);
  if (!snapshot) return { success: false, errors: ['Локальный снимок не найден или повреждён'] };

  const rollbackState = getRawAppState();
  try {
    const safetySnapshot = createLocalSnapshot('Перед восстановлением локального снимка');
    if (!safetySnapshot) throw new Error('Не удалось создать защитный снимок');
    applyRestorePlan(snapshot.data, { replace: true });
    return { success: true, snapshot: clone(snapshot), safetySnapshot: clone(safetySnapshot) };
  } catch (error) {
    const rolledBack = restoreRawAppState(rollbackState);
    return { success: false, errors: [error?.message || 'Не удалось восстановить снимок'], rolledBack };
  }
}

export function deleteLocalSnapshot(snapshotId) {
  try {
    const snapshots = readStorage(SNAPSHOTS_STORAGE_NAME, []);
    if (!Array.isArray(snapshots)) return false;
    const filtered = snapshots.filter((snapshot) => snapshot.id !== snapshotId);
    if (filtered.length === snapshots.length) return false;
    return writeStorage(SNAPSHOTS_STORAGE_NAME, filtered);
  } catch {
    return false;
  }
}

export function clearLocalSnapshots() {
  return removeStorage(SNAPSHOTS_STORAGE_NAME);
}

export function emergencyRestoreLatestSnapshot() {
  const snapshots = getLocalSnapshots();
  if (snapshots.length === 0) {
    return { success: false, errors: ['Корректные локальные снимки не найдены'], restored: false };
  }
  const result = restoreLocalSnapshot(snapshots[0].id);
  return { ...result, emergency: true, restoredSnapshotId: result.success ? snapshots[0].id : null };
}
