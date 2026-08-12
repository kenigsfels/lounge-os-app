import { subscribeSylonMode } from '../core/sylon-state.js';

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
      <p class="sylon-context__eyebrow" data-context-eyebrow>Состояние заведения</p>
      <h1 id="sylonGreeting">${getGreeting()}, Юра.</h1>
      <p class="sylon-context__briefing"><span data-context-message>Сегодня всё спокойно.</span><br><span data-context-detail>${teamLine}</span><br><span data-context-team>${teamLine}</span></p>
      <button type="button" data-context-route="schedule"><span data-context-action>Показать</span> <span aria-hidden="true">↗</span></button>
    </aside>`;
}

export function initContextualCard(root, navigate) {
  const button = root.querySelector('[data-context-route]');
  const eyebrow = root.querySelector('[data-context-eyebrow]');
  const message = root.querySelector('[data-context-message]');
  const detail = root.querySelector('[data-context-detail]');
  const team = root.querySelector('[data-context-team]');
  const action = root.querySelector('[data-context-action]');
  const onClick = () => navigate(button.dataset.contextRoute);
  const unsubscribeMode = subscribeSylonMode((mode) => {
    if (eyebrow) eyebrow.textContent = mode.eyebrow;
    if (message) message.textContent = mode.message;
    if (detail) detail.textContent = mode.detail;
    if (team && mode.teamLine) team.textContent = mode.teamLine;
    if (button) button.dataset.contextRoute = mode.linkedRoute || 'schedule';
    if (action) action.textContent = mode.linkedRoute ? 'Открыть' : 'Показать';
  });
  button?.addEventListener('click', onClick);
  return () => {
    button?.removeEventListener('click', onClick);
    unsubscribeMode();
  };
}
