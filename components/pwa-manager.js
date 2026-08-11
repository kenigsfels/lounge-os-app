import {
  getPwaInstallState,
  promptPwaInstall,
  pwaEvents
} from '../core/pwa.js';

const CONTENT = {
  installed: {
    title: 'SYLON установлен',
    description: 'Приложение запускается с главного экрана телефона в отдельном окне.',
    action: ''
  },
  ready: {
    title: 'Готово к установке',
    description: 'Добавьте SYLON на главный экран — вход через браузер после этого не понадобится.',
    action: '<button class="primary-button" type="button" data-pwa-install>Установить SYLON</button>'
  },
  ios: {
    title: 'Добавьте на экран «Домой»',
    description: 'Откройте эту страницу в Safari, нажмите «Поделиться» и выберите «На экран Домой».',
    action: ''
  },
  manual: {
    title: 'Установка через меню браузера',
    description: 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».',
    action: ''
  }
};

function renderContent() {
  const state = getPwaInstallState();
  const content = CONTENT[state];
  return `
    <div class="pwa-status pwa-status--${state}">
      <span class="pwa-status__icon" aria-hidden="true">${state === 'installed' ? '✓' : 'L'}</span>
      <div><strong>${content.title}</strong><p>${content.description}</p></div>
    </div>
    <div class="pwa-benefits" aria-label="Возможности мобильного приложения">
      <span>Иконка на главном экране</span>
      <span>Полноэкранный режим</span>
      <span>Локальные данные офлайн</span>
    </div>
    ${content.action}
    <p class="pwa-note">После входа в Supabase сотрудники, график и будущие облачные разделы будут общими с компьютером.</p>`;
}

export function renderPwaManager() {
  return `<div class="pwa-manager" data-pwa-manager>${renderContent()}</div>`;
}

export function initPwaManager(root, { showToast = () => {} } = {}) {
  const manager = root.querySelector('[data-pwa-manager]');
  if (!manager) return () => {};

  const refresh = () => {
    manager.innerHTML = renderContent();
  };

  const handleClick = async (event) => {
    if (!event.target.closest('[data-pwa-install]')) return;
    const result = await promptPwaInstall();
    if (result.outcome === 'accepted') showToast('SYLON устанавливается');
    if (result.outcome === 'dismissed') showToast('Установку можно повторить позже');
    refresh();
  };

  const handleInstalled = () => {
    refresh();
    showToast('SYLON установлен на телефон');
  };

  manager.addEventListener('click', handleClick);
  globalThis.addEventListener(pwaEvents.installable, refresh);
  globalThis.addEventListener(pwaEvents.installed, handleInstalled);

  return () => {
    manager.removeEventListener('click', handleClick);
    globalThis.removeEventListener(pwaEvents.installable, refresh);
    globalThis.removeEventListener(pwaEvents.installed, handleInstalled);
  };
}
