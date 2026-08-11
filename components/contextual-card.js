function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function renderContextualCard({ activeEmployees = 0 } = {}) {
  const teamLine = activeEmployees > 0
    ? `Команда на связи: ${activeEmployees}.`
    : 'Команда пока не заполнена.';

  return `
    <aside class="sylon-context" aria-labelledby="sylonGreeting">
      <p class="sylon-context__eyebrow">Состояние заведения</p>
      <h1 id="sylonGreeting">${getGreeting()}, Юра.</h1>
      <p>Сегодня всё спокойно.<br>${teamLine}<br>График стоит проверить перед сменой.</p>
      <button type="button" data-context-route="schedule">Показать <span aria-hidden="true">↗</span></button>
    </aside>`;
}

export function initContextualCard(root, navigate) {
  const button = root.querySelector('[data-context-route]');
  const onClick = () => navigate(button.dataset.contextRoute);
  button?.addEventListener('click', onClick);
  return () => button?.removeEventListener('click', onClick);
}
