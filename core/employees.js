import { readStorage, writeStorage, removeStorage } from './storage.js';
import { generateId } from './ids.js';
import { validateEmployeeInput } from './validators.js';

const EMPLOYEES_STORAGE_KEY = 'employees';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveEmployees(employees) {
  return writeStorage(EMPLOYEES_STORAGE_KEY, clone(employees));
}

export function getEmployees() {
  try {
    const employees = readStorage(EMPLOYEES_STORAGE_KEY, []);
    return Array.isArray(employees) ? clone(employees) : [];
  } catch {
    return [];
  }
}

export function getEmployeeById(id) {
  try {
    const employee = getEmployees().find((item) => item.id === id);
    return employee ? clone(employee) : null;
  } catch {
    return null;
  }
}

export function createEmployee(data) {
  try {
    const validation = validateEmployeeInput(data);
    if (!validation.valid) return { success: false, errors: [...validation.errors] };

    const now = new Date().toISOString();
    const employee = {
      id: generateId('employee'),
      name: validation.data.name,
      position: validation.data.position,
      phone: validation.data.phone,
      status: validation.data.status ?? 'active',
      rate: validation.data.rate ?? 0,
      startDate: validation.data.startDate,
      notes: validation.data.notes,
      createdAt: now,
      updatedAt: now
    };
    const employees = getEmployees();

    if (!saveEmployees([...employees, employee])) {
      return { success: false, errors: ['Не удалось сохранить сотрудника'] };
    }
    return { success: true, employee: clone(employee) };
  } catch {
    return { success: false, errors: ['Не удалось создать сотрудника'] };
  }
}

export function updateEmployee(id, changes) {
  try {
    const employees = getEmployees();
    const employeeIndex = employees.findIndex((employee) => employee.id === id);
    if (employeeIndex === -1) {
      return { success: false, errors: ['Сотрудник не найден'] };
    }

    const currentEmployee = employees[employeeIndex];
    const nextData = { ...currentEmployee, ...(changes && typeof changes === 'object' ? changes : {}) };
    const validation = validateEmployeeInput(nextData);
    if (!validation.valid) return { success: false, errors: [...validation.errors] };

    const updatedEmployee = {
      ...currentEmployee,
      name: validation.data.name,
      position: validation.data.position,
      phone: validation.data.phone,
      status: validation.data.status ?? 'active',
      rate: validation.data.rate ?? 0,
      startDate: validation.data.startDate,
      notes: validation.data.notes,
      updatedAt: new Date().toISOString()
    };
    const updatedEmployees = employees.map((employee, index) => (
      index === employeeIndex ? updatedEmployee : employee
    ));

    if (!saveEmployees(updatedEmployees)) {
      return { success: false, errors: ['Не удалось сохранить изменения'] };
    }
    return { success: true, employee: clone(updatedEmployee) };
  } catch {
    return { success: false, errors: ['Не удалось обновить сотрудника'] };
  }
}

export function deleteEmployee(id) {
  try {
    const employees = getEmployees();
    const filteredEmployees = employees.filter((employee) => employee.id !== id);
    if (filteredEmployees.length === employees.length) return false;
    return saveEmployees(filteredEmployees);
  } catch {
    return false;
  }
}

export function seedEmployees() {
  try {
    if (getEmployees().length > 0) return getEmployees();

    const seeds = [
      { name: 'Юрий', position: 'Основной' },
      { name: 'Кристина', position: 'Саппорт' },
      { name: 'Женя', position: 'Администратор' }
    ];
    const created = [];

    for (const seed of seeds) {
      const result = createEmployee(seed);
      if (!result.success) return [];
      created.push(result.employee);
    }
    return clone(created);
  } catch {
    return [];
  }
}

export function clearEmployees() {
  return removeStorage(EMPLOYEES_STORAGE_KEY);
}
