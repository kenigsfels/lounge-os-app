import assert from 'node:assert/strict';
import { buildAuthRedirectUrl } from '../core/supabase.js';

assert.equal(
  buildAuthRedirectUrl(
    'https://kenigsfels.github.io/lounge-os-app/?deployment=31390655662#settings',
    './'
  ),
  'https://kenigsfels.github.io/lounge-os-app/#settings'
);
console.log('✓ callback GitHub Pages сохраняет каталог приложения');

assert.equal(
  buildAuthRedirectUrl('http://127.0.0.1:8765/#settings', './'),
  'http://127.0.0.1:8765/#settings'
);
console.log('✓ callback локальной разработки остаётся на Vite');

assert.equal(
  buildAuthRedirectUrl('https://example.test/current/page', '/lounge-os-app/'),
  'https://example.test/lounge-os-app/#settings'
);
console.log('✓ абсолютный base Vite поддерживается');
