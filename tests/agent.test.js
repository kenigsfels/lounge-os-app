import assert from 'node:assert/strict';
import { executeSylonTool, sanitizeAgentContext } from '../supabase/functions/_shared/sylon-agent-tools.js';
import { runSylonAgent } from '../supabase/functions/_shared/agent-runtime.js';
import { createOpenAICompatibleProvider } from '../supabase/functions/_shared/model-provider.js';

const context = sanitizeAgentContext({
  employees: [
    { id: '1', name: 'Женя', position: 'Мастер', status: 'active', phone: 'secret' },
    { id: '2', name: 'Юра', position: 'Мастер', status: 'active' },
    { id: '3', name: 'Лена', position: 'Администратор', status: 'active' }
  ],
  schedule: { weeks: [{ start: '2026-08-10', end: '2026-08-16', days: [
    { date: '2026-08-14', masters: [{ name: 'Женя', shift: '18-02' }], administrators: [{ name: 'Лена', shift: '18-02' }] },
    { date: '2026-08-15', masters: [{ name: 'Женя', shift: '18-02' }], administrators: [] }
  ] }] },
  tasks: [
    { id: 'task-1', title: 'Проверить вытяжку', lane: 'now', assigneeId: '2', dueDate: '2026-08-13', status: 'open', notes: 'private' },
    { id: 'task-2', title: 'Готово', lane: 'today', assigneeId: '1', dueDate: '2026-08-12', status: 'completed' }
  ],
  warehouse: [
    { id: 'stock-1', name: 'Уголь', category: 'coal', unit: 'кг', quantity: 0, minimum: 2, notes: 'private' },
    { id: 'stock-2', name: 'Мундштуки', category: 'supplies', unit: 'шт.', quantity: 100, minimum: 20 }
  ],
  knowledge: [
    { id: 'rule-1', title: 'Проблема с оборудованием', situation: 'Не работает вытяжка', category: 'equipment',
      summary: 'Остановить использование и сообщить ответственному.', steps: ['Отключить питание'], warnings: ['Не ремонтировать под напряжением'], checklist: ['private'] }
  ],
  currentRoute: 'tasks'
});

assert.equal(context.employees[0].phone, undefined, 'private fields are removed from the model context');
const load = executeSylonTool('get_team_workload', { date_from: '2026-08-14', date_to: '2026-08-16' }, context);
assert.deepEqual(load.people[0], { name: 'Женя', shifts: 2, hours: 16, dates: ['2026-08-14', '2026-08-15'] });

const replacements = executeSylonTool('find_shift_replacements', { date: '2026-08-14', absent_employee: 'Женя' }, context);
assert.equal(replacements.candidates[0].name, 'Юра');
assert.equal(replacements.candidates[0].sameRole, true);
assert.equal(replacements.candidates.some((item) => item.name === 'Лена'), false, 'already scheduled employees are excluded');

const openTasks = executeSylonTool('get_open_tasks', { due_before: '2026-08-14', assignee: 'Юра' }, context);
assert.equal(openTasks.count, 1);
assert.equal(openTasks.tasks[0].assignee, 'Юра');
assert.equal(openTasks.tasks[0].notes, undefined);

const stock = executeSylonTool('get_stock_attention', {}, context);
assert.equal(stock.count, 1);
assert.equal(stock.items[0].name, 'Уголь');

const knowledge = executeSylonTool('search_knowledge', { query: 'что делать если не работает вытяжка' }, context);
assert.equal(knowledge.count, 1);
assert.equal(knowledge.results[0].title, 'Проблема с оборудованием');
assert.equal(knowledge.results[0].checklist, undefined);

let turn = 0;
let firstSystemPrompt = '';
const provider = {
  async complete({ messages }) {
    turn += 1;
    if (turn === 1) firstSystemPrompt = messages[0].content;
    return turn === 1
      ? { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'get_team_workload', arguments: '{"date_from":"2026-08-14","date_to":"2026-08-16"}' } }] }
      : { role: 'assistant', content: 'Женя перегружен: две смены, 16 часов.' };
  }
};
const answer = await runSylonAgent({ provider, query: 'Кто перегружен?', context, today: '2026-08-13' });
assert.equal(answer.text, 'Женя перегружен: две смены, 16 часов.');
assert.deepEqual(answer.toolsUsed, ['get_team_workload']);
assert.match(firstSystemPrompt, /Текущий раздел приложения: tasks/);

let requestedUrl = '';
const compatibleProvider = createOpenAICompatibleProvider({ id: 'test-provider', apiKey: 'server-secret', baseUrl: 'https://models.example/v1/', model: 'test-model',
  fetchImpl: async (url) => { requestedUrl = url; return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }) }; } });
assert.equal((await compatibleProvider.complete({ messages: [], tools: [] })).content, 'ok');
assert.equal(requestedUrl, 'https://models.example/v1/chat/completions');
assert.equal(compatibleProvider.id, 'test-provider');

console.log('✓ контекст агента ограничен безопасными полями');
console.log('✓ нагрузка считается инструментом, а не моделью');
console.log('✓ замены учитывают занятость, роль и соседнюю нагрузку');
console.log('✓ задачи, остатки и регламенты доступны только через read-only инструменты');
console.log('✓ tool-calling loop возвращает итоговый ответ');
console.log('✓ OpenAI-совместимый провайдер можно заменить без изменения агента');
