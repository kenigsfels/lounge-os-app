export function generateId(prefix = 'item') {
  const safePrefix = String(prefix || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_') || 'item';
  const timestamp = Date.now().toString(36);
  let randomPart;

  try {
    const bytes = new Uint8Array(4);
    globalThis.crypto.getRandomValues(bytes);
    randomPart = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    randomPart = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  }

  return `${safePrefix}_${timestamp}_${randomPart}`;
}
