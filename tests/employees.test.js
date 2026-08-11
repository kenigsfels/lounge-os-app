class LocalStorageMock {
  #store = new Map();

  get length() { return this.#store.size; }
  key(index) { return [...this.#store.keys()][index] ?? null; }
  getItem(key) { return this.#store.has(String(key)) ? this.#store.get(String(key)) : null; }
  setItem(key, value) { this.#store.set(String(key), String(value)); }
  removeItem(key) { this.#store.delete(String(key)); }
  clear() { this.#store.clear(); }
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new LocalStorageMock();
}

const {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  clearEmployees,
  replaceEmployees
} = await import('../core/employees.js');

const STORAGE_KEY = 'sylon_employees';
const LEGACY_STORAGE_KEY = `${String.fromCharCode(108, 111, 117, 110, 103, 101, 95, 111, 115, 95)}employees`;
const originalData = globalThis.localStorage.getItem(STORAGE_KEY);
const originalLegacyData = globalThis.localStorage.getItem(LEGACY_STORAGE_KEY);
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(`Ошибка: ${message}`);
  passed += 1;
  console.log(`✓ ${message}`);
}

try {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([{ id: 'legacy-1', name: 'До переименования' }]));
  assert(
    getEmployees()[0]?.id === 'legacy-1'
      && localStorage.getItem(STORAGE_KEY)
      && !localStorage.getItem(LEGACY_STORAGE_KEY),
    'локальные данные автоматически перенесены в пространство SYLON'
  );

  clearEmployees();
  assert(getEmployees().length === 0, 'база сотрудников временно очищена');

  const created = createEmployee({
    name: '  Тестовый сотрудник  ',
    position: ' Основной ',
    phone: '+7 900 000-00-00',
    rate: 2500
  });
  assert(created.success, 'сотрудник создан');
  assert(created.employee.name === 'Тестовый сотрудник', 'текстовые данные нормализованы');
  assert(created.employee.status === 'active', 'статус по умолчанию установлен');

  const stored = getEmployees();
  assert(stored.length === 1 && stored[0].id === created.employee.id, 'сотрудник прочитан из хранилища');

  const updated = updateEmployee(created.employee.id, { rate: 3000, status: 'inactive' });
  assert(updated.success && updated.employee.rate === 3000, 'сотрудник обновлён');
  assert(updated.employee.status === 'inactive', 'новый статус сохранён');

  const invalid = createEmployee({ name: '   ', position: 'Саппорт' });
  assert(!invalid.success && invalid.errors.length > 0, 'пустое имя отклонено валидатором');

  assert(deleteEmployee(created.employee.id), 'сотрудник удалён');
  assert(getEmployees().length === 0, 'после удаления база пуста');

  assert(replaceEmployees([{ id: 'cloud-1', name: 'Из облака' }]), 'облачный список записан локально');
  assert(getEmployees()[0].id === 'cloud-1', 'облачный список доступен через ядро сотрудников');

  console.log(`\nВсе тесты пройдены: ${passed}`);
} catch (error) {
  console.error(`\nТест завершился с ошибкой: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (originalData === null) globalThis.localStorage.removeItem(STORAGE_KEY);
  else globalThis.localStorage.setItem(STORAGE_KEY, originalData);
  if (originalLegacyData === null) globalThis.localStorage.removeItem(LEGACY_STORAGE_KEY);
  else globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, originalLegacyData);
  console.log('Исходные данные восстановлены.');
}
