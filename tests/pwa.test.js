import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8'));

assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, './#dashboard');
assert.equal(manifest.scope, './');
console.log('✓ PWA открывает SYLON как самостоятельное приложение');

for (const size of ['192x192', '512x512']) {
  const icon = manifest.icons.find((item) => item.sizes === size);
  assert.ok(icon, `В manifest отсутствует иконка ${size}`);
  assert.ok(existsSync(join(root, 'public', icon.src.replace('./', ''))));
}
assert.ok(existsSync(join(root, 'public', 'icons', 'apple-touch-icon.png')));
assert.ok(manifest.icons.some((item) => item.purpose === 'maskable'));
assert.ok(existsSync(join(root, 'public', 'icons', 'icon-maskable-512.png')));
console.log('✓ иконки Android и iPhone входят в сборку');

const serviceWorker = readFileSync(join(root, 'public', 'service-worker.js'), 'utf8');
assert.match(serviceWorker, /request\.mode === 'navigate'/);
assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
assert.match(serviceWorker, /caches\.match\('\.\/index\.html'\)/);
assert.match(serviceWorker, /LEGACY_CACHE_PREFIX/);
console.log('✓ service worker сохраняет оболочку и не кэширует Supabase-запросы');
