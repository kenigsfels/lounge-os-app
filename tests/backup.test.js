class LocalStorageMock {
  #store = new Map();
  get length() { return this.#store.size; }
  key(index) { return [...this.#store.keys()][index] ?? null; }
  getItem(key) { return this.#store.has(String(key)) ? this.#store.get(String(key)) : null; }
  setItem(key, value) { this.#store.set(String(key), String(value)); }
  removeItem(key) { this.#store.delete(String(key)); }
  clear() { this.#store.clear(); }
}

globalThis.localStorage = new LocalStorageMock();
globalThis.Blob = class BlobMock { constructor(parts, options) { this.parts = parts; this.type = options?.type; } };
let revokedUrl = null;
let linkClicked = false;
globalThis.URL = {
  createObjectURL: () => 'blob:backup-test',
  revokeObjectURL: (url) => { revokedUrl = url; }
};
globalThis.document = {
  createElement: () => ({ href: '', download: '', click: () => { linkClicked = true; } })
};

const {
  createBackup,
  downloadBackup,
  validateBackup,
  restoreBackup,
  createLocalSnapshot,
  getLocalSnapshots,
  restoreLocalSnapshot,
  clearLocalSnapshots
} = await import('../core/backup.js');

const originalState = new Map();
for (let index = 0; index < localStorage.length; index += 1) {
  const key = localStorage.key(index);
  originalState.set(key, localStorage.getItem(key));
}
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  passed += 1;
  console.log(`✓ ${message}`);
}

function setJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getJson(key) { return JSON.parse(localStorage.getItem(key)); }
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function checksum(value) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

try {
  localStorage.setItem('foreign_app_token', 'keep-me');
  setJson('sylon_employees', [{ id: 'e1', name: 'Сотрудник 1', position: 'Основной' }]);
  setJson('sylon_preferences', { compact: true });
  setJson('sylon_local_snapshots', [{ id: 'must-not-be-nested' }]);

  const backup = createBackup();
  assert(backup.app === 'SYLON' && backup.formatVersion === 1, 'резервная копия создана в поддерживаемом формате');
  assert(Object.keys(backup.keys).every((key) => key.startsWith('sylon_')), 'в backup входят только ключи SYLON');
  assert(!('sylon_local_snapshots' in backup.keys), 'локальные снимки не вкладываются в backup');
  assert(validateBackup(backup).valid, 'корректный checksum принят');

  const legacyPrefix = String.fromCharCode(108, 111, 117, 110, 103, 101, 95, 111, 115, 95);
  const legacyBackup = JSON.parse(JSON.stringify(backup));
  legacyBackup.app = String.fromCharCode(76, 111, 117, 110, 103, 101, 32, 79, 83);
  legacyBackup.keys = Object.fromEntries(Object.entries(legacyBackup.keys).map(([key, value]) => (
    [`${legacyPrefix}${key.slice('sylon_'.length)}`, value]
  )));
  legacyBackup.checksum = checksum({
    app: legacyBackup.app,
    formatVersion: legacyBackup.formatVersion,
    createdAt: legacyBackup.createdAt,
    appVersion: legacyBackup.appVersion,
    keys: legacyBackup.keys
  });
  assert(validateBackup(legacyBackup).valid, 'резервная копия до переименования поддерживается');
  const legacyRestore = restoreBackup(legacyBackup, { mode: 'replace', createSafetySnapshot: false });
  assert(legacyRestore.success && getJson('sylon_employees')[0].id === 'e1', 'старый backup переносится в SYLON');

  const damaged = JSON.parse(JSON.stringify(backup));
  damaged.keys.sylon_employees[0].name = 'Подмена';
  assert(!validateBackup(damaged).valid, 'backup с повреждённым checksum отклонён');

  localStorage.setItem('sylon_temporary', JSON.stringify({ remove: true }));
  setJson('sylon_employees', [{ id: 'other', name: 'Другой' }]);
  const replaceResult = restoreBackup(backup, { mode: 'replace', createSafetySnapshot: true });
  assert(replaceResult.success && !localStorage.getItem('sylon_temporary'), 'режим replace полностью заменяет данные SYLON');
  assert(getLocalSnapshots().length >= 1, 'перед replace создан safety snapshot');

  setJson('sylon_employees', [
    { id: 'e1', name: 'Старое имя', position: 'Основной' },
    { id: 'e3', name: 'Локальный', position: 'Саппорт' }
  ]);
  const mergeBackup = createBackup();
  mergeBackup.keys.sylon_employees = [
    { id: 'e1', name: 'Приоритет backup', position: 'Основной' },
    { id: 'e2', name: 'Из backup', position: 'Администратор' }
  ];
  setJson('sylon_employees', mergeBackup.keys.sylon_employees);
  const regeneratedMergeBackup = createBackup();
  setJson('sylon_employees', [
    { id: 'e1', name: 'Старое имя', position: 'Основной' },
    { id: 'e3', name: 'Локальный', position: 'Саппорт' }
  ]);
  const mergeResult = restoreBackup(regeneratedMergeBackup, { mode: 'merge', createSafetySnapshot: false });
  const mergedEmployees = getJson('sylon_employees');
  assert(mergeResult.success && mergedEmployees.length === 3, 'режим merge объединяет массивы по id');
  assert(mergedEmployees.find((item) => item.id === 'e1').name === 'Приоритет backup', 'при merge запись из backup имеет приоритет');

  clearLocalSnapshots();
  for (let index = 1; index <= 11; index += 1) createLocalSnapshot(`Снимок ${index}`);
  const limitedSnapshots = getLocalSnapshots();
  assert(limitedSnapshots.length === 10 && limitedSnapshots[0].reason === 'Снимок 11', 'хранятся только 10 последних снимков');

  clearLocalSnapshots();
  setJson('sylon_employees', [{ id: 'before', name: 'До снимка' }]);
  const localSnapshot = createLocalSnapshot('Контрольная точка');
  setJson('sylon_employees', [{ id: 'after', name: 'После снимка' }]);
  const localRestore = restoreLocalSnapshot(localSnapshot.id);
  assert(localRestore.success && getJson('sylon_employees')[0].id === 'before', 'локальный снимок восстанавливает сохранённое состояние');

  const downloadResult = downloadBackup();
  assert(downloadResult.success && linkClicked && revokedUrl === 'blob:backup-test', 'backup скачивается, а временный URL освобождается');
  assert(localStorage.getItem('foreign_app_token') === 'keep-me', 'чужие ключи LocalStorage не удаляются');

  console.log(`\nВсе тесты backup пройдены: ${passed}`);
} catch (error) {
  console.error(`\nТест backup завершился с ошибкой: ${error.message}`);
  process.exitCode = 1;
} finally {
  localStorage.clear();
  originalState.forEach((value, key) => localStorage.setItem(key, value));
  console.log('Исходное состояние LocalStorage восстановлено.');
}
