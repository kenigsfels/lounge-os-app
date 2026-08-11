const COMMANDS = Object.freeze([
  { route: 'schedule', patterns: ['график', 'смен', 'кто сегодня', 'кто работает', 'пятниц'] },
  { route: 'employees', patterns: ['команд', 'сотрудник', 'персонал', 'кто в команде'] },
  { route: 'tasks', patterns: ['задач', 'мои дела', 'требует внимания', 'что проверить'] },
  { route: 'warehouse', patterns: ['склад', 'остат', 'инвентаризац', 'товар'] },
  { route: 'salary', patterns: ['финанс', 'зарплат', 'выплат'] },
  { route: 'training', patterns: ['обучен', 'курс'] },
  { route: 'knowledge', patterns: ['знани', 'инструкц'] },
  { route: 'settings', patterns: ['настрой'] },
  { route: 'dashboard', patterns: ['главн', 'домой', 'home', 'core'] }
]);

export function normalizeCommand(value) {
  return String(value ?? '').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
}

export function resolveSylonCommand(value) {
  const command = normalizeCommand(value);
  if (!command) return { type: 'empty', route: null, command };

  const match = COMMANDS.find((item) => item.patterns.some((pattern) => command.includes(pattern)));
  return match
    ? { type: 'navigate', route: match.route, command }
    : { type: 'unknown', route: null, command };
}

export function executeSylonCommand(value, { navigate, showToast }) {
  const result = resolveSylonCommand(value);
  if (result.type === 'navigate') navigate(result.route);
  if (result.type === 'unknown') showToast?.('Пока я умею открывать разделы. Попробуйте: «Открой график»');
  return result;
}
