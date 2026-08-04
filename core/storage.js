const STORAGE_PREFIX = 'lounge_os_';

function getStorage() {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
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
      if (key?.startsWith(STORAGE_PREFIX)) appKeys.push(key);
    }
    appKeys.forEach((key) => storage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}
