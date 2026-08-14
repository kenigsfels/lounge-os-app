import { runSylonAgent } from '../_shared/agent-runtime.js';
import { createOpenAICompatibleProvider } from '../_shared/model-provider.js';
import { sanitizeAgentContext } from '../_shared/sylon-agent-tools.js';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS'
};

const evidenceMeta: Record<string, { label: string; route: string }> = {
  get_schedule_window: { label: 'График', route: 'schedule' },
  get_team_workload: { label: 'Нагрузка команды', route: 'schedule' },
  find_shift_replacements: { label: 'Кандидаты на замену', route: 'schedule' },
  get_open_tasks: { label: 'Задачи', route: 'tasks' },
  get_stock_attention: { label: 'Склад', route: 'warehouse' },
  search_knowledge: { label: 'База знаний', route: 'knowledge' }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
}

function hasAuthenticatedUser(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
    const claims = JSON.parse(atob(normalized));
    return claims?.role === 'authenticated' && typeof claims?.sub === 'string' && claims.sub.length > 0;
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!hasAuthenticatedUser(request)) return json({ error: 'Authenticated SYLON user required' }, 401);

  const apiKey = Deno.env.get('NVIDIA_API_KEY') || '';
  const model = Deno.env.get('NVIDIA_MODEL') || '';
  const baseUrl = Deno.env.get('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
  if (!apiKey || !model) return json({ error: 'SYLON brain is not configured' }, 503);

  try {
    const rawText = await request.text();
    if (rawText.length > 512_000) return json({ error: 'Context is too large' }, 413);
    const raw = JSON.parse(rawText);
    const query = String(raw?.query || '').trim().slice(0, 2000);
    if (!query) return json({ error: 'Query is required' }, 400);
    const context = sanitizeAgentContext(raw?.context);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);
    try {
      const provider = createOpenAICompatibleProvider({
        id: 'nvidia', apiKey, baseUrl, model,
        temperature: 1, topP: 0.95,
        extraBody: { chat_template_kwargs: { enable_thinking: false } }
      });
      const result = await runSylonAgent({ provider, query, context, today: new Date().toISOString().slice(0, 10), signal: controller.signal });
      const evidence = [...new Set(result.toolsUsed)].map((tool) => ({ tool, ...evidenceMeta[tool] })).filter((item) => item.label);
      return json({ type: 'answer', eyebrow: 'SYLON · NVIDIA', text: result.text,
        detail: evidence.length ? 'Ответ собран по актуальным данным SYLON.' : 'Ответ модели без обращения к данным.',
        evidence, mode: 'calm', route: evidence[0]?.route || null,
        actionLabel: evidence[0] ? `Открыть · ${evidence[0].label}` : '', provider: provider.id, model: provider.model });
    } finally { clearTimeout(timeout); }
  } catch (error) {
    console.error('sylon-agent failed', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'SYLON brain could not answer' }, 502);
  }
});
