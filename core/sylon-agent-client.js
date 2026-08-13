import { getEmployees } from './employees.js';
import { getRegulations } from './knowledge.js';
import { readScheduleSnapshot } from './schedule.js';
import { askSylonLocally } from './sylon-assistant.js';
import { getCloudSession } from './supabase.js';
import { getTasks } from './tasks.js';
import { getWarehouseItems } from './warehouse.js';

const env = import.meta.env || {};
const agentEnabled = env.VITE_SYLON_AGENT_ENABLED === 'true' || Boolean(env.VITE_SYLON_AGENT_URL?.trim());
const agentUrl = env.VITE_SYLON_AGENT_URL?.trim()
  || (agentEnabled && env.VITE_SUPABASE_URL?.trim()
    ? `${env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/sylon-agent`
    : '');
const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || '';

function employeeSnapshot(employee) {
  return {
    id: String(employee?.id || ''), name: String(employee?.name || ''),
    position: String(employee?.position || ''), status: String(employee?.status || '')
  };
}

export function isSylonAgentConfigured() {
  return Boolean(agentEnabled && agentUrl && anonKey);
}

export async function buildSylonAgentContext() {
  const schedule = await readScheduleSnapshot();
  return {
    currentRoute: String(globalThis.location?.hash || '#dashboard').replace(/^#/, ''),
    employees: getEmployees().slice(0, 120).map(employeeSnapshot),
    schedule: { weeks: schedule.weeks.slice(0, 10) },
    tasks: getTasks().slice(0, 200),
    warehouse: getWarehouseItems().slice(0, 300),
    knowledge: getRegulations().slice(0, 120)
  };
}

export async function askSylonRemotely(query, { fetchImpl = fetch, signal } = {}) {
  if (!isSylonAgentConfigured()) return null;
  const session = await getCloudSession();
  if (!session?.access_token) return null;
  const context = await buildSylonAgentContext();
  const controller = signal ? null : new AbortController();
  const timeout = controller ? window.setTimeout(() => controller.abort(), 30000) : 0;
  try {
    const response = await fetchImpl(agentUrl, {
      method: 'POST', signal: signal || controller.signal,
      headers: { 'content-type': 'application/json', apikey: anonKey, authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ query: String(query || '').slice(0, 2000), context })
    });
    if (!response.ok) throw new Error(`SYLON Agent returned ${response.status}`);
    const result = await response.json();
    return result?.type === 'answer' && result?.text ? result : null;
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

export async function askSylon(query, options = {}) {
  try {
    const remote = await askSylonRemotely(query, options);
    if (remote) return remote;
  } catch {
    // The deterministic local assistant keeps SYLON useful offline and during provider outages.
  }
  return askSylonLocally(query, options);
}
