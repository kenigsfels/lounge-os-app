import { runSylonAgent } from '../_shared/agent-runtime.js';
import { createOpenAICompatibleProvider } from '../_shared/model-provider.js';
import { sanitizeAgentContext } from '../_shared/sylon-agent-tools.js';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!request.headers.get('authorization')) return json({ error: 'Authentication required' }, 401);

  const apiKey = Deno.env.get('NVIDIA_API_KEY') || '';
  const model = Deno.env.get('NVIDIA_MODEL') || '';
  const baseUrl = Deno.env.get('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
  if (!apiKey || !model) return json({ error: 'SYLON brain is not configured' }, 503);

  try {
    const raw = await request.json();
    const query = String(raw?.query || '').trim().slice(0, 2000);
    if (!query) return json({ error: 'Query is required' }, 400);
    const context = sanitizeAgentContext(raw?.context);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);
    try {
      const provider = createOpenAICompatibleProvider({ id: 'nvidia', apiKey, baseUrl, model });
      const result = await runSylonAgent({ provider, query, context, today: new Date().toISOString().slice(0, 10), signal: controller.signal });
      return json({ type: 'answer', eyebrow: 'SYLON · NVIDIA', text: result.text,
        detail: result.toolsUsed.length ? `Проверено через: ${[...new Set(result.toolsUsed)].join(', ')}` : 'Ответ модели без обращения к данным.',
        mode: 'calm', route: result.toolsUsed.length ? 'schedule' : null,
        actionLabel: result.toolsUsed.length ? 'Открыть график' : '', provider: provider.id, model: provider.model });
    } finally { clearTimeout(timeout); }
  } catch (error) {
    console.error('sylon-agent failed', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'SYLON brain could not answer' }, 502);
  }
});
