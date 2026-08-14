import { getAcademyChildren, getAcademyNode, getAcademyPath, getAcademyProgress, getAcademyState, rememberAcademyView, setAcademyLessonStatus } from '../core/academy.js';
import { takeNavigationContext } from '../core/navigation-context.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (symbol) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[symbol]);
}

const STATUS_LABELS = { not_started: 'Не начато', learning: 'Изучаю', mastered: 'Освоено' };

function polar(index, total, rotation) {
  const start = total === 2 ? -Math.PI * .82 : -Math.PI / 2;
  const angle = start + (Math.PI * 2 * index / Math.max(total, 1)) + rotation;
  return { angle, x: 500 + Math.cos(angle) * 330, y: 310 + Math.sin(angle) * 190, left: 50 + Math.cos(angle) * 35, top: 50 + Math.sin(angle) * 31 };
}

const SCALE_LEVELS = [.75, .85, .95, 1, 1.1, 1.2, 1.35];

function rotationStep(rotation) {
  return Math.round((((rotation * 180 / Math.PI) % 360) + 360) % 360 / 15) % 24;
}

function scaleStep(scale) {
  return SCALE_LEVELS.reduce((best, value, index) => Math.abs(value - scale) < Math.abs(SCALE_LEVELS[best] - scale) ? index : best, 0);
}

function renderNode(node, { center = false, position = null, state }) {
  const progress = getAcademyProgress(node.id, state);
  const positionClass = position ? `academy-pos-${position.total}-${position.index} academy-delay-${Math.min(node.order, 7)}` : '';
  return `<button class="academy-node academy-node--${node.type} academy-node--${progress.status} ${center ? 'academy-node--center' : ''} ${positionClass}" type="button" data-academy-node="${escapeHtml(node.id)}" data-academy-title="${escapeHtml(node.title)}" data-academy-subtitle="${escapeHtml(node.subtitle)}" data-academy-progress="${progress.percent}" data-academy-status="${progress.status}" aria-label="${escapeHtml(node.title)}. ${STATUS_LABELS[progress.status]}">
    <span class="academy-node__rings" aria-hidden="true"></span><span class="academy-node__content"><small>${node.type === 'lesson' ? 'Урок' : node.type === 'root' ? 'Начало' : progress.total ? `${progress.completed}/${progress.total}` : 'Раздел'}</small>
    <strong>${escapeHtml(node.title)}</strong><p>${escapeHtml(node.subtitle)}</p></span><i>${progress.percent}%</i>
  </button>`;
}

function renderMap(state) {
  const active = getAcademyNode(state.view.activeId, state) || getAcademyNode('base', state);
  const children = state.view.entered ? getAcademyChildren(active.id, state) : [];
  const ancestors = state.view.entered ? getAcademyPath(active.id, state).slice(0, -1).slice(-3) : [];
  const positions = children.map((_, index) => polar(index, children.length, 0));
  const ancestorPositions = ancestors.map((_, index) => ({
    x: 11 + index * 10,
    y: 18 + index * 10,
    svgX: 110 + index * 100,
    svgY: 112 + index * 62
  }));
  return `<div class="academy-map__world academy-turn-${rotationStep(state.view.rotation)} academy-scale-${scaleStep(state.view.scale)}" data-academy-world>
    <svg class="academy-links" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="academyLine" x1="0" x2="1"><stop offset="0" stop-color="#8f8063" stop-opacity=".12"/><stop offset=".58" stop-color="#bca46f" stop-opacity=".34"/><stop offset="1" stop-color="#e0c98f" stop-opacity=".56"/></linearGradient></defs>
      ${positions.map((position, index) => `<path id="academy-link-${index}" data-academy-line="${index}" data-academy-target="${escapeHtml(children[index].id)}" d="M500 310 Q${500 + Math.cos(position.angle) * 105} ${310 + Math.sin(position.angle) * 42} ${position.x} ${position.y}"/>`).join('')}
      ${positions.map((_, index) => `<circle class="academy-link-signal" data-academy-signal="${escapeHtml(children[index].id)}" r="3"><animateMotion dur="${7 + index * .7}s" begin="-${index * 1.3}s" repeatCount="indefinite"><mpath href="#academy-link-${index}"/></animateMotion></circle>`).join('')}
      ${ancestorPositions.map((position, index) => {
        const next = ancestorPositions[index + 1];
        const endX = next?.svgX ?? 500;
        const endY = next?.svgY ?? 310;
        return `<path class="academy-history-link" d="M${position.svgX} ${position.svgY} Q${Math.round((position.svgX + endX) / 2)} ${Math.round((position.svgY + endY) / 2 - 28)} ${endX} ${endY}"/>`;
      }).join('')}
    </svg>
    <div class="academy-map__field" aria-label="Карта личного обучения">
      ${ancestors.map((node, index) => `<button class="academy-history-node academy-history-node--${index + 1}" type="button" data-academy-path="${escapeHtml(node.id)}" style="--history-x:${ancestorPositions[index].x}%;--history-y:${ancestorPositions[index].y}%" aria-label="Вернуться: ${escapeHtml(node.title)}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(node.title)}</strong></button>`).join('')}
      ${renderNode(active, { center: true, state })}
      ${children.map((node, index) => renderNode(node, { position: { total: children.length, index }, state })).join('')}
    </div>
  </div>`;
}

function renderBreadcrumb(state) {
  const path = getAcademyPath(state.view.activeId, state);
  return `<nav class="academy-path" aria-label="Путь обучения">${path.map((node, index) => `<button type="button" data-academy-path="${escapeHtml(node.id)}" ${index === path.length - 1 ? 'aria-current="page"' : ''}>${escapeHtml(node.title)}</button>${index < path.length - 1 ? '<span>›</span>' : ''}`).join('')}</nav>`;
}

function renderLesson(node, state) {
  const status = state.progress[node.id] || 'not_started';
  return `<article class="academy-lesson">
    <header><p class="overline">Личная Academy · демонстрационный материал</p><h2>${escapeHtml(node.title)}</h2><p>${escapeHtml(node.summary)}</p></header>
    <div class="academy-lesson__status" role="group" aria-label="Статус урока">${Object.entries(STATUS_LABELS).map(([value, label]) => `<button type="button" data-lesson-status="${value}" class="${status === value ? 'is-active' : ''}">${label}</button>`).join('')}</div>
    <section><p class="overline">Разбор</p>${node.sections.map((section, index) => `<div class="academy-lesson__section"><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(section)}</p></div>`).join('')}</section>
    <aside><p class="overline">Удержать в памяти</p><ul>${node.takeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></aside>
    ${node.sources.length ? `<footer><p class="overline">Источники</p>${node.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)} <span>↗</span></a>`).join('')}</footer>` : ''}
  </article>`;
}

function renderAcademy(state = getAcademyState()) {
  const active = getAcademyNode(state.view.activeId, state);
  const progress = getAcademyProgress('base', state);
  const activeProgress = getAcademyProgress(active.id, state);
  const children = getAcademyChildren(active.id, state);
  return `<div class="academy-shell ${state.view.entered ? 'is-entered' : 'is-intro'}">
    <header class="academy-header"><div><p class="overline">Личная Academy</p><h1 id="trainingTitle">Карта знаний</h1></div><div><small>Общий прогресс</small><strong>${progress.percent}%</strong></div></header>
    ${renderBreadcrumb(state)}
    <section class="academy-map glass-panel" data-academy-map data-active-id="${escapeHtml(active.id)}">
      <div class="academy-map__atmosphere" aria-hidden="true"></div>
      <div class="academy-map__transition" aria-hidden="true"><i></i><i></i><b></b></div>
      ${renderMap(state)}
      <div class="academy-map__intro"><p>${state.view.entered ? escapeHtml(active.subtitle) : 'Нажми на Базу, чтобы раскрыть пространство знаний'}</p></div>
      <div class="academy-controls" aria-label="Управление картой"><button type="button" data-academy-home aria-label="К базе">⌂</button><button type="button" data-academy-zoom="out" aria-label="Уменьшить">−</button><button type="button" data-academy-zoom="in" aria-label="Увеличить">＋</button></div>
      <p class="academy-map__hint">Потяни карту, чтобы повернуть <span>·</span> колесо меняет масштаб</p>
    </section>
    <aside class="academy-detail" aria-label="Текущая область обучения">
      <header><small>${active.type === 'lesson' ? 'УРОК' : active.type === 'root' ? 'ЦЕНТР ОБУЧЕНИЯ' : 'ОБЛАСТЬ ЗНАНИЙ'}</small><span>${String(children.length).padStart(2, '0')}</span></header>
      <div class="academy-detail__visual" aria-hidden="true"><i></i><i></i><b></b></div>
      <h2>${escapeHtml(active.title)}</h2><p>${escapeHtml(active.subtitle)}</p>
      <div class="academy-detail__progress"><span>Освоено <b>${activeProgress.percent}%</b></span><i><b style="width:${activeProgress.percent}%"></b></i></div>
      <h3>${children.length ? 'Связанные темы' : 'Текущий материал'}</h3>
      <ul>${children.length ? children.slice(0, 7).map((node) => `<li>${escapeHtml(node.title)} <b>●</b></li>`).join('') : `<li>${STATUS_LABELS[activeProgress.status]} <b>◐</b></li>`}</ul>
      <footer><span></span> SYLON отслеживает личный прогресс</footer>
    </aside>
    <aside class="academy-context"><span></span><p>${state.view.entered ? `${children.length} узлов открыто вокруг центра` : 'Всё обучение начинается с одной точки'}</p><strong>${active.title}</strong></aside>
  </div><dialog class="academy-dialog" data-academy-dialog><button type="button" class="academy-dialog__close" data-academy-close aria-label="Закрыть урок">×</button><div data-academy-dialog-content></div></dialog>`;
}

export function renderTrainingScreen() {
  return `<section class="view academy-space is-active" aria-labelledby="trainingTitle" data-academy-screen>${renderAcademy()}</section>`;
}

export function initTrainingScreen(root, { showToast = () => {} } = {}) {
  const screen = root.querySelector('[data-academy-screen]');
  let state = getAcademyState(); let dragging = false; let pointerX = 0; let startRotation = 0; let saveTimer = 0; let transitionTimer = 0;
  if (!screen) return () => {};
  const mapContext = takeNavigationContext('training');
  if (mapContext?.type === 'academy-node' && getAcademyNode(mapContext.value, state)) {
    rememberAcademyView({ activeId: mapContext.value, entered: true, rotation: 0, scale: 1 });
    state = getAcademyState();
    screen.innerHTML = renderAcademy(state);
    requestAnimationFrame(() => screen.querySelector('[data-academy-map]')?.classList.add('is-map-arrival'));
  }

  const paint = () => { state = getAcademyState(); screen.innerHTML = renderAcademy(state); };
  const saveView = (changes, repaint = true) => { rememberAcademyView(changes); if (repaint) paint(); };
  const transitionTo = (changes, source, direction = 'forward') => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const map = screen.querySelector('[data-academy-map]');
    if (!map || reducedMotion) { saveView(changes); return; }
    const bounds = map.getBoundingClientRect();
    const sourceBounds = source?.getBoundingClientRect?.() || bounds;
    const x = ((sourceBounds.left + sourceBounds.width / 2 - bounds.left) / bounds.width) * 100;
    const y = ((sourceBounds.top + sourceBounds.height / 2 - bounds.top) / bounds.height) * 100;
    map.style.setProperty('--academy-focus-x', `${Math.max(0, Math.min(100, x)).toFixed(2)}%`);
    map.style.setProperty('--academy-focus-y', `${Math.max(0, Math.min(100, y)).toFixed(2)}%`);
    map.dataset.transitionDirection = direction;
    source?.classList?.add('is-selected');
    map.classList.add('is-navigating');
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => saveView(changes), 520);
  };
  const openLesson = (node) => {
    const dialog = screen.querySelector('[data-academy-dialog]');
    dialog.querySelector('[data-academy-dialog-content]').innerHTML = renderLesson(node, state);
    dialog.dataset.lessonId = node.id; dialog.showModal();
  };
  const previewNode = (nodeId) => {
    const node = getAcademyNode(nodeId, state);
    if (!node) return;
    const progress = getAcademyProgress(node.id, state);
    const detail = screen.querySelector('.academy-detail');
    const title = detail?.querySelector('h2');
    const description = detail?.querySelector(':scope > p');
    const percent = detail?.querySelector('.academy-detail__progress span b');
    const bar = detail?.querySelector('.academy-detail__progress > i b');
    const list = detail?.querySelector('ul');
    const children = getAcademyChildren(node.id, state);
    if (title) title.textContent = node.title;
    if (description) description.textContent = node.subtitle;
    if (percent) percent.textContent = `${progress.percent}%`;
    if (bar) bar.style.width = `${progress.percent}%`;
    if (list) list.innerHTML = children.length
      ? children.slice(0, 7).map((child) => `<li>${escapeHtml(child.title)} <b>●</b></li>`).join('')
      : `<li>${STATUS_LABELS[progress.status]} <b>◐</b></li>`;
    screen.dataset.academyPreview = node.id;
    screen.querySelectorAll('[data-academy-line]').forEach((line) => line.classList.toggle('is-preview', line.dataset.academyTarget === node.id));
    screen.querySelectorAll('[data-academy-signal]').forEach((signal) => signal.classList.toggle('is-preview', signal.dataset.academySignal === node.id));
  };
  const clearPreview = () => {
    delete screen.dataset.academyPreview;
    screen.querySelectorAll('[data-academy-line], [data-academy-signal]').forEach((item) => item.classList.remove('is-preview'));
    previewNode(state.view.activeId);
    delete screen.dataset.academyPreview;
  };
  const updateRotation = (rotation) => {
    state.view.rotation = rotation;
    const world = screen.querySelector('[data-academy-world]');
    if (!world) return;
    [...world.classList].filter((name) => name.startsWith('academy-turn-')).forEach((name) => world.classList.remove(name));
    world.classList.add(`academy-turn-${rotationStep(rotation)}`);
  };

  const onClick = (event) => {
    const nodeButton = event.target.closest('[data-academy-node]');
    if (nodeButton) {
      const node = getAcademyNode(nodeButton.dataset.academyNode, state);
      if (node.type === 'lesson') { openLesson(node); return; }
      transitionTo({ activeId: node.id, entered: true, rotation: 0 }, nodeButton, 'forward'); return;
    }
    const path = event.target.closest('[data-academy-path]');
    if (path) { transitionTo({ activeId: path.dataset.academyPath, entered: true, rotation: 0 }, screen.querySelector('.academy-node--center'), 'back'); return; }
    if (event.target.closest('[data-academy-home]')) { transitionTo({ activeId: 'base', entered: true, rotation: 0, scale: 1 }, screen.querySelector('.academy-node--center'), 'back'); return; }
    const zoom = event.target.closest('[data-academy-zoom]');
    if (zoom) { const delta = zoom.dataset.academyZoom === 'in' ? .1 : -.1; saveView({ scale: Math.min(1.35, Math.max(.72, state.view.scale + delta)) }); return; }
    if (event.target.closest('[data-academy-close]')) screen.querySelector('[data-academy-dialog]')?.close();
    const status = event.target.closest('[data-lesson-status]');
    if (status) { const dialog = screen.querySelector('[data-academy-dialog]'); setAcademyLessonStatus(dialog.dataset.lessonId, status.dataset.lessonStatus); state = getAcademyState(); dialog.querySelector('[data-academy-dialog-content]').innerHTML = renderLesson(getAcademyNode(dialog.dataset.lessonId, state), state); showToast(`Статус: ${STATUS_LABELS[status.dataset.lessonStatus]}`); }
  };

  const onPointerDown = (event) => { if (event.target.closest('button,a')) return; dragging = true; pointerX = event.clientX; startRotation = state.view.rotation; event.currentTarget.setPointerCapture?.(event.pointerId); };
  const onPointerMove = (event) => { if (!dragging) return; updateRotation(startRotation + (event.clientX - pointerX) * .006); };
  const onPointerUp = () => { if (!dragging) return; dragging = false; window.clearTimeout(saveTimer); saveTimer = window.setTimeout(() => rememberAcademyView({ rotation: state.view.rotation }), 80); };
  const onWheel = (event) => { if (!event.target.closest('[data-academy-map]')) return; event.preventDefault(); const scale = Math.min(1.35, Math.max(.72, state.view.scale + (event.deltaY < 0 ? .06 : -.06))); state.view.scale = scale; const world = screen.querySelector('[data-academy-world]'); if (world) { [...world.classList].filter((name) => name.startsWith('academy-scale-')).forEach((name) => world.classList.remove(name)); world.classList.add(`academy-scale-${scaleStep(scale)}`); } window.clearTimeout(saveTimer); saveTimer = window.setTimeout(() => rememberAcademyView({ scale }), 120); };

  const onPointerOver = (event) => {
    const node = event.target.closest('[data-academy-node]');
    if (node) previewNode(node.dataset.academyNode);
  };
  const onPointerOut = (event) => {
    const node = event.target.closest('[data-academy-node]');
    if (node && !node.contains(event.relatedTarget)) clearPreview();
  };
  const onFocusIn = (event) => {
    const node = event.target.closest('[data-academy-node]');
    if (node) previewNode(node.dataset.academyNode);
  };
  const onFocusOut = (event) => {
    if (event.target.closest('[data-academy-node]')) clearPreview();
  };

  screen.addEventListener('click', onClick); screen.addEventListener('pointerdown', onPointerDown); screen.addEventListener('pointermove', onPointerMove); screen.addEventListener('pointerup', onPointerUp); screen.addEventListener('pointercancel', onPointerUp); screen.addEventListener('wheel', onWheel, { passive: false }); screen.addEventListener('pointerover', onPointerOver); screen.addEventListener('pointerout', onPointerOut); screen.addEventListener('focusin', onFocusIn); screen.addEventListener('focusout', onFocusOut);
  return () => { window.clearTimeout(saveTimer); window.clearTimeout(transitionTimer); screen.removeEventListener('click', onClick); screen.removeEventListener('pointerdown', onPointerDown); screen.removeEventListener('pointermove', onPointerMove); screen.removeEventListener('pointerup', onPointerUp); screen.removeEventListener('pointercancel', onPointerUp); screen.removeEventListener('wheel', onWheel); screen.removeEventListener('pointerover', onPointerOver); screen.removeEventListener('pointerout', onPointerOut); screen.removeEventListener('focusin', onFocusIn); screen.removeEventListener('focusout', onFocusOut); };
}
