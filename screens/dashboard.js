export function renderDashboardScreen() {
  return `
    <section class="view is-active" aria-labelledby="dashboardTitle">
      <div class="welcome-panel glass-panel">
        <div>
          <p class="overline">Lounge OS · Dashboard</p>
          <h1 id="dashboardTitle">Добро пожаловать</h1>
          <p>Всё необходимое для управления кальянной — в одном пространстве.</p>
        </div>
        <div class="welcome-panel__summary"><span>Смен сегодня</span><strong>0</strong></div>
      </div>
      <div class="widget-grid">
        <article class="widget glass-panel widget--team">
          <header class="widget__header"><div><span class="widget__icon icon-blue">●</span><h2>Сегодня работают</h2></div><span class="counter">0</span></header>
          <ul class="team-list">
            <li><span>Основной</span><strong>Не назначен</strong></li><li><span>Саппорт</span><strong>Не назначен</strong></li><li><span>Сап-сап</span><strong>Не назначен</strong></li><li><span>Администратор</span><strong>Не назначен</strong></li>
          </ul>
        </article>
        <article class="widget glass-panel">
          <header class="widget__header"><div><span class="widget__icon icon-violet">⌁</span><h2>Ближайшие смены</h2></div><button class="text-button" type="button" data-action>Открыть</button></header>
          <div class="empty-state"><span>○</span><strong>Смен пока нет</strong><p>Добавьте первую смену в график</p></div>
        </article>
        <article class="widget glass-panel">
          <header class="widget__header"><div><span class="widget__icon icon-amber">!</span><h2>Требует внимания</h2></div><span class="counter">0</span></header>
          <div class="attention-row"><span class="checkmark">✓</span><div><strong>Всё в порядке</strong><p>Новых задач и уведомлений нет</p></div></div>
        </article>
        <article class="widget glass-panel widget--actions">
          <header class="widget__header"><div><span class="widget__icon icon-green">＋</span><h2>Быстрые действия</h2></div></header>
          <div class="action-grid"><button type="button" data-action><span>＋</span>Добавить смену</button><button type="button" data-action><span>♙</span>Сотрудник</button><button type="button" data-action><span>□</span>Инвентаризация</button><button type="button" data-action><span>✓</span>Новая задача</button></div>
        </article>
      </div>
    </section>`;
}
