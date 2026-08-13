import { executeSylonCommand } from '../core/command-router.js';
import { askSylon, isSylonAgentConfigured } from '../core/sylon-agent-client.js';
import { getSylonMode, setSylonMode } from '../core/sylon-state.js';

export function renderAssistantInput() {
  return `
    <div class="sylon-assistant-wrap" data-sylon-assistant-wrap>
      <aside class="sylon-answer" data-sylon-answer aria-live="polite" aria-hidden="true">
        <div class="sylon-answer__signal" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="sylon-answer__copy">
          <small data-sylon-answer-eyebrow>SYLON</small>
          <strong data-sylon-answer-text></strong>
          <p data-sylon-answer-detail></p>
          <div class="sylon-answer__evidence" data-sylon-answer-evidence hidden></div>
        </div>
        <button class="sylon-answer__action" type="button" data-sylon-answer-action hidden></button>
        <button class="sylon-answer__close" type="button" data-sylon-answer-close aria-label="Закрыть ответ">×</button>
      </aside>
      <form class="sylon-assistant" data-sylon-assistant role="search">
        <label class="visually-hidden" for="sylonCommand">Команда для SYLON</label>
        <span class="sylon-assistant__mark" aria-hidden="true">⌁</span>
        <input id="sylonCommand" name="command" autocomplete="off"
          placeholder="Спроси SYLON или перейди к чему-нибудь…">
        <kbd>Ctrl K</kbd>
        <button type="submit" aria-label="Выполнить команду">↗</button>
      </form>
    </div>`;
}

export function initAssistantInput(root, { navigate, showToast }) {
  const form = root.querySelector('[data-sylon-assistant]');
  const input = form?.querySelector('input');
  const wrap = root.querySelector('[data-sylon-assistant-wrap]');
  const answer = root.querySelector('[data-sylon-answer]');
  const answerEyebrow = answer?.querySelector('[data-sylon-answer-eyebrow]');
  const answerText = answer?.querySelector('[data-sylon-answer-text]');
  const answerDetail = answer?.querySelector('[data-sylon-answer-detail]');
  const answerEvidence = answer?.querySelector('[data-sylon-answer-evidence]');
  const answerAction = answer?.querySelector('[data-sylon-answer-action]');
  const answerClose = answer?.querySelector('[data-sylon-answer-close]');
  let answerRoute = null;
  let requestId = 0;
  let disposed = false;

  const hideAnswer = () => {
    wrap?.classList.remove('has-answer', 'is-thinking');
    answer?.setAttribute('aria-hidden', 'true');
    answerRoute = null;
  };

  const showThinking = () => {
    const remoteAgent = isSylonAgentConfigured();
    wrap?.classList.add('has-answer', 'is-thinking');
    answer?.setAttribute('aria-hidden', 'false');
    if (answerEyebrow) answerEyebrow.textContent = remoteAgent ? 'Мозг SYLON' : 'Смотрю на связи';
    if (answerText) answerText.textContent = 'Собираю ответ…';
    if (answerDetail) answerDetail.textContent = remoteAgent
      ? 'Безопасно сверяю разрешённый контекст и функции.'
      : 'Только по локальным данным внутри SYLON.';
    if (answerEvidence) { answerEvidence.hidden = true; answerEvidence.replaceChildren(); }
    if (answerAction) answerAction.hidden = true;
  };

  const showAnswer = (result) => {
    wrap?.classList.remove('is-thinking');
    wrap?.classList.add('has-answer');
    answer?.setAttribute('aria-hidden', 'false');
    if (answerEyebrow) answerEyebrow.textContent = result.eyebrow || 'SYLON';
    if (answerText) answerText.textContent = result.text;
    if (answerDetail) answerDetail.textContent = result.detail || '';
    if (answerEvidence) {
      const evidence = Array.isArray(result.evidence) ? result.evidence.slice(0, 4) : [];
      answerEvidence.replaceChildren(...evidence.map((item) => {
        const badge = document.createElement('span');
        badge.textContent = item.label || 'Данные SYLON';
        return badge;
      }));
      answerEvidence.hidden = evidence.length === 0;
    }
    answerRoute = result.route || null;
    if (answerAction) {
      answerAction.textContent = result.actionLabel || '';
      answerAction.hidden = !answerRoute || !result.actionLabel;
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const value = input?.value || '';
    if (!value.trim()) return;
    const currentRequest = ++requestId;
    const previousMode = getSylonMode();
    const startedAt = performance.now();
    showThinking();
    setSylonMode('analysis', {
      label: 'SYLON смотрит',
      eyebrow: isSylonAgentConfigured() ? 'Контекстный анализ' : 'Локальный анализ',
      message: 'Собираю ответ по разрешённым данным внутри системы.',
      detail: isSylonAgentConfigured() ? 'Инструменты работают только на чтение.' : 'Работаю без внешнего сервера.',
      linkedRoute: null
    });

    try {
      const result = await askSylon(value);
      const remainingDelay = Math.max(0, 420 - (performance.now() - startedAt));
      if (remainingDelay > 0) await new Promise((resolve) => window.setTimeout(resolve, remainingDelay));
      if (disposed || currentRequest !== requestId) return;

      if (result) {
        showAnswer(result);
        setSylonMode(result.mode, {
          label: result.mode === 'attention' ? 'Нужно внимание' : 'Ответ готов',
          eyebrow: result.eyebrow,
          message: result.text,
          detail: result.detail,
          linkedRoute: result.route || null
        });
        input.value = '';
        return;
      }

      hideAnswer();
      setSylonMode(previousMode.id, previousMode);
      const commandResult = executeSylonCommand(value, { navigate, showToast });
      if (commandResult.type === 'navigate') input.value = '';
    } catch {
      if (disposed || currentRequest !== requestId) return;
      showAnswer({
        eyebrow: 'Ответ недоступен',
        text: 'Не получилось прочитать локальные данные.',
        detail: 'Попробуй ещё раз или открой нужный раздел.',
        mode: 'attention',
        route: null
      });
      setSylonMode(previousMode.id, previousMode);
    }
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
    if (event.key === 'Escape') {
      hideAnswer();
      if (document.activeElement === input) input.blur();
    }
  };

  const onAnswerAction = () => answerRoute && navigate(answerRoute);
  const onAnswerClose = () => hideAnswer();

  form?.addEventListener('submit', onSubmit);
  window.addEventListener('keydown', onKeydown);
  answerAction?.addEventListener('click', onAnswerAction);
  answerClose?.addEventListener('click', onAnswerClose);

  return () => {
    disposed = true;
    requestId += 1;
    form?.removeEventListener('submit', onSubmit);
    window.removeEventListener('keydown', onKeydown);
    answerAction?.removeEventListener('click', onAnswerAction);
    answerClose?.removeEventListener('click', onAnswerClose);
  };
}
