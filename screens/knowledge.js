import { createRegulation, deleteRegulation, getKnowledgeState, KNOWLEDGE_CATEGORIES, resetRegulationProgress, setChecklistItem, setRegulationPinned, updateRegulation } from '../core/knowledge.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (symbol) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[symbol]);
}

function categoryLabel(id) {
  return KNOWLEDGE_CATEGORIES.find((item) => item.id === id)?.label || 'Материал';
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Недавно' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function lines(value) {
  return String(value ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function renderCard(item, selectedId) {
  return `<button class="regulation-card ${item.id === selectedId ? 'is-active' : ''}" type="button" data-regulation-open="${escapeHtml(item.id)}">
    <span class="regulation-card__mark">${item.pinned ? '◆' : '◇'}</span><small>${escapeHtml(categoryLabel(item.category))}</small>
    <strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary || item.situation)}</p><i>${item.steps.length} шагов · ${item.checklist.length} пунктов</i><b>↗</b>
  </button>`;
}

function renderArticle(item, state) {
  if (!item) return `<div class="regulation-empty"><span>◎</span><strong>Выбери ситуацию</strong><p>SYLON покажет связанный регламент и поможет пройти его по шагам.</p></div>`;
  const completed = new Set(Array.isArray(state.progress[item.id]) ? state.progress[item.id] : []);
  const related = state.items.filter((value) => value.id !== item.id && value.category === item.category).slice(0, 3);
  return `<article class="regulation-article">
    <header><div><small>${escapeHtml(categoryLabel(item.category))}${item.demo ? ' · пример' : ''}</small><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p></div>
      <button type="button" class="regulation-pin ${item.pinned ? 'is-active' : ''}" data-regulation-pin="${escapeHtml(item.id)}" aria-label="${item.pinned ? 'Открепить' : 'Закрепить'}">◆</button>
    </header>
    ${item.warnings.length ? `<aside class="regulation-warning"><strong>Важно</strong>${item.warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join('')}</aside>` : ''}
    <section class="regulation-steps"><p class="overline">Последовательность</p><ol>${item.steps.length ? item.steps.map((step) => `<li><span></span><p>${escapeHtml(step)}</p></li>`).join('') : '<li class="is-empty"><p>Шаги пока не добавлены.</p></li>'}</ol></section>
    ${item.checklist.length ? `<section class="regulation-checklist"><header><div><p class="overline">Проверка</p><strong>${completed.size} из ${item.checklist.length}</strong></div><button type="button" data-regulation-reset="${escapeHtml(item.id)}">Сбросить</button></header>
      <div>${item.checklist.map((entry, index) => `<label><input type="checkbox" data-regulation-check="${escapeHtml(item.id)}" data-check-index="${index}" ${completed.has(index) ? 'checked' : ''}><span></span><p>${escapeHtml(entry)}</p></label>`).join('')}</div></section>` : ''}
    ${related.length ? `<section class="regulation-related"><p class="overline">Связано</p><div>${related.map((value) => `<button type="button" data-regulation-open="${escapeHtml(value.id)}">${escapeHtml(value.title)} <span>↗</span></button>`).join('')}</div></section>` : ''}
    <footer><span>Изменено ${escapeHtml(formatDate(item.updatedAt))}</span><button type="button" data-regulation-edit="${escapeHtml(item.id)}">Редактировать</button></footer>
  </article>`;
}

function renderEditor(item = null) {
  const value = item || { title: '', situation: '', category: 'shift', summary: '', steps: [], checklist: [], warnings: [], pinned: false };
  return `<form class="regulation-editor" data-regulation-form data-regulation-id="${escapeHtml(item?.id || '')}">
    <p class="overline">${item ? 'Редактирование' : 'Новый материал'}</p><h2>${item ? escapeHtml(item.title) : 'Создать регламент'}</h2>
    <label class="field"><span>Название</span><input name="title" value="${escapeHtml(value.title)}" required></label>
    <label class="field"><span>Ситуация — «Что происходит?»</span><input name="situation" value="${escapeHtml(value.situation)}" placeholder="Например: Открываю смену" required></label>
    <label class="field"><span>Категория</span><select name="category">${KNOWLEDGE_CATEGORIES.map((category) => `<option value="${category.id}" ${value.category === category.id ? 'selected' : ''}>${category.label}</option>`).join('')}</select></label>
    <label class="field"><span>Коротко</span><textarea name="summary" rows="2" placeholder="Какую задачу решает регламент">${escapeHtml(value.summary)}</textarea></label>
    <label class="field"><span>Шаги — каждый с новой строки</span><textarea name="steps" rows="6">${escapeHtml(value.steps.join('\n'))}</textarea></label>
    <label class="field"><span>Чек-лист — каждый пункт с новой строки</span><textarea name="checklist" rows="4">${escapeHtml(value.checklist.join('\n'))}</textarea></label>
    <label class="field"><span>Предупреждения — каждое с новой строки</span><textarea name="warnings" rows="3">${escapeHtml(value.warnings.join('\n'))}</textarea></label>
    <label class="regulation-editor__pin"><input type="checkbox" name="pinned" ${value.pinned ? 'checked' : ''}><span></span>Закрепить на главном экране</label>
    <div class="regulation-editor__actions">${item ? '<button type="button" class="regulation-delete" data-regulation-delete>Удалить</button>' : '<span></span>'}<button type="button" class="secondary-button" data-regulation-editor-close>Отмена</button><button type="submit" class="primary-button">Сохранить</button></div>
  </form>`;
}

function renderSpace({ selectedId = '', category = 'all', query = '' } = {}) {
  const state = getKnowledgeState();
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  const filtered = state.items.filter((item) => {
    const inCategory = category === 'all' || item.category === category;
    const haystack = [item.title, item.situation, item.summary, ...item.steps].join(' ').toLocaleLowerCase('ru-RU');
    return inCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const selected = state.items.find((item) => item.id === selectedId) || filtered[0] || null;
  const situations = [...state.items].sort((a, b) => Number(b.pinned) - Number(a.pinned)).slice(0, 6);
  return `<div class="knowledge-shell">
    <header class="knowledge-header glass-panel"><div><p class="overline">Живые регламенты</p><h1 id="knowledgeTitle">Что сейчас происходит?</h1><p>Найди ситуацию — SYLON покажет следующий понятный шаг.</p></div><button class="primary-button" type="button" data-regulation-add>＋ Создать</button>
      <label class="knowledge-search"><span>⌕</span><input type="search" value="${escapeHtml(query)}" placeholder="Поиск по ситуациям и шагам" data-knowledge-search></label>
    </header>
    <nav class="knowledge-situations" aria-label="Частые ситуации">${situations.map((item) => `<button type="button" data-situation="${escapeHtml(item.situation)}"><span></span>${escapeHtml(item.situation)}</button>`).join('')}</nav>
    <aside class="knowledge-categories glass-panel"><p class="overline">Пространства</p><button type="button" data-knowledge-category="all" class="${category === 'all' ? 'is-active' : ''}"><span>Все материалы</span><b>${state.items.length}</b></button>${KNOWLEDGE_CATEGORIES.map((item) => `<button type="button" data-knowledge-category="${item.id}" class="${category === item.id ? 'is-active' : ''}"><span>${item.label}</span><b>${state.items.filter((value) => value.category === item.id).length}</b></button>`).join('')}</aside>
    <main class="knowledge-results"><header><div><p class="overline">${category === 'all' ? 'Все ситуации' : escapeHtml(categoryLabel(category))}</p><h2>${filtered.length} ${filtered.length === 1 ? 'материал' : 'материалов'}</h2></div></header><div>${filtered.length ? filtered.map((item) => renderCard(item, selected?.id)).join('') : '<div class="knowledge-results__empty"><strong>Ничего не найдено</strong><p>Попробуй другой запрос или создай новый регламент.</p></div>'}</div></main>
    <section class="knowledge-reader glass-panel" data-knowledge-reader>${renderArticle(selected, state)}</section>
  </div><dialog class="regulation-dialog" data-regulation-dialog><button type="button" class="regulation-dialog__close" data-regulation-editor-close>×</button><div data-regulation-dialog-content></div></dialog>`;
}

export function renderKnowledgeScreen() {
  return `<section class="view knowledge-space is-active" aria-labelledby="knowledgeTitle" data-knowledge-screen>${renderSpace()}</section>`;
}

export function initKnowledgeScreen(root, { showToast = () => {} } = {}) {
  const screen = root.querySelector('[data-knowledge-screen]');
  let selectedId = '';
  let category = 'all';
  let query = '';
  if (!screen) return () => {};

  const paint = () => { screen.innerHTML = renderSpace({ selectedId, category, query }); };
  const openEditor = (item = null) => {
    const dialog = screen.querySelector('[data-regulation-dialog]');
    dialog.querySelector('[data-regulation-dialog-content]').innerHTML = renderEditor(item);
    dialog.showModal();
  };

  const onClick = (event) => {
    const open = event.target.closest('[data-regulation-open]');
    if (open) { selectedId = open.dataset.regulationOpen; paint(); return; }
    const situation = event.target.closest('[data-situation]');
    if (situation) { query = situation.dataset.situation; category = 'all'; paint(); return; }
    const categoryButton = event.target.closest('[data-knowledge-category]');
    if (categoryButton) { category = categoryButton.dataset.knowledgeCategory; query = ''; paint(); return; }
    if (event.target.closest('[data-regulation-add]')) { openEditor(); return; }
    const edit = event.target.closest('[data-regulation-edit]');
    if (edit) { openEditor(getKnowledgeState().items.find((item) => item.id === edit.dataset.regulationEdit)); return; }
    const pin = event.target.closest('[data-regulation-pin]');
    if (pin) { const item = getKnowledgeState().items.find((value) => value.id === pin.dataset.regulationPin); setRegulationPinned(item.id, !item.pinned); selectedId = item.id; paint(); return; }
    const reset = event.target.closest('[data-regulation-reset]');
    if (reset) { resetRegulationProgress(reset.dataset.regulationReset); selectedId = reset.dataset.regulationReset; paint(); return; }
    if (event.target.closest('[data-regulation-editor-close]')) screen.querySelector('[data-regulation-dialog]')?.close();
    if (event.target.closest('[data-regulation-delete]')) {
      const form = event.target.closest('[data-regulation-form]');
      if (window.confirm('Удалить этот регламент?')) { deleteRegulation(form.dataset.regulationId); selectedId = ''; paint(); showToast('Регламент удалён'); }
    }
  };

  const onInput = (event) => {
    if (!event.target.matches('[data-knowledge-search]')) return;
    query = event.target.value;
    window.clearTimeout(onInput.timer);
    onInput.timer = window.setTimeout(paint, 160);
  };

  const onChange = (event) => {
    if (!event.target.matches('[data-regulation-check]')) return;
    setChecklistItem(event.target.dataset.regulationCheck, Number(event.target.dataset.checkIndex), event.target.checked);
    selectedId = event.target.dataset.regulationCheck;
    paint();
  };

  const onSubmit = (event) => {
    if (!event.target.matches('[data-regulation-form]')) return;
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const payload = { title: data.get('title'), situation: data.get('situation'), category: data.get('category'), summary: data.get('summary'), steps: lines(data.get('steps')), checklist: lines(data.get('checklist')), warnings: lines(data.get('warnings')), pinned: data.get('pinned') === 'on' };
    const result = form.dataset.regulationId ? updateRegulation(form.dataset.regulationId, payload) : createRegulation(payload);
    if (!result.success) { showToast(result.errors[0]); return; }
    selectedId = result.item.id;
    paint();
    showToast(form.dataset.regulationId ? 'Регламент обновлён' : 'Регламент создан');
  };

  screen.addEventListener('click', onClick);
  screen.addEventListener('input', onInput);
  screen.addEventListener('change', onChange);
  screen.addEventListener('submit', onSubmit);
  return () => { window.clearTimeout(onInput.timer); screen.removeEventListener('click', onClick); screen.removeEventListener('input', onInput); screen.removeEventListener('change', onChange); screen.removeEventListener('submit', onSubmit); };
}
