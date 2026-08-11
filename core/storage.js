const STORAGE_PREFIX = 'sylon_';
const LEGACY_STORAGE_PREFIX = String.fromCharCode(108, 111, 117, 110, 103, 101, 95, 111, 115, 95);
let migrationCompleted = false;

function migrateLegacyStorage(storage) {
  if (migrationCompleted) return;
  migrationCompleted = true;

  const legacyKeys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(LEGACY_STORAGE_PREFIX)) legacyKeys.push(key);
  }

  legacyKeys.forEach((legacyKey) => {
    const currentKey = `${STORAGE_PREFIX}${legacyKey.slice(LEGACY_STORAGE_PREFIX.length)}`;
    if (storage.getItem(currentKey) === null) {
      storage.setItem(currentKey, storage.getItem(legacyKey));
    }
    storage.removeItem(legacyKey);
  });
}

function getStorage() {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null;
    migrateLegacyStorage(globalThis.localStorage);
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function toAppKey(key) {
  const normalizedKey = String(key ?? '');
  return normalizedKey.startsWith(STORAGE_PREFIX)
    ? normalizedKey
    : `${STORAGE_PREFIX}${normalizedKey}`;
}

function copyValue(value) {
  if (value === undefined || value === null) return value;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

export function readStorage(key, fallback) {
  const storage = getStorage();
  if (!storage) return copyValue(fallback);

  try {
    const storedValue = storage.getItem(toAppKey(key));
    if (storedValue === null) return copyValue(fallback);
    return JSON.parse(storedValue);
  } catch {
    return copyValue(fallback);
  }
}

export function writeStorage(key, value) {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(toAppKey(key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key) {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.removeItem(toAppKey(key));
    return true;
  } catch {
    return false;
  }
}

export function clearAppStorage() {
  const storage = getStorage();
  if (!storage) return false;

  try {
    const appKeys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(LEGACY_STORAGE_PREFIX)) appKeys.push(key);
    }
    appKeys.forEach((key) => storage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}
