import { getEmployees } from '../core/employees.js';
import { loadSylonBriefing } from '../core/sylon-briefing.js';
import { cycleSylonMode, setSylonMode, subscribeSylonMode } from '../core/sylon-state.js';
import { getMapNeighbors, getMapNode, getVisibleMapNodes, SYLON_MAP } from '../core/sylon-map-model.js';
import { initSylonMap } from '../components/sylon-map.js';
import { initAssistantInput, renderAssistantInput } from '../components/assistant-input.js';
import { initContextualCard, renderContextualCard } from '../components/contextual-card.js';
import { initFallbackNavigation, renderFallbackNavigation } from '../components/fallback-navigation.js';

function buildMapEdgePath(edge, index) {
  const source = getMapNode(edge.source);
  const target = getMapNode(edge.target);
  if (!source?.position || !target?.position) return null;
  const { x: x1, y: y1 } = source.position;
  const { x: x2, y: y2 } = target.position;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(1, Math.hypot(dx, dy));
  const direction = index % 2 === 0 ? 1 : -1;
  const bend = edge.source === SYLON_MAP.rootId ? 2.8 : 5.5;
  const controlX = centerX - (dy / length) * bend * direction;
  const controlY = centerY + (dx / length) * bend * direction;
  return `M ${x1} ${y1} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${x2} ${y2}`;
}

function renderMapEdge(edge, index) {
  const source = getMapNode(edge.source);
  const target = getMapNode(edge.target);
  const path = buildMapEdgePath(edge, index);
  if (!path) return '';
  return `
    <g class="sylon-map-edge-group" data-map-edge="${edge.id}"
      data-source="${edge.source}" data-target="${edge.target}">
      <title>${source.label} — ${edge.relation} — ${target.label}</title>
      <path class="sylon-map-edge sylon-map-edge--halo" d="${path}" pathLength="1"></path>
      <path class="sylon-map-edge sylon-map-edge--base" d="${path}" pathLength="1"></path>
      <path class="sylon-map-edge sylon-map-edge--signal" d="${path}" pathLength="1"></path>
    </g>`;
}

function renderMapNode(node, index) {
  const isRoot = node.id === SYLON_MAP.rootId;
  const attributes = isRoot
    ? 'aria-current="location" tabindex="-1"'
    : `data-map-route="${node.route}"`;
  return `
    <button class="sylon-map-node sylon-map-node--${isRoot ? 'root' : node.tone}"
      type="button" data-map-node="${node.id}" data-node-index="${index}" ${attributes}>
      <span class="sylon-map-node__object" aria-hidden="true"><i></i><b></b><span>${isRoot ? '00' : String(index).padStart(2, '0')}</span></span>
      <span class="sylon-map-node__copy">
        ${isRoot ? '<small>Живая карта</small>' : `<small>Связь 0${index}</small>`}
        <strong>${node.label}</strong>
        ${node.detail ? `<em>${node.detail}</em>` : ''}
      </span>
    </button>`;
}

export function renderSylonHomeScreen() {
  const activeEmployees = getEmployees().filter((employee) => employee.status === 'active').length;
  const visibleNodes = getVisibleMapNodes();
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = SYLON_MAP.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));

  return `
    <section class="sylon-home sylon-home--map view is-active" data-sylon-home aria-labelledby="sylonHomeTitle">
      <div class="sylon-home__atmosphere" aria-hidden="true"></div>
      <header class="sylon-home__brand">
        <a href="#dashboard" data-sylon-home-link aria-label="SYLON — главная">
          <span class="sylon-home__brand-mark" aria-hidden="true"></span>
          <strong>SYLON</strong>
        </a>
        <p id="sylonHomeTitle">Карта связей заведения</p>
      </header>
      <button class="sylon-home__status" type="button" data-sylon-state-toggle
        aria-label="Демонстрационное состояние SYLON. Нажмите, чтобы переключить">
        <span></span><strong data-sylon-state-label>Система спокойна</strong><i>Демо</i>
      </button>
      ${renderContextualCard({ activeEmployees })}
      <nav class="sylon-map-path" data-map-path aria-label="Путь по карте">
        <span>SYLON</span><i aria-hidden="true">/</i><strong data-map-path-current>Главная карта</strong>
      </nav>
      <div class="sylon-map-stage" data-map-stage>
        <div class="sylon-map-depth" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="sylon-map-layer" data-sylon-map aria-hidden="true"></div>
        <svg class="sylon-map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Связи между разделами">
          ${visibleEdges.map(renderMapEdge).join('')}
        </svg>
        <div class="sylon-map-nodes" aria-label="Ближайшие узлы SYLON">
          ${visibleNodes.map(renderMapNode).join('')}
        </div>
        <p class="visually-hidden" data-map-status aria-live="polite"></p>
      </div>
      <p class="sylon-map-hint">Выбери узел <span>·</span> Tab и стрелки работают с клавиатуры</p>
      ${renderAssistantInput()}
      ${renderFallbackNavigation()}
      <div class="sylon-focus-shell" data-focus-shell aria-hidden="true">
        <div class="sylon-focus-shell__mark"><span></span></div>
        <p>Приближаюсь к узлу</p>
        <strong data-focus-title>Раздел</strong>
        <i></i>
      </div>
    </section>`;
}

export function initSylonHomeScreen(root, { navigate, showToast }) {
  const home = root.querySelector('[data-sylon-home]');
  const mapContainer = home?.querySelector('[data-sylon-map]');
  const mapStage = home?.querySelector('[data-map-stage]');
  const nodes = [...(home?.querySelectorAll('[data-map-route]') || [])];
  const stateToggle = home?.querySelector('[data-sylon-state-toggle]');
  const stateLabel = home?.querySelector('[data-sylon-state-label]');
  const assistantInput = home?.querySelector('[data-sylon-assistant] input');
  const pathCurrent = home?.querySelector('[data-map-path-current]');
  const mapStatus = home?.querySelector('[data-map-status]');
  const cleanup = [
    initContextualCard(home, navigate),
    initAssistantInput(home, { navigate, showToast }),
    initFallbackNavigation(home, navigate)
  ];
  let mapCleanup = () => {};
  let disposed = false;
  let demoOverride = false;
  let navigationTimer = 0;

  const setMapFocus = (nodeId, { announce = false } = {}) => {
    const node = getMapNode(nodeId) || getMapNode(SYLON_MAP.rootId);
    home.dataset.focusedNode = node.id;
    const relatedIds = new Set(getMapNeighbors(node.id).map((related) => related.id));
    nodes.forEach((button) => {
      button.classList.toggle('is-neighbor', button.dataset.mapNode === node.id);
      button.classList.toggle('is-adjacent', relatedIds.has(button.dataset.mapNode));
    });
    home.querySelectorAll('[data-map-edge]').forEach((edge) => {
      edge.classList.toggle('is-related', node.id !== SYLON_MAP.rootId
        && [edge.dataset.source, edge.dataset.target].includes(node.id));
    });
    mapContainer?.dispatchEvent(new CustomEvent('sylon:map-focus', { detail: { nodeId: node.id } }));
    if (pathCurrent) pathCurrent.textContent = node.id === SYLON_MAP.rootId ? 'Главная карта' : node.label;
    if (announce && mapStatus) mapStatus.textContent = `В фокусе: ${node.label}. ${node.detail || ''}`;
  };

  const applyMode = (mode) => {
    home.dataset.sylonMode = mode.id;
    home.dataset.linkedRoute = mode.linkedRoute || '';
    if (stateLabel) stateLabel.textContent = mode.label;
    if (assistantInput) {
      assistantInput.placeholder = mode.id === 'analysis'
        ? 'SYLON смотрит на связи…'
        : 'Спроси SYLON или перейди к чему-нибудь…';
    }
  };

  const unsubscribeMode = subscribeSylonMode(applyMode);
  const onStateToggle = () => {
    demoOverride = true;
    cycleSylonMode();
  };
  stateToggle?.addEventListener('click', onStateToggle);
  setMapFocus(SYLON_MAP.rootId);

  const runBriefing = async () => {
    const startedAt = performance.now();
    setSylonMode('analysis', {
      label: 'SYLON смотрит', eyebrow: 'Собираю сводку',
      message: 'Смотрю на график и команду.',
      detail: 'Это займёт несколько мгновений.', linkedRoute: null
    });
    const briefing = await loadSylonBriefing();
    const remainingDelay = Math.max(0, 850 - (performance.now() - startedAt));
    if (remainingDelay > 0) await new Promise((resolve) => window.setTimeout(resolve, remainingDelay));
    if (!disposed && !demoOverride) setSylonMode(briefing.mode, briefing);
  };

  runBriefing().catch(() => {
    if (!disposed && !demoOverride) {
      setSylonMode('attention', {
        label: 'Не удалось проверить', eyebrow: 'Сводка недоступна',
        message: 'Я не смог прочитать график.',
        detail: 'Открой раздел графика и проверь источник данных.', linkedRoute: 'schedule'
      });
    }
  });

  initSylonMap(mapContainer).then((disposeMap) => {
    if (disposed) disposeMap();
    else mapCleanup = disposeMap;
  });

  const openRoute = (route) => {
    const selectedNode = home.querySelector(`[data-map-route="${route}"]`);
    const node = getMapNode(selectedNode?.dataset.mapNode);
    if (!selectedNode || !node) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMapFocus(node.id, { announce: true });
    if (reducedMotion) {
      navigate(route);
      return;
    }
    const focusShell = home.querySelector('[data-focus-shell]');
    const title = focusShell?.querySelector('[data-focus-title]');
    if (title) title.textContent = node.label;
    const nodeObject = selectedNode.querySelector('.sylon-map-node__object');
    const nodeBounds = nodeObject?.getBoundingClientRect();
    if (focusShell && nodeBounds) {
      const portalX = ((nodeBounds.left + nodeBounds.width / 2) / window.innerWidth) * 100;
      const portalY = ((nodeBounds.top + nodeBounds.height / 2) / window.innerHeight) * 100;
      focusShell.style.setProperty('--portal-x', `${portalX.toFixed(2)}%`);
      focusShell.style.setProperty('--portal-y', `${portalY.toFixed(2)}%`);
    }
    selectedNode.classList.add('is-selected');
    home.classList.add('is-opening');
    home.dataset.openingNode = node.id;
    if (focusShell) focusShell.dataset.focusNode = node.id;
    focusShell?.classList.add('is-preparing');
    focusShell?.getBoundingClientRect();
    window.requestAnimationFrame(() => focusShell?.classList.add('is-active'));
    window.clearTimeout(navigationTimer);
    navigationTimer = window.setTimeout(() => navigate(route), 760);
  };

  const onNodeClick = (event) => openRoute(event.currentTarget.dataset.mapRoute);
  const onNodeEnter = (event) => {
    const nodeId = event.currentTarget.dataset.mapNode;
    home.dataset.hoveredNode = nodeId;
    home.querySelectorAll('[data-map-edge]').forEach((edge) => {
      edge.classList.toggle('is-related', [edge.dataset.source, edge.dataset.target].includes(nodeId));
    });
    const adjacentIds = new Set(getMapNeighbors(nodeId).map((node) => node.id));
    nodes.forEach((node) => node.classList.toggle('is-adjacent', adjacentIds.has(node.dataset.mapNode)));
    mapContainer?.dispatchEvent(new CustomEvent('sylon:map-hover', { detail: { nodeId } }));
  };
  const onNodeLeave = () => {
    delete home.dataset.hoveredNode;
    home.querySelectorAll('[data-map-edge]').forEach((edge) => edge.classList.remove('is-related'));
    nodes.forEach((node) => node.classList.remove('is-adjacent'));
    mapContainer?.dispatchEvent(new CustomEvent('sylon:map-hover', { detail: { nodeId: null } }));
  };
  const onNodeFocus = (event) => {
    onNodeEnter(event);
    setMapFocus(event.currentTarget.dataset.mapNode, { announce: true });
  };
  const onKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = Math.max(0, nodes.indexOf(document.activeElement));
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
    nodes[(currentIndex + direction + nodes.length) % nodes.length]?.focus();
  };

  nodes.forEach((node) => {
    node.addEventListener('click', onNodeClick);
    node.addEventListener('pointerenter', onNodeEnter);
    node.addEventListener('pointerleave', onNodeLeave);
    node.addEventListener('focus', onNodeFocus);
    node.addEventListener('blur', onNodeLeave);
    node.addEventListener('keydown', onKeyDown);
  });

  return () => {
    disposed = true;
    window.clearTimeout(navigationTimer);
    mapCleanup();
    stateToggle?.removeEventListener('click', onStateToggle);
    unsubscribeMode();
    cleanup.forEach((dispose) => dispose?.());
    nodes.forEach((node) => {
      node.removeEventListener('click', onNodeClick);
      node.removeEventListener('pointerenter', onNodeEnter);
      node.removeEventListener('pointerleave', onNodeLeave);
      node.removeEventListener('focus', onNodeFocus);
      node.removeEventListener('blur', onNodeLeave);
      node.removeEventListener('keydown', onKeyDown);
    });
  };
}
