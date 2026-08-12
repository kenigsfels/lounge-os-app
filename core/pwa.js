const INSTALLABLE_EVENT = 'sylon:pwa-installable';
const INSTALLED_EVENT = 'sylon:pwa-installed';

let deferredInstallPrompt = null;

function isHttpContext() {
  return ['http:', 'https:'].includes(globalThis.location?.protocol);
}

export function isStandaloneMode() {
  return Boolean(
    globalThis.matchMedia?.('(display-mode: standalone)').matches
    || globalThis.navigator?.standalone
  );
}

export function isIosDevice() {
  const navigatorRef = globalThis.navigator;
  if (!navigatorRef) return false;
  const userAgent = navigatorRef.userAgent || '';
  return /iPad|iPhone|iPod/.test(userAgent)
    || (navigatorRef.platform === 'MacIntel' && navigatorRef.maxTouchPoints > 1);
}

export function canPromptPwaInstall() {
  return deferredInstallPrompt !== null;
}

export function getPwaInstallState() {
  if (isStandaloneMode()) return 'installed';
  if (canPromptPwaInstall()) return 'ready';
  if (isIosDevice()) return 'ios';
  return 'manual';
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return { outcome: 'unavailable' };

  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return { outcome: choice?.outcome || 'dismissed' };
}

export function registerSylonServiceWorker() {
  if (!isHttpContext() || !('serviceWorker' in globalThis.navigator)) return;

  if (import.meta.env?.DEV) {
    globalThis.navigator.serviceWorker.getRegistrations?.()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
    return;
  }

  globalThis.addEventListener('load', () => {
    const workerUrl = new URL('service-worker.js', document.baseURI);
    globalThis.navigator.serviceWorker.register(workerUrl, {
      scope: './',
      updateViaCache: 'none'
    }).catch((error) => {
      console.warn('SYLON service worker registration failed', error);
    });
  }, { once: true });
}

globalThis.addEventListener?.('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  globalThis.dispatchEvent(new CustomEvent(INSTALLABLE_EVENT));
});

globalThis.addEventListener?.('appinstalled', () => {
  deferredInstallPrompt = null;
  globalThis.dispatchEvent(new CustomEvent(INSTALLED_EVENT));
});

export const pwaEvents = {
  installable: INSTALLABLE_EVENT,
  installed: INSTALLED_EVENT
};
