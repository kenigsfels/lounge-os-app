import { generateId } from './ids.js';
import { readStorage, writeStorage } from './storage.js';

const TASKS_STORAGE_KEY = 'tasks';
const LANES = new Set(['now', 'today', 'later']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeDate(value) {
  const date = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function normalizeTime(value) {
  const time = String(value ?? '').trim();
  return /^\d{2}:\d{2}$/.test(time) ? time : '';
}

function normalizeTask(value) {
  const lane = String(value?.lane ?? 'today');
  const status = value?.status === 'completed' ? 'completed' : 'open';
  return {
    id: String(value?.id ?? ''),
    title: String(value?.title ?? '').trim(),
    lane: LANES.has(lane) ? lane : 'today',
    assigneeId: String(value?.assigneeId ?? '').trim(),
    dueDate: normalizeDate(value?.dueDate),
    dueTime: normalizeTime(value?.dueTime),
    shiftDate: normalizeDate(value?.shiftDate),
    notes: String(value?.notes ?? '').trim(),
    status,
    createdAt: String(value?.createdAt ?? ''),
    updatedAt: String(value?.updatedAt ?? ''),
    completedAt: status === 'completed' ? String(value?.completedAt ?? '') : ''
  };
}

function saveTasks(tasks) {
  return writeStorage(TASKS_STORAGE_KEY, tasks.map(normalizeTask));
}

function todayKey(today = new Date()) {
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');
}

export function getTasks() {
  const stored = readStorage(TASKS_STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  return clone(stored.map(normalizeTask).filter((task) => task.id && task.title));
}

export function createTask(data) {
  const title = String(data?.title ?? '').trim();
  if (!title) return { success: false, errors: ['Напиши, что нужно сделать'] };

  const now = new Date().toISOString();
  const task = normalizeTask({
    ...data,
    id: generateId('task'),
    title,
    status: 'open',
    createdAt: now,
    updatedAt: now
  });
  const tasks = getTasks();
  if (!saveTasks([...tasks, task])) return { success: false, errors: ['Не удалось сохранить задачу'] };
  return { success: true, task: clone(task) };
}

export function updateTask(id, changes) {
  const tasks = getTasks();
  const index = tasks.findIndex((task) => task.id === id);
  if (index < 0) return { success: false, errors: ['Задача не найдена'] };

  const title = String(changes?.title ?? tasks[index].title).trim();
  if (!title) return { success: false, errors: ['Название задачи не может быть пустым'] };

  const task = normalizeTask({
    ...tasks[index],
    ...changes,
    id: tasks[index].id,
    title,
    createdAt: tasks[index].createdAt,
    updatedAt: new Date().toISOString()
  });
  const next = tasks.map((item, itemIndex) => itemIndex === index ? task : item);
  if (!saveTasks(next)) return { success: false, errors: ['Не удалось обновить задачу'] };
  return { success: true, task: clone(task) };
}

export function setTaskCompleted(id, completed = true) {
  return updateTask(id, {
    status: completed ? 'completed' : 'open',
    completedAt: completed ? new Date().toISOString() : ''
  });
}

export function deleteTask(id) {
  const tasks = getTasks();
  const next = tasks.filter((task) => task.id !== id);
  if (next.length === tasks.length) return false;
  return saveTasks(next);
}

export function getTaskOverview(tasks = getTasks(), today = new Date()) {
  const currentDay = todayKey(today);
  const open = tasks.filter((task) => task.status !== 'completed');
  const completed = tasks.filter((task) => task.status === 'completed')
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const overdue = open.filter((task) => task.dueDate && task.dueDate < currentDay);
  const now = open.filter((task) => task.lane === 'now');
  const todayTasks = open.filter((task) => task.lane !== 'now' && (task.lane === 'today' || (task.dueDate && task.dueDate <= currentDay)));
  const later = open.filter((task) => !now.includes(task) && !todayTasks.includes(task));
  const focus = overdue[0] || now[0] || todayTasks[0] || later[0] || null;

  let focusReason = 'Рабочий ритм спокойный';
  if (focus) {
    if (overdue.includes(focus)) focusReason = 'Срок уже прошёл — лучше закрыть первой';
    else if (now.includes(focus)) focusReason = 'Отмечена как текущий фокус';
    else if (focus.dueDate === currentDay) focusReason = 'Срок задачи — сегодня';
    else focusReason = 'Следующая задача в сегодняшнем потоке';
  }

  return { open, completed, overdue, now, today: todayTasks, later, focus, focusReason, currentDay };
}
