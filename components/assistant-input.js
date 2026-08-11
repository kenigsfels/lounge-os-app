import { executeSylonCommand } from '../core/command-router.js';

export function renderAssistantInput() {
  return `
    <form class="sylon-assistant" data-sylon-assistant role="search">
      <label class="visually-hidden" for="sylonCommand">Команда для SYLON</label>
      <span class="sylon-assistant__mark" aria-hidden="true">⌁</span>
      <input id="sylonCommand" name="command" autocomplete="off"
        placeholder="Спроси SYLON или перейди к чему-нибудь…">
      <kbd>Ctrl K</kbd>
      <button type="submit" aria-label="Выполнить команду">↗</button>
    </form>`;
}

export function initAssistantInput(root, { navigate, showToast }) {
  const form = root.querySelector('[data-sylon-assistant]');
  const input = form?.querySelector('input');

  const onSubmit = (event) => {
    event.preventDefault();
    const result = executeSylonCommand(input.value, { navigate, showToast });
    if (result.type === 'navigate') input.value = '';
  };

  const onKeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
      event.preventDefault();
      input?.focus();
      input?.select();
    }
    if (event.key === 'Enter' && document.activeElement === input) {
      event.preventDefault();
      form?.requestSubmit();
    }
    if (event.key === 'Escape' && document.activeElement === input) input.blur();
  };

  form?.addEventListener('submit', onSubmit);
  window.addEventListener('keydown', onKeydown);

  return () => {
    form?.removeEventListener('submit', onSubmit);
    window.removeEventListener('keydown', onKeydown);
  };
}
