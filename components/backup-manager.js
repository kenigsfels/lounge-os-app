import {
  downloadBackup,
  restoreBackup,
  createLocalSnapshot,
  getLocalSnapshots,
  restoreLocalSnapshot,
  deleteLocalSnapshot
} from '../core/backup.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Дата неизвестна'
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderSnapshotList() {
  const snapshots = getLocalSnapshots();
  if (snapshots.length === 0) {
    return '<div class="backup-empty">Локальных снимков пока нет</div>';
  }

  return snapshots.map((snapshot) => `
    <article class="snapshot-item" data-snapshot-id="${escapeHtml(snapshot.id)}">
      <div><strong>${escapeHtml(snapshot.reason)}</strong><time>${formatDate(snapshot.createdAt)}</time></div>
      <div class="snapshot-item__actions">
        <button type="button" data-snapshot-restore>Восстановить</button>
        <button type="button" class="button-danger" data-snapshot-delete>Удалить</button>
      </div>
    </article>`).join('');
}

export function renderBackupManager() {
  return `
    <div class="backup-manager" data-backup-manager>
      <div class="backup-actions">
        <button class="backup-button backup-button--primary" type="button" data-backup-download>Скачать резервную копию</button>
        <button class="backup-button" type="button" data-backup-import>Восстановить из файла</button>
        <input class="visually-hidden" type="file" accept=".json,application/json" data-backup-file>
      </div>
      <fieldset class="restore-mode">
        <legend>Режим восстановления</legend>
        <label><input type="radio" name="restoreMode" value="replace" checked><span>Полностью заменить данные</span></label>
        <label><input type="radio" name="restoreMode" value="merge"><span>Объединить с текущими</span></label>
      </fieldset>
      <div class="snapshot-heading">
        <div><h3>Локальные снимки</h3><p>До 10 последних состояний на этом устройстве</p></div>
        <button class="backup-button" type="button" data-snapshot-create>Создать локальный снимок сейчас</button>
      </div>
      <div class="snapshot-list" data-snapshot-list>${renderSnapshotList()}</div>
    </div>`;
}

export function initBackupManager(root, { showToast = () => {} } = {}) {
  const manager = root.querySelector('[data-backup-manager]');
  if (!manager) return () => {};

  const fileInput = manager.querySelector('[data-backup-file]');
  const snapshotList = manager.querySelector('[data-snapshot-list]');
  const refreshSnapshots = () => { snapshotList.innerHTML = renderSnapshotList(); };

  manager.querySelector('[data-backup-download]').addEventListener('click', () => {
    const result = downloadBackup();
    showToast(result.success ? 'Резервная копия скачана' : result.errors.join('. '));
  });

  manager.querySelector('[data-backup-import]').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const mode = manager.querySelector('input[name="restoreMode"]:checked')?.value ?? 'replace';
      const modeLabel = mode === 'replace' ? 'полностью заменить текущие данные' : 'объединить данные';
      if (!globalThis.confirm(`Восстановить резервную копию и ${modeLabel}?`)) return;
      const result = restoreBackup(data, { mode, createSafetySnapshot: true });
      if (!result.success) throw new Error(result.errors.join('. '));
      refreshSnapshots();
      globalThis.dispatchEvent(new CustomEvent('sylon:data-restored', { detail: { mode } }));
      showToast('Данные успешно восстановлены');
    } catch (error) {
      showToast(error?.message || 'Не удалось прочитать резервную копию');
    } finally {
      fileInput.value = '';
    }
  });

  manager.querySelector('[data-snapshot-create]').addEventListener('click', () => {
    const snapshot = createLocalSnapshot('Ручной снимок');
    showToast(snapshot ? 'Локальный снимок создан' : 'Не удалось создать снимок');
    refreshSnapshots();
  });

  snapshotList.addEventListener('click', (event) => {
    const item = event.target.closest('[data-snapshot-id]');
    if (!item) return;
    const snapshotId = item.dataset.snapshotId;

    if (event.target.closest('[data-snapshot-restore]')) {
      if (!globalThis.confirm('Восстановить этот снимок? Текущее состояние будет сохранено автоматически.')) return;
      const result = restoreLocalSnapshot(snapshotId);
      showToast(result.success ? 'Локальный снимок восстановлен' : result.errors.join('. '));
      if (result.success) globalThis.dispatchEvent(new CustomEvent('sylon:data-restored'));
      refreshSnapshots();
    }

    if (event.target.closest('[data-snapshot-delete]')) {
      if (!globalThis.confirm('Удалить этот локальный снимок?')) return;
      const deleted = deleteLocalSnapshot(snapshotId);
      showToast(deleted ? 'Локальный снимок удалён' : 'Не удалось удалить снимок');
      refreshSnapshots();
    }
  });

  return refreshSnapshots;
}
