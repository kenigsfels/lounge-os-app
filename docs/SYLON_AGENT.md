# SYLON Agent

SYLON Agent is a server-side, provider-neutral orchestration layer. The browser sends a bounded read-only snapshot; the Edge Function asks the configured model to select allowlisted tools, executes those tools locally, and returns the final answer.

## Current scope

- NVIDIA is the first OpenAI-compatible provider.
- The API key exists only in Edge Function secrets.
- A signed-in Supabase session is required.
- Tools are read-only: schedule window, team workload, replacement suggestions, open tasks, low stock, and knowledge search.
- The active SPA route is included so the model can answer in the current workspace context.
- Answers return human-readable evidence badges instead of exposing internal tool names.
- The agent runs at most four model steps and three calls per step.
- If the server, account, or model is unavailable, the existing deterministic local assistant remains active.
- When a model-only question requires authentication, the assistant keeps the answer card open and links directly to Supabase settings.

## Deploy

```sh
supabase secrets set NVIDIA_API_KEY=... NVIDIA_MODEL=...
supabase functions deploy sylon-agent
```

Set `VITE_SYLON_AGENT_ENABLED=true` for the client build. `NVIDIA_BASE_URL` is optional and defaults to NVIDIA's hosted OpenAI-compatible API. A self-hosted NIM can be selected by changing that secret without changing the application or tool layer.

The current hosted default is `nvidia/nemotron-3-super-120b-a12b`. Its NVIDIA-recommended sampling settings are configured in the Edge Function, with extended reasoning disabled to keep interactive requests inside the function timeout.

## Safety boundary

The model never receives storage access or arbitrary function execution. Tool names and arguments are validated by the server. Future write tools must be placed in a separate registry and require an explicit user confirmation token before execution.
