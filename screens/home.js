import { getEmployees } from '../core/employees.js';
import { getTasks, getTaskOverview } from '../core/tasks.js';
import { getWarehouseItems, getWarehouseOverview } from '../core/warehouse.js';
import { readScheduleSnapshot } from '../core/schedule.js';
import { setNavigationContext } from '../core/navigation-context.js';
import { loadSylonBriefing } from '../core/sylon-briefing.js';
import { cycleSylonMode, setSylonMode, subscribeSylonMode } from '../core/sylon-state.js';
import { getMapNeighbors, getMapNode, getVisibleMapNodes, SYLON_MAP } from '../core/sylon-map-model.js';
import { initSylonMap } from '../components/sylon-map.js';
import { initAssistantInput, renderAssistantInput } from '../components/assistant-input.js';
import { initContextualCard, renderContextualCard } from '../components/contextual-card.js';
import { initFallbackNavigation, renderFallbackNavigation } from '../components/fallback-navigation.js';
import { getAcademyChildren, getAcademyProgress, getAcademyState } from '../core/academy.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (symbol) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[symbol]);
}

function getHomeMapMetrics() {
  const employees = getEmployees();
  const activeEmployees = employees.filter((employee) => employee.status === 'active');
  const taskOverview = getTaskOverview(getTasks());
  const stock = getWarehouseOverview(getWarehouseItems());
  const academy = getAcademyProgress('base', getAcademyState());
  const ratedEmployees = activeEmployees.filter((employee) => Number(employee.rate) > 0).length;
  const percent = (value, total, fallback = 0) => total ? Math.round(value / total * 100) : fallback;
  return {
    sylon: { value: '6 связей', percent: 100, state: 'calm' },
    employees: { value: `${activeEmployees.length} активных`, percent: percent(activeEmployees.length, employees.length), state: activeEmployees.length ? 'calm' : 'empty' },
    schedule: { value: 'Проверяю…', percent: 0, state: 'loading' },
    tasks: { value: `${taskOverview.open.length} открыто`, percent: percent(taskOverview.completed.length, taskOverview.open.length + taskOverview.completed.length, 100), state: taskOverview.overdue.length ? 'attention' : 'calm' },
    warehouse: { value: `${stock.items.length} позиций`, percent: percent(stock.ok.length, stock.items.length, 100), state: stock.attention.length ? 'attention' : 'calm' },
    training: { value: `${academy.percent}% пройдено`, percent: academy.percent, state: academy.status === 'mastered' ? 'calm' : 'learning' },
    finance: { value: `${ratedEmployees} ставок`, percent: percent(ratedEmployees, activeEmployees.length), state: ratedEmployees === activeEmployees.length && activeEmployees.length ? 'calm' : 'empty' }
  };
}

function buildMapEdgePath(edge, index) {
  const source = getMapNode(edge.source);
  const target = getMapNode(edge.target);
  if (!source?.position || !target?.position) return null;
  let { x: x1, y: y1 } = source.position;
  const { x: x2, y: y2 } = target.position;
  if (edge.source === SYLON_MAP.rootId) {
    const angle = Math.atan2(y2 - 50, x2 - 50);
    x1 = 50 + Math.cos(angle) * 13;
    y1 = 50 + Math.sin(angle) * 7;
  }
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
      <path class="sylon-map-edge sylon-map-edge--filament sylon-map-edge--filament-a" d="${path}" pathLength="1"></path>
      <path class="sylon-map-edge sylon-map-edge--filament sylon-map-edge--filament-b" d="${path}" pathLength="1"></path>
      <path class="sylon-map-edge sylon-map-edge--base" d="${path}" pathLength="1"></path>
      <path class="sylon-map-edge sylon-map-edge--signal" d="${path}" pathLength="1"></path>
    </g>`;
}

function buildSystemBackbonePath(nodes) {
  const ordered = nodes
    .filter((node) => node.id !== SYLON_MAP.rootId && node.position)
    .sort((a, b) => Math.atan2(a.position.y - 50, a.position.x - 50) - Math.atan2(b.position.y - 50, b.position.x - 50));
  if (ordered.length < 3) return '';
  const midpoint = (a, b) => ({ x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 });
  const start = midpoint(ordered.at(-1), ordered[0]);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} ${ordered.map((node, index) => {
    const end = midpoint(node, ordered[(index + 1) % ordered.length]);
    return `Q ${node.position.x} ${node.position.y} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }).join(' ')} Z`;
}

function renderMapNode(node, index, metric) {
  const isRoot = node.id === SYLON_MAP.rootId;
  const icons = {
    employees: '<path d="M12 12a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z"/><path d="M5.6 20c.4-4 2.5-6 6.4-6s6 2 6.4 6"/>',
    schedule: '<rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M8 3.5v4m8-4v4M4 10h16"/>',
    tasks: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="m8 12 2.7 2.7L16.5 9"/>',
    warehouse: '<path d="m12 3.5 8 4.4-8 4.4-8-4.4 8-4.4Z"/><path d="M4 8v8.3l8 4.2 8-4.2V8M12 12.5v8"/>',
    training: '<path d="M5 4.5h6.8v15H7.5A3.5 3.5 0 0 0 4 23V5.5A1 1 0 0 1 5 4.5Z"/><path d="M19 4.5h-6.8v15h4.3A3.5 3.5 0 0 1 20 23V5.5a1 1 0 0 0-1-1Z"/>',
    finance: '<path d="M5 7.5A2.5 2.5 0 0 1 7.5 5H19v14H7.5A2.5 2.5 0 0 1 5 16.5v-9Z"/><path d="M5 8h14m-4 4h6v4h-6a2 2 0 0 1 0-4Z"/>',
    sylon: '<path d="M7.2 8.1 12 5.5l4.8 2.6v5.8L12 16.5l-4.8-2.6V8.1Z"/><path d="M12 5.5v11m-4.8-8.4 4.8 2.7 4.8-2.7"/>'
  };
  const attributes = isRoot
    ? 'aria-current="location" tabindex="-1"'
    : `data-map-route="${node.route}"`;
  return `
    <button class="sylon-map-node sylon-map-node--${isRoot ? 'root' : node.tone}"
      type="button" data-map-node="${node.id}" data-node-index="${index}" data-metric-state="${metric?.state || 'calm'}" ${attributes}>
      <span class="sylon-map-node__object">
        <i class="sylon-map-node__glass" aria-hidden="true"></i>
        <b class="sylon-map-node__spark" aria-hidden="true"></b>
        <svg class="sylon-map-node__icon" viewBox="0 0 24 24" aria-hidden="true">${icons[node.id] || icons.sylon}</svg>
        <span class="sylon-map-node__copy">
          <small>${isRoot ? 'Центр системы' : `Узел 0${index}`}</small>
          <strong>${node.label}</strong>
          ${node.detail ? `<em>${node.detail}</em>` : ''}
        </span>
        <span class="sylon-map-node__metric" data-map-metric="${node.id}">${escapeHtml(metric?.value || '')}</span>
      </span>
    </button>`;
}

const satelliteGroups = [
  { owner: 'employees', labels: ['Сотрудники', 'Роли', 'Адаптация'] },
  { owner: 'schedule', labels: ['Сегодня', 'Нагрузка', 'Замены'] },
  { owner: 'tasks', labels: ['В работе', 'Срочные', 'Недавние'] },
  { owner: 'warehouse', labels: ['Остатки', 'Закупки', 'Движение'] },
  { owner: 'training', labels: ['База', 'Прогресс'] },
  { owner: 'finance', labels: ['Выплаты', 'Периоды'] }
];

const satelliteOffsets = {
  default: [{ x: -106, y: -78 }, { x: 58, y: -67 }, { x: 70, y: 45 }],
  training: [{ x: -104, y: -72 }, { x: -110, y: 48 }],
  finance: [{ x: 30, y: -82 }, { x: 46, y: 52 }]
};

function renderMapSatellites() {
  return satelliteGroups.map((group) => {
    const offsets = satelliteOffsets[group.owner] || satelliteOffsets.default;
    return `<div class="sylon-map-satellites sylon-map-satellites--${group.owner}" data-satellite-owner="${group.owner}" aria-label="Папки раздела">
      <svg class="sylon-satellite-threads" viewBox="-190 -130 380 260" preserveAspectRatio="none" aria-hidden="true">
        ${group.labels.map((_, index) => {
          const offset = offsets[index] || satelliteOffsets.default[index];
          const x = offset.x + 24;
          const y = offset.y + 24;
          const pathId = `satellite-thread-${group.owner}-${index}`;
          return `<path class="sylon-satellite-thread sylon-satellite-thread--halo" d="M0 0 C${(x * .28).toFixed(1)} ${(y * .1).toFixed(1)} ${(x * .68).toFixed(1)} ${(y * .9).toFixed(1)} ${x} ${y}"/><path id="${pathId}" class="sylon-satellite-thread" d="M0 0 C${(x * .28).toFixed(1)} ${(y * .1).toFixed(1)} ${(x * .68).toFixed(1)} ${(y * .9).toFixed(1)} ${x} ${y}"/><circle class="sylon-satellite-thread__pulse" r="2"><animateMotion dur="${8 + index * 1.7}s" begin="-${index * 2.4}s" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle>`;
        }).join('')}
      </svg>
      ${group.labels.map((label, index) => `<span class="sylon-satellite sylon-satellite--${group.owner}-${index}" role="button" tabindex="-1" data-satellite-label="${escapeHtml(label)}" data-satellite-child="${group.owner}-${index}" data-satellite-parent="${group.owner}" aria-label="Открыть папку ${escapeHtml(label)}"><i></i>${label}</span>`).join('')}
    </div>`;
  }).join('');
}

const depthBranchCatalog = {
  'employees-0': [
    { id: 'employees-active', title: 'Активные', subtitle: 'Команда в работе' },
    { id: 'employees-new', title: 'Новые', subtitle: 'Недавние сотрудники' }
  ],
  'employees-1': [
    { id: 'roles-admin', title: 'Управление', subtitle: 'Администраторы' },
    { id: 'roles-floor', title: 'Зал', subtitle: 'Команда смены' }
  ],
  'employees-2': [
    { id: 'onboarding-first', title: 'Первый день', subtitle: 'Стартовый маршрут' },
    { id: 'onboarding-mentor', title: 'Наставник', subtitle: 'Поддержка новичка' }
  ],
  'schedule-0': [
    { id: 'today-opening', title: 'Открытие', subtitle: 'Первая смена' },
    { id: 'today-evening', title: 'Вечер', subtitle: 'Основная загрузка' }
  ],
  'schedule-1': [
    { id: 'load-balance', title: 'Баланс', subtitle: 'Нагрузка команды' },
    { id: 'load-overtime', title: 'Переработки', subtitle: 'Точки внимания' }
  ],
  'schedule-2': [
    { id: 'replacements-free', title: 'Доступные', subtitle: 'Могут выйти' },
    { id: 'replacements-best', title: 'Кандидаты', subtitle: 'Подходящие замены' }
  ],
  'tasks-0': [
    { id: 'tasks-shift', title: 'В смене', subtitle: 'Текущие действия' },
    { id: 'tasks-review', title: 'На проверке', subtitle: 'Ожидают решения' }
  ],
  'tasks-1': [
    { id: 'urgent-today', title: 'Сегодня', subtitle: 'Сделать сейчас' },
    { id: 'urgent-overdue', title: 'Просрочено', subtitle: 'Требует внимания' }
  ],
  'tasks-2': [
    { id: 'recent-done', title: 'Завершённые', subtitle: 'Последние результаты' },
    { id: 'recent-archive', title: 'Архив', subtitle: 'История действий' }
  ],
  'warehouse-0': [
    { id: 'stock-tobacco', title: 'Табак', subtitle: 'Остатки по брендам' },
    { id: 'stock-supplies', title: 'Расходники', subtitle: 'Уголь и аксессуары' }
  ],
  'warehouse-1': [
    { id: 'purchase-ordered', title: 'Заказано', subtitle: 'Активные закупки' },
    { id: 'purchase-delivery', title: 'К поставке', subtitle: 'Ближайшие приходы' }
  ],
  'warehouse-2': [
    { id: 'movement-income', title: 'Приход', subtitle: 'Новые поставки' },
    { id: 'movement-writeoff', title: 'Списание', subtitle: 'Расход и потери' }
  ],
  'training-0': getAcademyChildren('base', getAcademyState()).slice(0, 4),
  'training-1': [
    { id: 'progress-team', title: 'Команда', subtitle: 'Общий прогресс' },
    { id: 'progress-topics', title: 'Темы', subtitle: 'Освоение базы' }
  ],
  'finance-0': [
    { id: 'payments-accrued', title: 'Начислено', subtitle: 'Расчёт за смены' },
    { id: 'payments-ready', title: 'К выплате', subtitle: 'Готовые суммы' }
  ],
  'finance-1': [
    { id: 'period-week', title: 'Неделя', subtitle: 'Текущий период' },
    { id: 'period-month', title: 'Месяц', subtitle: 'Сводный расчёт' }
  ]
};

const workspaceContextByLeaf = {
  'employees-active': { type: 'employees-directory', value: 'active' },
  'employees-new': { type: 'employees-directory', value: 'new' },
  'roles-admin': { type: 'employees-directory', value: 'roles' },
  'roles-floor': { type: 'employees-directory', value: 'roles' },
  'onboarding-first': { type: 'employees-onboarding', value: 'first-day' },
  'onboarding-mentor': { type: 'employees-onboarding', value: 'mentor' },
  'today-opening': { type: 'schedule-view', value: 'today' },
  'today-evening': { type: 'schedule-view', value: 'today' },
  'load-balance': { type: 'schedule-view', value: 'week' },
  'load-overtime': { type: 'schedule-view', value: 'week' },
  'replacements-free': { type: 'schedule-view', value: 'week' },
  'replacements-best': { type: 'schedule-view', value: 'week' },
  'stock-tobacco': { type: 'warehouse-category', value: 'tobacco' },
  'stock-supplies': { type: 'warehouse-category', value: 'supplies' },
  'movement-income': { type: 'warehouse-history', value: 'income' },
  'movement-writeoff': { type: 'warehouse-history', value: 'expense' },
  'tasks-shift': { type: 'tasks-lane', value: 'now' },
  'tasks-review': { type: 'tasks-lane', value: 'today' },
  'urgent-today': { type: 'tasks-lane', value: 'today' },
  'urgent-overdue': { type: 'tasks-lane', value: 'today' },
  'recent-done': { type: 'tasks-history', value: 'completed' },
  'recent-archive': { type: 'tasks-history', value: 'completed' },
  darkside: { type: 'academy-node', value: 'darkside' },
  science: { type: 'academy-node', value: 'science' }
  ,'payments-accrued': { type: 'finance-payments', value: 'accrued' }
  ,'payments-ready': { type: 'finance-payments', value: 'ready' }
  ,'period-week': { type: 'finance-period', value: 'week' }
  ,'period-month': { type: 'finance-period', value: 'month' }
};

function renderDepthGroups() {
  return Object.entries(depthBranchCatalog).map(([parentId, branches]) => `<div class="sylon-depth-children" data-depth-children data-depth-group="${parentId}" aria-label="Связанные ветви">
    <svg class="sylon-depth-threads" viewBox="-180 -120 360 240" preserveAspectRatio="none" aria-hidden="true">
      ${branches.map((branch, index) => {
        const x = index % 2 === 0 ? -112 : 94;
        const y = index < 2 ? -38 : 74;
        const pathId = `depth-thread-${branch.id}`;
        return `<path id="${pathId}" class="sylon-depth-thread" d="M0 0 C${(x * .32).toFixed(1)} ${(y * .08).toFixed(1)} ${(x * .7).toFixed(1)} ${(y * .88).toFixed(1)} ${x} ${y}"/><circle class="sylon-depth-thread__pulse" r="2.2"><animateMotion dur="${9 + index * 1.8}s" begin="-${index * 2.3}s" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle>`;
      }).join('')}
    </svg>
    ${branches.map((branch, index) => `<button class="sylon-depth-node sylon-depth-node--${index}" type="button" tabindex="-1" data-depth-node="${escapeHtml(branch.id)}" data-depth-parent="${parentId}" data-depth-title="${escapeHtml(branch.title)}" data-depth-subtitle="${escapeHtml(branch.subtitle)}"><i></i><strong>${escapeHtml(branch.title)}</strong><small>${escapeHtml(branch.subtitle)}</small></button>`).join('')}
  </div>`).join('');
}

export function renderSylonHomeScreen() {
  const activeEmployees = getEmployees().filter((employee) => employee.status === 'active').length;
  const visibleNodes = getVisibleMapNodes();
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = SYLON_MAP.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const systemBackbonePath = buildSystemBackbonePath(visibleNodes);
  const mapMetrics = getHomeMapMetrics();

  return `
    <section class="sylon-home sylon-home--map view is-active" data-sylon-home aria-labelledby="sylonHomeTitle">
      <div class="sylon-home__atmosphere" aria-hidden="true"></div>
      <header class="sylon-home__brand">
        <a href="#dashboard" data-sylon-home-link aria-label="SYLON — главная">
          <span class="sylon-home__brand-mark" aria-hidden="true"></span>
          <strong>SYLON</strong>
        </a>
        <p id="sylonHomeTitle">твоя система. твой порядок.</p>
      </header>
      <div class="sylon-home__clock" aria-label="Локальное время">
        <strong data-sylon-clock>--:--</strong><span data-sylon-date>Сегодня</span>
      </div>
      <div class="sylon-home__weather" aria-label="Город">
        <span aria-hidden="true">☁</span><strong>Калининград</strong><small>локальная система</small>
      </div>
      <button class="sylon-home__status" type="button" data-sylon-state-toggle
        aria-label="Демонстрационное состояние SYLON. Нажмите, чтобы переключить">
        <span></span><strong data-sylon-state-label>Система спокойна</strong><i>Демо</i>
      </button>
      ${renderContextualCard({ activeEmployees })}
      <aside class="sylon-home__quick" aria-label="Быстрый доступ">
        <button type="button" data-panel-route="training"><span>♧</span>Мои достижения</button>
        <button type="button" data-panel-route="knowledge"><span>☆</span>Избранное</button>
        <button type="button" data-panel-route="tasks"><span>◷</span>Недавние</button>
        <button type="button" data-panel-route="knowledge"><span>▣</span>Заметки</button>
      </aside>
      <aside class="sylon-home__progress" aria-label="Прогресс системы">
        <small>Прогресс пространства</small>
        <div class="sylon-home__progress-row"><strong>64%</strong><span>Активно<br><b>4 из 6 разделов</b></span></div>
        <i><b></b></i>
        <button type="button" data-panel-route="analytics">Смотреть статистику <span>→</span></button>
      </aside>
      <nav class="sylon-map-path" data-map-path aria-label="Путь по карте">
        <span>SYLON</span><i aria-hidden="true">/</i><strong data-map-path-current>Главная карта</strong>
      </nav>
      <div class="sylon-map-stage" data-map-stage>
        <div class="sylon-map-cursor-light" aria-hidden="true"></div>
        <div class="sylon-map-depth" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="sylon-map-layer" data-sylon-map aria-hidden="true"></div>
        <svg class="sylon-map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Связи между разделами">
          <defs>
            <linearGradient id="sylonSystemLine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#899b8b" stop-opacity=".18"/>
              <stop offset=".48" stop-color="#d1b671" stop-opacity=".58"/>
              <stop offset="1" stop-color="#9eaa96" stop-opacity=".2"/>
            </linearGradient>
          </defs>
          <g class="sylon-system-network" aria-hidden="true">
            <path class="sylon-system-network__backbone sylon-system-network__backbone--glow" d="${systemBackbonePath}"/>
            <path id="sylon-system-backbone" class="sylon-system-network__backbone" d="${systemBackbonePath}"/>
            <path id="sylon-system-orbit-a" class="sylon-system-network__orbit" d="M37 50 A13 7 0 1 0 63 50 A13 7 0 1 0 37 50"/>
            <path class="sylon-system-network__orbit sylon-system-network__orbit--cross" d="M43 38 A7 15 24 1 0 57 62 A7 15 24 1 0 43 38"/>
            ${visibleNodes.filter((node) => node.id !== SYLON_MAP.rootId).map((node) => {
              const angle = Math.atan2(node.position.y - 50, node.position.x - 50);
              const anchorX = 50 + Math.cos(angle) * 13;
              const anchorY = 50 + Math.sin(angle) * 7;
              return `<path class="sylon-system-network__hub-spoke" d="M50 50 L${anchorX.toFixed(2)} ${anchorY.toFixed(2)}"/><circle class="sylon-system-network__hub" cx="${anchorX.toFixed(2)}" cy="${anchorY.toFixed(2)}" r=".34"/>`;
            }).join('')}
            ${visibleNodes.filter((node) => node.id !== SYLON_MAP.rootId).map((node) => `<circle class="sylon-system-network__junction" cx="${node.position.x}" cy="${node.position.y}" r=".38"/>`).join('')}
            <circle class="sylon-system-network__pulse" r=".42"><animateMotion dur="18s" begin="-3s" repeatCount="indefinite"><mpath href="#sylon-system-backbone"/></animateMotion></circle>
            <circle class="sylon-system-network__pulse sylon-system-network__pulse--secondary" r=".3"><animateMotion dur="18s" begin="-12s" repeatCount="indefinite"><mpath href="#sylon-system-backbone"/></animateMotion></circle>
            <circle class="sylon-system-network__pulse sylon-system-network__pulse--orbit" r=".38"><animateMotion dur="9s" begin="-2s" repeatCount="indefinite"><mpath href="#sylon-system-orbit-a"/></animateMotion></circle>
          </g>
          ${visibleEdges.map(renderMapEdge).join('')}
        </svg>
        <div class="sylon-map-nodes" aria-label="Ближайшие узлы SYLON">
          ${visibleNodes.map((node, index) => renderMapNode(node, index, mapMetrics[node.id])).join('')}
          ${renderMapSatellites()}
          ${renderDepthGroups()}
        </div>
        <p class="visually-hidden" data-map-status aria-live="polite"></p>
      </div>
      <p class="sylon-map-hint">Выбери узел <span>·</span> Tab и стрелки работают с клавиатуры</p>
      <button class="sylon-map-back" type="button" data-map-back><span>←</span> Назад по карте</button>
      <aside class="sylon-home__inspector" aria-label="Обзор выбранного узла">
        <div class="sylon-home__inspector-head"><small data-inspector-kicker>ОБЗОР СИСТЕМЫ</small><span aria-hidden="true">×</span></div>
        <div class="sylon-home__inspector-visual" aria-hidden="true"><i></i><i></i><b></b></div>
        <h2 data-inspector-title>SYLON</h2>
        <p data-inspector-description>Карта объединяет команду, график, задачи и склад в одно живое пространство.</p>
        <div class="sylon-home__inspector-progress"><span><i data-inspector-progress-label>Готовность системы</i> <b data-inspector-progress>72%</b></span><i><b data-inspector-progress-bar></b></i></div>
        <h3>Связанные узлы</h3>
        <ul data-inspector-neighbors><li>Команда <b>●</b></li><li>График <b>●</b></li><li>Задачи <b>◐</b></li><li>Склад <b>●</b></li></ul>
        <button type="button" data-panel-route="analytics" data-inspector-action>Открыть пульс системы <span>→</span></button>
      </aside>
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
  const focusShell = home?.querySelector('[data-focus-shell]');
  const focusTitle = focusShell?.querySelector('[data-focus-title]');
  const cleanup = [
    initContextualCard(home, navigate),
    initAssistantInput(home, { navigate, showToast }),
    initFallbackNavigation(home, navigate)
  ];
  let mapCleanup = () => {};
  let mapIdleHandle = 0;
  const scheduleMapInit = typeof window.requestIdleCallback === 'function'
    ? (callback) => window.requestIdleCallback(callback, { timeout: 1200 })
    : (callback) => window.setTimeout(callback, 1);
  const cancelMapInit = typeof window.cancelIdleCallback === 'function'
    ? (handle) => window.cancelIdleCallback(handle)
    : (handle) => window.clearTimeout(handle);
  let disposed = false;
  let demoOverride = false;
  let navigationTimer = 0;
  let clockTimer = 0;
  let pointerFrame = 0;
  let expandedNodeId = null;
  let expandedChildId = null;
  let expandedLeafId = null;
  let depthPositionTimer = 0;
  const mapMetrics = getHomeMapMetrics();

  const setMapMetric = (nodeId, metric) => {
    mapMetrics[nodeId] = metric;
    const node = home?.querySelector(`[data-map-node="${nodeId}"]`);
    const label = home?.querySelector(`[data-map-metric="${nodeId}"]`);
    if (node) node.dataset.metricState = metric.state;
    if (label) label.textContent = metric.value;
  };

  const inspectorProfiles = {
    sylon: { kicker: 'ОБЗОР СИСТЕМЫ', description: 'Карта объединяет команду, график, задачи и склад в одно живое пространство.', progress: 72, progressLabel: 'Готовность системы', route: 'analytics', action: 'Открыть пульс системы' },
    employees: { kicker: 'ЛЮДИ И РОЛИ', description: 'Состав команды, роли сотрудников и связь людей с текущими сменами.', progress: 68, progressLabel: 'Профиль команды', route: 'employees', action: 'Открыть команду' },
    schedule: { kicker: 'РИТМ ЗАВЕДЕНИЯ', description: 'Смены, нагрузка и свободные окна собраны в единую временную линию.', progress: 81, progressLabel: 'Покрытие графика', route: 'schedule', action: 'Открыть график' },
    tasks: { kicker: 'ФОКУС И ДЕЙСТВИЯ', description: 'Текущие задачи связаны со сменами, ответственными и точками внимания.', progress: 57, progressLabel: 'Выполнено сегодня', route: 'tasks', action: 'Открыть задачи' },
    warehouse: { kicker: 'ЗАПАСЫ И ДВИЖЕНИЕ', description: 'Остатки, закупки и движения склада видны как связанные события.', progress: 74, progressLabel: 'Актуальность склада', route: 'warehouse', action: 'Открыть склад' }
    ,training: { kicker: 'ЗНАНИЯ И РАЗВИТИЕ', description: 'Учебные направления, база материалов и личный прогресс собраны в одну карту.', progress: 64, progressLabel: 'Пройдено обучения', route: 'training', action: 'Открыть обучение' }
    ,finance: { kicker: 'РАСЧЁТЫ И ВЫПЛАТЫ', description: 'Рабочие смены связываются с периодами, начислениями и выплатами команды.', progress: 86, progressLabel: 'Период рассчитан', route: 'salary', action: 'Открыть финансы' }
  };

  const updateInspector = (nodeId) => {
    const node = getMapNode(nodeId) || getMapNode(SYLON_MAP.rootId);
    const profile = inspectorProfiles[node.id] || inspectorProfiles.sylon;
    const metric = mapMetrics[node.id];
    const neighbors = node.id === SYLON_MAP.rootId
      ? getVisibleMapNodes().filter((item) => item.route)
      : getMapNeighbors(node.id).filter((item) => item.enabled !== false).slice(0, 4);
    const kicker = home?.querySelector('[data-inspector-kicker]');
    const title = home?.querySelector('[data-inspector-title]');
    const description = home?.querySelector('[data-inspector-description]');
    const progressLabel = home?.querySelector('[data-inspector-progress-label]');
    const progress = home?.querySelector('[data-inspector-progress]');
    const progressBar = home?.querySelector('[data-inspector-progress-bar]');
    const neighborList = home?.querySelector('[data-inspector-neighbors]');
    const action = home?.querySelector('[data-inspector-action]');
    if (kicker) kicker.textContent = profile.kicker;
    if (title) title.textContent = node.label;
    if (description) description.textContent = profile.description;
    const progressValue = metric?.percent ?? profile.progress;
    if (progressLabel) progressLabel.textContent = metric?.value ? `${profile.progressLabel} · ${metric.value}` : profile.progressLabel;
    if (progress) progress.textContent = `${progressValue}%`;
    if (progressBar) progressBar.style.width = `${progressValue}%`;
    if (neighborList) neighborList.innerHTML = neighbors.map((item, index) => `<li>${item.label}<b>${index === 2 ? '◐' : '●'}</b></li>`).join('');
    if (action) {
      action.dataset.panelRoute = profile.route;
      action.firstChild.textContent = `${profile.action} `;
    }
    home.dataset.inspectorNode = node.id;
  };

  const updateClock = () => {
    const now = new Date();
    const clock = home?.querySelector('[data-sylon-clock]');
    const date = home?.querySelector('[data-sylon-date]');
    if (clock) clock.textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (date) date.textContent = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  updateClock();
  clockTimer = window.setInterval(updateClock, 30000);

  readScheduleSnapshot().then((schedule) => {
    if (disposed) return;
    const days = schedule.weeks.flatMap((week) => week.days);
    const assignments = days.reduce((total, day) => total + day.masters.length + day.administrators.length, 0);
    const metric = days.length
      ? { value: `${assignments} смен`, percent: Math.min(100, Math.round(days.filter((day) => day.masters.length + day.administrators.length > 0).length / days.length * 100)), state: assignments ? 'calm' : 'attention' }
      : { value: 'Нет графика', percent: 0, state: 'empty' };
    setMapMetric('schedule', metric);
    if (home.dataset.focusedNode === 'schedule') updateInspector('schedule');
  }).catch(() => setMapMetric('schedule', { value: 'Нет графика', percent: 0, state: 'empty' }));

  const panelButtons = [...(home?.querySelectorAll('[data-panel-route]') || [])];
  const openWorkspace = (route) => {
    if (!route || disposed) return;
    const node = SYLON_MAP.nodes.find((item) => item.route === route) || getMapNode(expandedNodeId);
    const navigationContext = workspaceContextByLeaf[expandedLeafId];
    if (navigationContext) setNavigationContext(route, { ...navigationContext, source: 'sylon-map', path: pathCurrent?.textContent || '' });
    if (!focusShell || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate(route);
      return;
    }
    window.clearTimeout(navigationTimer);
    if (node?.id) {
      focusShell.dataset.focusNode = node.id;
      const selected = home.querySelector(`[data-map-node="${node.id}"]`);
      const bounds = selected?.getBoundingClientRect();
      if (bounds) {
        home.style.setProperty('--portal-x', `${((bounds.left + bounds.width / 2) / window.innerWidth * 100).toFixed(1)}%`);
        home.style.setProperty('--portal-y', `${((bounds.top + bounds.height / 2) / window.innerHeight * 100).toFixed(1)}%`);
      }
    }
    if (focusTitle) focusTitle.textContent = node?.label || 'Рабочее пространство';
    focusShell.setAttribute('aria-hidden', 'false');
    focusShell.classList.add('is-preparing');
    home.classList.add('is-opening');
    window.requestAnimationFrame(() => focusShell.classList.add('is-active'));
    navigationTimer = window.setTimeout(() => navigate(route), 780);
  };
  const onPanelRoute = (event) => openWorkspace(event.currentTarget.dataset.panelRoute);
  panelButtons.forEach((button) => button.addEventListener('click', onPanelRoute));

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
    updateInspector(node.id);
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

  mapIdleHandle = scheduleMapInit(() => {
    if (disposed) return;
    initSylonMap(mapContainer).then((disposeMap) => {
      if (disposed) disposeMap();
      else mapCleanup = disposeMap;
    });
  });

  const collapseNode = () => {
    window.clearTimeout(depthPositionTimer);
    expandedLeafId = null;
    expandedChildId = null;
    expandedNodeId = null;
    home.classList.remove('is-node-expanded', 'is-child-expanded', 'is-leaf-expanded', 'has-depth-children');
    delete home.dataset.expandedNode;
    delete home.dataset.expandedChild;
    delete home.dataset.expandedLeaf;
    nodes.forEach((item) => item.classList.remove('is-selected'));
    home.querySelectorAll('[data-satellite-owner]').forEach((group) => group.classList.remove('is-expanded'));
    home.querySelectorAll('[data-satellite-child]').forEach((child) => { child.classList.remove('is-selected'); child.tabIndex = -1; });
    home.querySelectorAll('[data-depth-node]').forEach((leaf) => { leaf.classList.remove('is-selected'); leaf.tabIndex = -1; });
    home.querySelectorAll('[data-depth-children]').forEach((group) => group.classList.remove('is-visible'));
    setMapFocus(SYLON_MAP.rootId, { announce: true });
  };

  const collapseLeaf = () => {
    if (!expandedLeafId) return false;
    expandedLeafId = null;
    home.classList.remove('is-leaf-expanded');
    delete home.dataset.expandedLeaf;
    home.querySelectorAll('[data-depth-node]').forEach((leaf) => leaf.classList.remove('is-selected'));
    const satellite = home.querySelector(`[data-satellite-child="${expandedChildId}"]`);
    if (satellite) openSatellite(satellite);
    return true;
  };

  const collapseChild = () => {
    if (!expandedChildId) return false;
    window.clearTimeout(depthPositionTimer);
    collapseLeaf();
    expandedChildId = null;
    home.classList.remove('is-child-expanded', 'has-depth-children');
    delete home.dataset.expandedChild;
    home.querySelectorAll('[data-satellite-child]').forEach((child) => child.classList.remove('is-selected'));
    home.querySelectorAll('[data-depth-children]').forEach((group) => group.classList.remove('is-visible'));
    home.querySelectorAll('[data-depth-node]').forEach((leaf) => { leaf.tabIndex = -1; });
    setMapFocus(expandedNodeId || SYLON_MAP.rootId, { announce: true });
    return true;
  };

  const stepBack = () => {
    if (collapseLeaf()) return;
    if (!collapseChild()) collapseNode();
  };

  const openSatellite = (satellite) => {
    if (!expandedNodeId || satellite.dataset.satelliteParent !== expandedNodeId) return;
    expandedChildId = satellite.dataset.satelliteChild;
    expandedLeafId = null;
    home.dataset.expandedChild = expandedChildId;
    delete home.dataset.expandedLeaf;
    home.classList.remove('is-leaf-expanded');
    home.classList.add('is-child-expanded');
    home.querySelectorAll('[data-satellite-child]').forEach((child) => child.classList.toggle('is-selected', child === satellite));
    const parent = getMapNode(expandedNodeId);
    const label = satellite.dataset.satelliteLabel;
    if (pathCurrent) pathCurrent.textContent = `${parent?.label || 'Раздел'} / ${label}`;
    const kicker = home.querySelector('[data-inspector-kicker]');
    const title = home.querySelector('[data-inspector-title]');
    const description = home.querySelector('[data-inspector-description]');
    const neighborList = home.querySelector('[data-inspector-neighbors]');
    const action = home.querySelector('[data-inspector-action]');
    if (kicker) kicker.textContent = 'СВЯЗАННАЯ ПАПКА';
    if (title) title.textContent = label;
    if (description) description.textContent = `Папка внутри раздела «${parent?.label || 'SYLON'}». Следующий уровень откроется здесь же, внутри живой карты.`;
    if (neighborList) neighborList.innerHTML = `<li>${parent?.label || 'SYLON'} <b>●</b></li><li>Общая система <b>◐</b></li>`;
    if (action && parent?.route) {
      action.dataset.panelRoute = parent.route;
      action.firstChild.textContent = `Открыть раздел «${parent.label}» `;
    }
    const depthChildren = home.querySelector(`[data-depth-group="${expandedChildId}"]`);
    const hasDepth = Boolean(depthChildren);
    home.classList.toggle('has-depth-children', Boolean(hasDepth));
    home.querySelectorAll('[data-depth-children]').forEach((group) => group.classList.remove('is-visible'));
    home.querySelectorAll('[data-depth-node]').forEach((leaf) => { leaf.tabIndex = leaf.dataset.depthParent === expandedChildId ? 0 : -1; leaf.classList.remove('is-selected'); });
    if (hasDepth && mapStage) {
      window.clearTimeout(depthPositionTimer);
      const expectedChildId = expandedChildId;
      depthPositionTimer = window.setTimeout(() => {
        if (expandedChildId !== expectedChildId) return;
        const stageBounds = mapStage.getBoundingClientRect();
        const satelliteBounds = satellite.getBoundingClientRect();
        depthChildren.style.setProperty('--depth-x', `${(satelliteBounds.left + satelliteBounds.width / 2 - stageBounds.left).toFixed(1)}px`);
        depthChildren.style.setProperty('--depth-y', `${(satelliteBounds.top + satelliteBounds.height / 2 - stageBounds.top).toFixed(1)}px`);
        depthChildren.classList.add('is-visible');
      }, 620);
    }
    satellite.focus({ preventScroll: true });
  };

  const openDepthNode = (leaf) => {
    if (!expandedChildId || leaf.dataset.depthParent !== expandedChildId) return;
    expandedLeafId = leaf.dataset.depthNode;
    home.dataset.expandedLeaf = expandedLeafId;
    home.classList.add('is-leaf-expanded');
    home.querySelectorAll('[data-depth-node]').forEach((item) => item.classList.toggle('is-selected', item === leaf));
    const parentNode = getMapNode(expandedNodeId);
    const satellite = home.querySelector(`[data-satellite-child="${expandedChildId}"]`);
    if (pathCurrent) pathCurrent.textContent = `${parentNode?.label || 'Раздел'} / ${satellite?.dataset.satelliteLabel || 'Папка'} / ${leaf.dataset.depthTitle}`;
    const kicker = home.querySelector('[data-inspector-kicker]');
    const title = home.querySelector('[data-inspector-title]');
    const description = home.querySelector('[data-inspector-description]');
    const neighborList = home.querySelector('[data-inspector-neighbors]');
    const action = home.querySelector('[data-inspector-action]');
    if (kicker) kicker.textContent = 'ВЕТВЬ ЗНАНИЙ';
    if (title) title.textContent = leaf.dataset.depthTitle;
    if (description) description.textContent = leaf.dataset.depthSubtitle;
    if (neighborList) neighborList.innerHTML = `<li>${satellite?.dataset.satelliteLabel || 'База'} <b>●</b></li><li>${parentNode?.label || 'Обучение'} <b>●</b></li>`;
    if (action && parentNode?.route) {
      action.dataset.panelRoute = parentNode.route;
      action.firstChild.textContent = `Перейти в «${parentNode.label}» `;
    }
    leaf.focus({ preventScroll: true });
  };

  const expandNode = (route) => {
    const selectedNode = home.querySelector(`[data-map-route="${route}"]`);
    const node = getMapNode(selectedNode?.dataset.mapNode);
    if (!selectedNode || !node) return;
    collapseChild();
    expandedNodeId = node.id;
    setMapFocus(node.id, { announce: true });
    nodes.forEach((item) => item.classList.toggle('is-selected', item === selectedNode));
    home.querySelectorAll('[data-satellite-owner]').forEach((group) => {
      const active = group.dataset.satelliteOwner === node.id;
      group.classList.toggle('is-expanded', active);
      group.querySelectorAll('[data-satellite-child]').forEach((child) => { child.tabIndex = active ? 0 : -1; });
    });
    home.dataset.expandedNode = node.id;
    home.classList.add('is-node-expanded');
    selectedNode.focus({ preventScroll: true });
  };

  const onNodeClick = (event) => expandNode(event.currentTarget.dataset.mapRoute);
  const onNodeEnter = (event) => {
    const nodeId = event.currentTarget.dataset.mapNode;
    home.dataset.hoveredNode = nodeId;
    home.querySelectorAll('[data-map-edge]').forEach((edge) => {
      edge.classList.toggle('is-related', [edge.dataset.source, edge.dataset.target].includes(nodeId));
    });
    const adjacentIds = new Set(getMapNeighbors(nodeId).map((node) => node.id));
    nodes.forEach((node) => node.classList.toggle('is-adjacent', adjacentIds.has(node.dataset.mapNode)));
    updateInspector(nodeId);
    mapContainer?.dispatchEvent(new CustomEvent('sylon:map-hover', { detail: { nodeId } }));
  };
  const onNodeLeave = () => {
    delete home.dataset.hoveredNode;
    home.querySelectorAll('[data-map-edge]').forEach((edge) => edge.classList.remove('is-related'));
    nodes.forEach((node) => node.classList.remove('is-adjacent'));
    updateInspector(home.dataset.focusedNode || SYLON_MAP.rootId);
    mapContainer?.dispatchEvent(new CustomEvent('sylon:map-hover', { detail: { nodeId: null } }));
  };

  const onMapPointerMove = (event) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    pointerFrame = window.requestAnimationFrame(() => {
      const x = (event.clientX / window.innerWidth - 0.5) * 12;
      const y = (event.clientY / window.innerHeight - 0.5) * 9;
      home.style.setProperty('--map-shift-x', `${x.toFixed(2)}px`);
      home.style.setProperty('--map-shift-y', `${y.toFixed(2)}px`);
      home.style.setProperty('--map-back-x', `${(-x * 0.55).toFixed(2)}px`);
      home.style.setProperty('--map-back-y', `${(-y * 0.55).toFixed(2)}px`);
      home.style.setProperty('--map-front-x', `${(x * 0.34).toFixed(2)}px`);
      home.style.setProperty('--map-front-y', `${(y * 0.34).toFixed(2)}px`);
      home.style.setProperty('--map-light-x', `${((event.clientX / window.innerWidth) * 100).toFixed(1)}%`);
      home.style.setProperty('--map-light-y', `${((event.clientY / window.innerHeight) * 100).toFixed(1)}%`);
    });
  };
  mapStage?.addEventListener('pointermove', onMapPointerMove, { passive: true });
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
  const onHomeKeyDown = (event) => {
    if (event.key === 'Escape' && expandedNodeId) {
      event.preventDefault();
      stepBack();
    }
  };

  const onSatelliteClick = (event) => {
    const satellite = event.target.closest('[data-satellite-child]');
    if (!satellite) return;
    event.stopPropagation();
    openSatellite(satellite);
  };
  const onSatelliteKeyDown = (event) => {
    if (!event.target.closest('[data-satellite-child]') || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openSatellite(event.target.closest('[data-satellite-child]'));
  };
  const onDepthClick = (event) => {
    const leaf = event.target.closest('[data-depth-node]');
    if (!leaf) return;
    event.stopPropagation();
    openDepthNode(leaf);
  };

  const backButton = home.querySelector('[data-map-back]');
  backButton?.addEventListener('click', stepBack);
  home.addEventListener('keydown', onHomeKeyDown);
  home.addEventListener('click', onSatelliteClick);
  home.addEventListener('click', onDepthClick);
  home.addEventListener('keydown', onSatelliteKeyDown);

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
    window.clearTimeout(depthPositionTimer);
    window.clearInterval(clockTimer);
    window.cancelAnimationFrame(pointerFrame);
    cancelMapInit(mapIdleHandle);
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
    panelButtons.forEach((button) => button.removeEventListener('click', onPanelRoute));
    backButton?.removeEventListener('click', stepBack);
    home.removeEventListener('keydown', onHomeKeyDown);
    home.removeEventListener('click', onSatelliteClick);
    home.removeEventListener('click', onDepthClick);
    home.removeEventListener('keydown', onSatelliteKeyDown);
    mapStage?.removeEventListener('pointermove', onMapPointerMove);
  };
}
