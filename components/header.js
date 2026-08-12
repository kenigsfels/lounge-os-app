function formatCurrentDate() {
  const date = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  return date.charAt(0).toUpperCase() + date.slice(1);
}

export function renderHeader() {
  return `
    <div class="menu-bar">
      <div class="menu-bar__identity">
        <a class="menu-bar__brand" href="#dashboard" data-home><span aria-hidden="true"></span>SYLON <strong>OS</strong></a>
        ${globalThis.sylon?.desktop?.preview ? '<em class="desktop-preview-label">Preview</em>' : ''}
        <i></i>
        <span class="menu-bar__section" data-workspace-section></span>
      </div>
      <time class="menu-bar__date">${formatCurrentDate()}</time>
      <div class="menu-bar__system">
        <span class="system-status"><i></i><span>Система активна</span></span>
        <button class="notification-button" type="button" aria-label="Уведомления">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
          <span class="notification-dot"></span>
        </button>
      </div>
    </div>`;
}

export function initHeader(root, { onHome, onNotifications }) {
  root.querySelector('[data-home]').addEventListener('click', (event) => {
    event.preventDefault();
    onHome();
  });

  root.querySelector('.notification-button').addEventListener('click', onNotifications);
}
