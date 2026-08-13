export function createOpenAICompatibleProvider({ id = 'openai-compatible', apiKey, baseUrl, model, fetchImpl = fetch }) {
  const endpoint = `${String(baseUrl || '').replace(/\/$/, '')}/chat/completions`;
  return {
    id, model,
    async complete({ messages, tools, signal }) {
      const response = await fetchImpl(endpoint, {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', temperature: 0.15, max_tokens: 900 })
      });
      if (!response.ok) throw new Error(`Model provider returned ${response.status}`);
      const payload = await response.json();
      const message = payload?.choices?.[0]?.message;
      if (!message) throw new Error('Model provider returned an empty response');
      return message;
    }
  };
}
