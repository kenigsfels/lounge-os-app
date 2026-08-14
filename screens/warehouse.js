import { createWarehouseItem, deleteWarehouseItem, getStockState, getWarehouseItems, getWarehouseMovements, getWarehouseOverview, recordStockMovement, reconcileWarehouseItem, updateWarehouseItem, WAREHOUSE_CATEGORIES } from '../core/warehouse.js';
import { takeNavigationContext } from '../core/navigation-context.js';

const escapeHtml = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stateLabel = { ok: 'В норме', low: 'Заканчивается', empty: 'Нет в наличии' };
const formatNumber = (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

function renderItem(item) {
  const state = getStockState(item);
  return `<button class="stock-item stock-item--${state}" type="button" data-stock-item="${item.id}"><span class="stock-item__signal"></span><span><small>${stateLabel[state]}</small><strong>${escapeHtml(item.name)}</strong><p>${formatNumber(item.quantity)} ${escapeHtml(item.unit)} <i>минимум ${formatNumber(item.minimum)}</i></p></span><b>↗</b></button>`;
}

function renderCategories(items) {
  return WAREHOUSE_CATEGORIES.map((category) => {
    const categoryItems = items.filter((item) => item.category === category.id);
    return `<section class="stock-category" data-stock-category="${category.id}"><header><div><small>Категория</small><h2>${category.label}</h2></div><span>${categoryItems.length}</span></header><div>${categoryItems.length ? categoryItems.map(renderItem).join('') : '<p class="stock-category__empty">Пока нет позиций</p>'}</div></section>`;
  }).join('');
}

function renderHistory(movements) {
  return movements.slice(0, 12).map((movement) => `<article><span class="stock-history__type stock-history__type--${movement.type}">${movement.type === 'income' ? '+' : '−'}${formatNumber(movement.amount)}</span><div><strong>${escapeHtml(movement.itemName)}</strong><small>${escapeHtml(movement.comment || (movement.type === 'income' ? 'Приход' : 'Расход'))}</small></div><time>${new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(movement.createdAt))}</time></article>`).join('') || '<p class="stock-history__empty">Движений пока нет.</p>';
}

function renderContent() {
  const items = getWarehouseItems();
  const overview = getWarehouseOverview(items);
  const focus = overview.attention[0];
  return `<section class="stock-focus glass-panel"><header><p class="overline">Состояние запасов</p><span>${overview.attention.length ? `${overview.attention.length} требуют внимания` : 'Всё в норме'}</span></header>${focus ? `<button type="button" data-stock-item="${focus.id}"><i></i><span><small>${stateLabel[focus.stockState]}</small><strong>${escapeHtml(focus.name)}</strong><p>Осталось ${formatNumber(focus.quantity)} ${escapeHtml(focus.unit)}</p></span><b>Открыть ↗</b></button>` : `<div class="stock-focus__calm"><i></i><div><strong>${items.length ? 'Запасы в рабочем диапазоне' : 'Склад готов к наполнению'}</strong><p>${items.length ? 'Критических позиций сейчас нет.' : 'Добавь первую позицию, чтобы SYLON начал следить за остатками.'}</p></div></div>`}</section><div class="stock-categories">${renderCategories(items)}</div><details class="stock-history glass-panel"><summary><span><small>Последние изменения</small><strong>История движений</strong></span><b>${getWarehouseMovements().length}</b></summary><div>${renderHistory(getWarehouseMovements())}</div></details>`;
}

function itemForm(item) {
  return `<form class="stock-form" data-stock-form><input type="hidden" name="id" value="${item?.id || ''}"><p class="overline">Карточка позиции</p><h2>${item ? 'Редактирование' : 'Новая позиция'}</h2><label class="field"><span>Название *</span><input name="name" required value="${escapeHtml(item?.name || '')}"></label><label class="field"><span>Категория</span><select name="category">${WAREHOUSE_CATEGORIES.map((category)=>`<option value="${category.id}" ${item?.category===category.id?'selected':''}>${category.label}</option>`).join('')}</select></label><div class="stock-form__pair"><label class="field"><span>Остаток</span><input name="quantity" type="number" min="0" step="0.01" value="${item?.quantity ?? 0}"></label><label class="field"><span>Минимум</span><input name="minimum" type="number" min="0" step="0.01" value="${item?.minimum ?? 0}"></label></div><label class="field"><span>Единица</span><input name="unit" value="${escapeHtml(item?.unit || 'шт.')}"></label><label class="field"><span>Заметка</span><textarea name="notes" rows="3">${escapeHtml(item?.notes || '')}</textarea></label><p class="form-error" data-stock-error></p><div class="stock-form__actions">${item?'<button class="stock-delete" type="button" data-stock-delete>Удалить</button><span></span>':''}<button class="primary-button" type="submit">Сохранить</button></div></form>`;
}

function itemProfile(item) {
  const state=getStockState(item);
  return `<div class="stock-profile"><div class="stock-profile__hero stock-profile__hero--${state}"><span></span><small>${stateLabel[state]}</small><h2>${escapeHtml(item.name)}</h2><strong>${formatNumber(item.quantity)} ${escapeHtml(item.unit)}</strong><p>Минимальный запас: ${formatNumber(item.minimum)} ${escapeHtml(item.unit)}</p></div><form data-stock-movement><div class="stock-movement-type"><label><input type="radio" name="type" value="income" checked><span>Приход</span></label><label><input type="radio" name="type" value="expense"><span>Расход</span></label></div><label class="field"><span>Количество</span><input name="amount" type="number" min="0.01" step="0.01" required></label><label class="field"><span>Комментарий</span><input name="comment" placeholder="Например, закупка или списание"></label><button class="primary-button" type="submit">Записать движение</button></form><div class="stock-profile__actions"><button class="secondary-button" type="button" data-stock-reconcile>Инвентаризация</button><button class="secondary-button" type="button" data-stock-edit>Изменить позицию</button></div></div>`;
}

export function renderWarehouseScreen(){return `<section class="view warehouse-space is-active" aria-labelledby="warehouseTitle"><header class="warehouse-header glass-panel"><div><p class="overline">Живые запасы</p><h1 id="warehouseTitle">Склад</h1><p>Остатки, движения и спокойный контроль.</p></div><button class="primary-button" type="button" data-stock-add>＋ Добавить позицию</button></header><div data-stock-content>${renderContent()}</div><dialog class="stock-drawer" data-stock-drawer><button type="button" class="stock-drawer__close" data-stock-close>×</button><div data-stock-drawer-content></div></dialog></section>`}

export function initWarehouseScreen(root,{showToast=()=>{}}={}){
  const screen=root.querySelector('.warehouse-space'),content=root.querySelector('[data-stock-content]'),drawer=root.querySelector('[data-stock-drawer]'),drawerContent=root.querySelector('[data-stock-drawer-content]'); let selectedId=''; if(!screen||!content||!drawer)return()=>{};
  const mapContext=takeNavigationContext('warehouse');
  const refresh=()=>{content.innerHTML=renderContent()}; const selected=()=>getWarehouseItems().find((item)=>item.id===selectedId);
  const open=(html)=>{drawerContent.innerHTML=html;if(!drawer.open)drawer.showModal()};
  const onClick=(event)=>{if(event.target.closest('[data-stock-add]'))return open(itemForm());const itemButton=event.target.closest('[data-stock-item]');if(itemButton){selectedId=itemButton.dataset.stockItem;return open(itemProfile(selected()))}if(event.target.closest('[data-stock-close]')||event.target===drawer)return drawer.close();if(event.target.closest('[data-stock-edit]'))return open(itemForm(selected()));if(event.target.closest('[data-stock-delete]')){const item=selected();if(item&&globalThis.confirm(`Удалить позицию «${item.name}»?`)&&deleteWarehouseItem(item.id)){drawer.close();refresh();showToast('Позиция удалена')}return}if(event.target.closest('[data-stock-reconcile]')){const item=selected();const value=globalThis.prompt(`Фактический остаток (${item.unit})`,String(item.quantity));if(value===null)return;const result=reconcileWarehouseItem(item.id,value);if(result.success){open(itemProfile(result.item));refresh();showToast(result.movement?'Инвентаризация сохранена':'Остаток совпадает')}else showToast(result.errors.join('. '))}};
  const onSubmit=(event)=>{event.preventDefault();if(event.target.matches('[data-stock-form]')){const data=Object.fromEntries(new FormData(event.target));const result=data.id?updateWarehouseItem(data.id,data):createWarehouseItem(data);if(!result.success){event.target.querySelector('[data-stock-error]').textContent=result.errors.join('. ');return}selectedId=result.item.id;open(itemProfile(result.item));refresh();showToast(data.id?'Позиция обновлена':'Позиция добавлена')}if(event.target.matches('[data-stock-movement]')){const result=recordStockMovement(selectedId,Object.fromEntries(new FormData(event.target)));if(result.success){open(itemProfile(result.item));refresh();showToast('Движение сохранено')}else showToast(result.errors.join('. '))}};
  screen.addEventListener('click',onClick);drawer.addEventListener('submit',onSubmit);
  if(mapContext?.type==='warehouse-category')requestAnimationFrame(()=>{const target=content.querySelector(`[data-stock-category="${mapContext.value}"]`);target?.classList.add('is-map-arrival');target?.scrollIntoView({behavior:'smooth',block:'center'})});
  if(mapContext?.type==='warehouse-history')requestAnimationFrame(()=>{const target=content.querySelector('.stock-history');if(target){target.open=true;target.classList.add('is-map-arrival');target.scrollIntoView({behavior:'smooth',block:'center'})}});
  return()=>{if(drawer.open)drawer.close();screen.removeEventListener('click',onClick);drawer.removeEventListener('submit',onSubmit)};
}
