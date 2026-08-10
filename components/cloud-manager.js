import {
  getCloudSession,
  isSupabaseConfigured,
  onCloudAuthStateChange,
  sendMagicLink,
  signOutCloud
} from '../core/supabase.js';
import { synchronizeCloudData } from '../core/cloud-sync.js';

export function renderCloudManager() {
  if (!isSupabaseConfigured()) {
    return `
      <div class="cloud-manager cloud-manager--offline">
        <span class="cloud-indicator"></span>
        <div><strong>Облачная синхронизация не настроена</strong><p>Приложение продолжает работать локально. Добавьте параметры Supabase при сборке.</p></div>
      </div>`;
  }

  return `
    <div class="cloud-manager" data-cloud-manager>
      <div class="cloud-status"><span class="cloud-indicator"></span><div><strong data-cloud-title>Проверяем подключение…</strong><p data-cloud-description>Связываемся с Supabase</p></div></div>
      <form class="cloud-login" data-cloud-login>
        <label class="field"><span>Email владельца</span><input type="email" name="email" required autocomplete="email" placeholder="owner@example.com"></label>
        <button class="primary-button" type="submit">Получить ссылку для входа</button>
      </form>
      <div class="cloud-actions" data-cloud-actions hidden>
        <button class="primary-button" type="button" data-cloud-sync>Синхронизировать сейчас</button>
        <button class="secondary-button" type="button" data-cloud-signout>Выйти</button>
      </div>
    </div>`;
}

export function initCloudManager(root, { showToast = () => {} } = {}) {
  const manager = root.querySelector('[data-cloud-manager]');
  if (!manager) return () => {};

  const loginForm = manager.querySelector('[data-cloud-login]');
  const actions = manager.querySelector('[data-cloud-actions]');
  const title = manager.querySelector('[data-cloud-title]');
  const description = manager.querySelector('[data-cloud-description]');

  async function refreshSession() {
    try {
      const session = await getCloudSession();
      loginForm.hidden = Boolean(session);
      actions.hidden = !session;
      manager.classList.toggle('is-connected', Boolean(session));
      title.textContent = session ? 'Облако подключено' : 'Требуется вход';
      description.textContent = session?.user?.email ?? 'Войдите по ссылке из email, чтобы включить синхронизацию';
      if (session) await synchronizeCloudData();
    } catch (error) {
      title.textContent = 'Ошибка подключения';
      description.textContent = error?.message || 'Не удалось подключиться к Supabase';
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = new FormData(loginForm).get('email');
    try {
      await sendMagicLink(String(email));
      showToast('Ссылка для входа отправлена на email');
      description.textContent = 'Проверьте почту и откройте ссылку на этом устройстве';
    } catch (error) {
      showToast(error?.message || 'Не удалось отправить ссылку');
    }
  });

  manager.querySelector('[data-cloud-sync]').addEventListener('click', async () => {
    try {
      await synchronizeCloudData();
      globalThis.dispatchEvent(new CustomEvent('lounge:cloud-synced'));
      showToast('Сотрудники и график синхронизированы');
    } catch (error) {
      showToast(error?.message || 'Ошибка синхронизации');
    }
  });

  manager.querySelector('[data-cloud-signout]').addEventListener('click', async () => {
    try {
      await signOutCloud();
      showToast('Вы вышли из облака');
      await refreshSession();
    } catch (error) {
      showToast(error?.message || 'Не удалось выйти');
    }
  });

  const unsubscribe = onCloudAuthStateChange(() => refreshSession());
  refreshSession();
  return unsubscribe;
}
