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

const STORAGE_KEY = 'lounge_os_employees';
const originalData = globalThis.localStorage.getItem(STORAGE_KEY);
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(`Ошибка: ${message}`);
  passed += 1;
  console.log(`✓ ${message}`);
}

try {
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
  console.log('Исходные данные восстановлены.');
}
