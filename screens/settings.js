import { renderBackupManager, initBackupManager } from '../components/backup-manager.js';
import { renderCloudManager, initCloudManager } from '../components/cloud-manager.js';
import { renderPwaManager, initPwaManager } from '../components/pwa-manager.js';

export function renderSettingsScreen() {
  return `
    <section class="view settings-screen is-active" aria-labelledby="settingsTitle">
      <div class="settings-header glass-panel">
        <div class="section-placeholder__icon">⚙</div>
        <div><p class="overline">Система</p><h1 id="settingsTitle">Настройки</h1><p>Параметры заведения, доступа и приложения.</p></div>
      </div>
      <section class="settings-card glass-panel" aria-labelledby="backupTitle">
        <header><p class="overline">Управление данными</p><h2 id="backupTitle">Резервное копирование и восстановление</h2></header>
        ${renderBackupManager()}
        <p class="backup-warning">Резервные копии хранятся на вашем устройстве. Регулярно скачивайте JSON-файл и храните его отдельно.</p>
      </section>
      <section class="settings-card glass-panel" aria-labelledby="cloudTitle">
        <header><p class="overline">Синхронизация</p><h2 id="cloudTitle">Supabase Cloud</h2></header>
        ${renderCloudManager()}
      </section>
      <section class="settings-card glass-panel" aria-labelledby="mobileAppTitle">
        <header><p class="overline">Телефон</p><h2 id="mobileAppTitle">Мобильное приложение</h2></header>
        ${renderPwaManager()}
      </section>
    </section>`;
}

export function initSettingsScreen(root, options) {
  const cleanupBackup = initBackupManager(root, options);
  const cleanupCloud = initCloudManager(root, options);
  const cleanupPwa = initPwaManager(root, options);
  return () => {
    cleanupBackup?.();
    cleanupCloud?.();
    cleanupPwa?.();
  };
}
