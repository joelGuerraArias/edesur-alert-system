// ====== Analytics Dashboard ======

const ANALYTICS_CHANNEL_META = [
  { id: 'color', name: 'Color Visión', color: '#f97316' },
  { id: 'telesistema', name: 'Telesistema', color: '#3b82f6' },
  { id: 'teleantillas', name: 'Teleantillas', color: '#22c55e' },
  { id: 'cdn', name: 'CDN', color: '#a855f7' },
  { id: 'rnn', name: 'RNN', color: '#ef4444' },
  { id: 'telecentro', name: 'Telecentro', color: '#06b6d4' },
  { id: 'antena', name: 'Antena', color: '#eab308' },
  { id: 'ritmo', name: 'Ritmo', color: '#ec4899' },
  { id: 'superq', name: 'Super Q', color: '#8b5cf6' },
  { id: 'rumba', name: 'Rumba', color: '#14b8a6' }
];

let analyticsActive = false;

function getAnalyticsClientMode() {
  if (typeof FIXED_CLIENT_MODE !== 'undefined' && FIXED_CLIENT_MODE) {
    return FIXED_CLIENT_MODE;
  }
  if (typeof currentClientMode !== 'undefined' && currentClientMode) {
    return currentClientMode;
  }
  return 'edesur';
}

function cardMatchesClientScope(card) {
  return cardMatchesAnyClientTerm(card, getAnalyticsClientMode());
}

function getClientTermsLabel(mode) {
  const terms = getClientTermEntries(mode);
  return terms.map(t => t.label).join(', ');
}

function cardMatchesTerm(card, term) {
  return getCardSearchText(card).includes(String(term).toLowerCase());
}

function computeTermStats(cards, mode) {
  return getClientTermEntries(mode)
    .map(entry => ({
      ...entry,
      count: cards.filter(card => cardMatchesTerm(card, entry.filter)).length
    }))
    .sort((a, b) => b.count - a.count);
}

function renderTermsSection(mode, termStats, total) {
  const max = Math.max(...termStats.map(t => t.count), 1);
  const clientLabel = (typeof CLIENT_MODE_LABELS !== 'undefined' && CLIENT_MODE_LABELS[mode])
    ? CLIENT_MODE_LABELS[mode]
    : mode.toUpperCase();

  return `
    <section class="analytics-panel analytics-panel--wide analytics-panel--terms">
      <h3 class="analytics-panel__title">Términos monitoreados · ${clientLabel}</h3>
      <p class="analytics-terms-desc">${termStats.length} términos activos para este cliente</p>
      <div class="analytics-terms-grid">
        ${termStats.map(t => `
          <article class="analytics-term-card">
            <div class="analytics-term-card__head">
              <span class="analytics-term-card__label">${escapeHtml(t.label)}</span>
              <strong class="analytics-term-card__count">${t.count}</strong>
            </div>
            <div class="analytics-term-card__track">
              <div class="analytics-term-card__fill" style="width:${total ? Math.max(6, (t.count / max) * 100) : 0}%"></div>
            </div>
            <span class="analytics-term-card__meta">${total ? pct(t.count, total) : 0}% · ${t.count} contenido${t.count === 1 ? '' : 's'}</span>
          </article>`).join('')}
      </div>
      <div class="analytics-terms-chips" aria-label="Lista de términos">
        ${termStats.map(t => `
          <span class="analytics-term-chip">
            ${escapeHtml(t.label)}
            <em>${t.count}</em>
          </span>`).join('')}
      </div>
    </section>`;
}

function getAnalyticsCards() {
  if (typeof allCards === 'undefined') return [];
  return allCards.filter(cardMatchesClientScope);
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function getProgramLabel(card) {
  const archivo = card.dataset.nombrearchivo || '';
  const medio = card.dataset.nombremedio || '';
  if (archivo && typeof extractProgramName === 'function') {
    return formatMediaName(extractProgramName(archivo));
  }
  if (medio) return formatMediaName(medio);
  return 'Sin programa';
}

function buildTimeline(cards) {
  const days = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      count: 0
    });
  }

  const dayMap = Object.fromEntries(days.map(d => [d.key, d]));

  cards.forEach(card => {
    const dateStr = card.dataset.date;
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0, 10);
    if (dayMap[key]) dayMap[key].count += 1;
  });

  return days;
}

function computeAnalytics(cards) {
  const stats = {
    total: cards.length,
    positive: 0,
    negative: 0,
    neutral: 0,
    video: 0,
    audio: 0,
    ratingTotal: 0,
    channels: {},
    programs: {},
    medios: {},
    sentimentByChannel: {}
  };

  ANALYTICS_CHANNEL_META.forEach(ch => {
    stats.channels[ch.id] = { ...ch, count: 0, rating: 0, positive: 0, negative: 0, neutral: 0 };
    stats.sentimentByChannel[ch.id] = { positive: 0, negative: 0, neutral: 0 };
  });

  cards.forEach(card => {
    const sentiment = card.dataset.sentiment || 'neutral';
    if (sentiment === 'positive') stats.positive += 1;
    else if (sentiment === 'negative') stats.negative += 1;
    else stats.neutral += 1;

    if (card.dataset.mediatype === 'video') stats.video += 1;
    else if (card.dataset.mediatype === 'audio') stats.audio += 1;

    const rating = parseInt(card.dataset.rating, 10) || 0;
    stats.ratingTotal += rating;

    const channel = card.dataset.channel;
    if (channel && stats.channels[channel]) {
      stats.channels[channel].count += 1;
      stats.channels[channel].rating += rating;
      stats.channels[channel][sentiment] += 1;
      stats.sentimentByChannel[channel][sentiment] += 1;
    }

    const program = getProgramLabel(card);
    stats.programs[program] = (stats.programs[program] || 0) + 1;

    const medio = card.dataset.nombremedio || 'sin medio';
    const medioKey = medio.toLowerCase();
    stats.medios[medioKey] = (stats.medios[medioKey] || 0) + 1;
  });

  const channelRanking = Object.values(stats.channels)
    .filter(ch => ch.count > 0)
    .sort((a, b) => b.rating - a.rating);

  const topPrograms = Object.entries(stats.programs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const topMedios = Object.entries(stats.medios)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const timeline = buildTimeline(cards);
  const maxTimeline = Math.max(...timeline.map(d => d.count), 1);
  const maxChannelRating = Math.max(...channelRanking.map(ch => ch.rating), 1);

  return {
    ...stats,
    channelRanking,
    topPrograms,
    topMedios,
    timeline,
    maxTimeline,
    maxChannelRating,
    positivePct: pct(stats.positive, stats.total),
    negativePct: pct(stats.negative, stats.total),
    neutralPct: pct(stats.neutral, stats.total),
    videoPct: pct(stats.video, stats.total),
    audioPct: pct(stats.audio, stats.total)
  };
}

function renderKpiCard(label, value, sub, accentClass) {
  return `
    <article class="analytics-kpi ${accentClass}">
      <span class="analytics-kpi__label">${label}</span>
      <strong class="analytics-kpi__value">${value}</strong>
      <span class="analytics-kpi__sub">${sub}</span>
    </article>`;
}

function renderBarRow(label, value, max, color, suffix = '') {
  const width = max ? Math.max(8, (value / max) * 100) : 0;
  return `
    <div class="analytics-bar-row">
      <div class="analytics-bar-row__head">
        <span>${label}</span>
        <strong>${typeof formatNumber === 'function' ? formatNumber(value) : value}${suffix}</strong>
      </div>
      <div class="analytics-bar-track">
        <div class="analytics-bar-fill" style="width:${width}%;background:${color}"></div>
      </div>
    </div>`;
}

function renderAnalyticsDashboard() {
  const container = document.getElementById('analyticsDashboard');
  if (!container) return;

  const cards = getAnalyticsCards();
  const mode = getAnalyticsClientMode();
  const clientLabel = (typeof CLIENT_MODE_LABELS !== 'undefined' && CLIENT_MODE_LABELS[mode])
    ? CLIENT_MODE_LABELS[mode]
    : mode.toUpperCase();
  const scopedCards = typeof allCards !== 'undefined'
    ? allCards.filter(card => cardMatchesAnyClientTerm(card, mode))
    : [];
  const termStats = computeTermStats(scopedCards, mode);

  if (!cards.length) {
    container.innerHTML = `
      <header class="analytics-header">
        <div>
          <p class="analytics-eyebrow">Panel analítico · ${clientLabel}</p>
          <h2 class="analytics-title">Inteligencia de medios en tiempo real</h2>
          <p class="analytics-subtitle">Esperando contenidos con los términos del cliente</p>
        </div>
        <div class="analytics-live-badge"><span class="analytics-live-dot"></span>En vivo</div>
      </header>
      ${renderTermsSection(mode, termStats, 0)}
      <div class="analytics-empty">
        <div class="analytics-empty__icon">📊</div>
        <h3>Sin datos para analíticas</h3>
        <p>Cuando se carguen contenidos de ${clientLabel}, verás métricas en tiempo real aquí.</p>
      </div>`;
    return;
  }

  const s = computeAnalytics(cards);
  const donutGradient = `conic-gradient(
    #22c55e 0 ${s.positivePct}%,
    #ef4444 ${s.positivePct}% ${s.positivePct + s.negativePct}%,
    #64748b ${s.positivePct + s.negativePct}% 100%
  )`;

  container.innerHTML = `
    <header class="analytics-header">
      <div>
        <p class="analytics-eyebrow">Panel analítico · ${clientLabel}</p>
        <h2 class="analytics-title">Inteligencia de medios en tiempo real</h2>
        <p class="analytics-subtitle">${s.total} contenidos analizados para ${clientLabel}</p>
      </div>
      <div class="analytics-live-badge"><span class="analytics-live-dot"></span>En vivo</div>
    </header>

    ${renderTermsSection(mode, termStats, s.total)}

    <div class="analytics-kpi-grid">
      ${renderKpiCard('Total contenidos', s.total, 'Monitoreados', 'analytics-kpi--total')}
      ${renderKpiCard('Positivos', s.positive, `${s.positivePct}% del total`, 'analytics-kpi--positive')}
      ${renderKpiCard('Negativos', s.negative, `${s.negativePct}% del total`, 'analytics-kpi--negative')}
      ${renderKpiCard('Neutrales', s.neutral, `${s.neutralPct}% del total`, 'analytics-kpi--neutral')}
      ${renderKpiCard('Videos', s.video, `${s.videoPct}%`, 'analytics-kpi--video')}
      ${renderKpiCard('Audios', s.audio, `${s.audioPct}%`, 'analytics-kpi--audio')}
    </div>

    <div class="analytics-grid">
      <section class="analytics-panel">
        <h3 class="analytics-panel__title">Sentimiento del contenido</h3>
        <div class="analytics-sentiment-layout">
          <div class="analytics-donut" style="background:${donutGradient}">
            <div class="analytics-donut__hole">
              <strong>${s.total}</strong>
              <span>total</span>
            </div>
          </div>
          <div class="analytics-legend">
            <div class="analytics-legend__item"><span class="dot dot--positive"></span>Positivos <strong>${s.positive}</strong></div>
            <div class="analytics-legend__item"><span class="dot dot--negative"></span>Negativos <strong>${s.negative}</strong></div>
            <div class="analytics-legend__item"><span class="dot dot--neutral"></span>Neutrales <strong>${s.neutral}</strong></div>
          </div>
        </div>
      </section>

      <section class="analytics-panel">
        <h3 class="analytics-panel__title">Tipo de medio</h3>
        <div class="analytics-media-split">
          <div class="analytics-media-card analytics-media-card--video">
            <span>📺 Videos</span>
            <strong>${s.video}</strong>
            <small>${s.videoPct}%</small>
          </div>
          <div class="analytics-media-card analytics-media-card--audio">
            <span>🎙️ Audios</span>
            <strong>${s.audio}</strong>
            <small>${s.audioPct}%</small>
          </div>
        </div>
        <div class="analytics-stacked-bar">
          <div class="analytics-stacked-bar__video" style="width:${s.videoPct}%"></div>
          <div class="analytics-stacked-bar__audio" style="width:${s.audioPct}%"></div>
        </div>
      </section>

      <section class="analytics-panel analytics-panel--wide">
        <h3 class="analytics-panel__title">Canales con mayor rating acumulado</h3>
        <div class="analytics-bars">
          ${s.channelRanking.length
            ? s.channelRanking.map(ch => renderBarRow(ch.name, ch.rating, s.maxChannelRating, ch.color)).join('')
            : '<p class="analytics-muted">Sin datos de canales en este período.</p>'}
        </div>
      </section>

      <section class="analytics-panel analytics-panel--wide">
        <h3 class="analytics-panel__title">Sentimiento por canal</h3>
        <div class="analytics-channel-sentiment">
          ${ANALYTICS_CHANNEL_META.map(ch => {
            const data = s.channels[ch.id];
            if (!data.count) return '';
            const total = data.positive + data.negative + data.neutral || 1;
            const pW = (data.positive / total) * 100;
            const nW = (data.negative / total) * 100;
            const uW = (data.neutral / total) * 100;
            return `
              <div class="analytics-channel-row">
                <div class="analytics-channel-row__label">${ch.name}</div>
                <div class="analytics-channel-row__stack">
                  <div class="seg seg--positive" style="width:${pW}%"></div>
                  <div class="seg seg--negative" style="width:${nW}%"></div>
                  <div class="seg seg--neutral" style="width:${uW}%"></div>
                </div>
                <div class="analytics-channel-row__counts">
                  <span class="pos">+${data.positive}</span>
                  <span class="neg">-${data.negative}</span>
                  <span class="neu">○${data.neutral}</span>
                </div>
              </div>`;
          }).join('') || '<p class="analytics-muted">Sin desglose por canal.</p>'}
        </div>
      </section>

      <section class="analytics-panel analytics-panel--wide">
        <h3 class="analytics-panel__title">Actividad últimos 7 días</h3>
        <div class="analytics-timeline">
          ${s.timeline.map(day => `
            <div class="analytics-timeline__item">
              <div class="analytics-timeline__bar-wrap">
                <div class="analytics-timeline__bar" style="height:${Math.max(8, (day.count / s.maxTimeline) * 100)}%"></div>
              </div>
              <span class="analytics-timeline__value">${day.count}</span>
              <span class="analytics-timeline__label">${day.label}</span>
            </div>`).join('')}
        </div>
      </section>

      <section class="analytics-panel">
        <h3 class="analytics-panel__title">Top programas</h3>
        <div class="analytics-rank-list">
          ${s.topPrograms.map(([name, count], i) => `
            <div class="analytics-rank-item">
              <span class="analytics-rank-item__pos">${i + 1}</span>
              <span class="analytics-rank-item__name">${escapeHtml(name)}</span>
              <span class="analytics-rank-item__value">${count}</span>
            </div>`).join('')}
        </div>
      </section>

      <section class="analytics-panel">
        <h3 class="analytics-panel__title">Top medios</h3>
        <div class="analytics-rank-list">
          ${s.topMedios.map(([name, count], i) => `
            <div class="analytics-rank-item">
              <span class="analytics-rank-item__pos">${i + 1}</span>
              <span class="analytics-rank-item__name">${escapeHtml(formatMediaName(name === 'sin medio' ? 'Sin medio' : name))}</span>
              <span class="analytics-rank-item__value">${count}</span>
            </div>`).join('')}
        </div>
      </section>
    </div>`;
}

function refreshAnalytics() {
  if (!analyticsActive) return;
  renderAnalyticsDashboard();
}

function switchAppTab(tabName) {
  const isData = tabName === 'data';
  analyticsActive = isData;

  document.querySelectorAll('.app-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  const viewAlertas = document.getElementById('viewAlertas');
  const viewData = document.getElementById('viewData');
  if (viewAlertas) viewAlertas.classList.toggle('app-view--active', !isData);
  if (viewData) viewData.classList.toggle('app-view--active', isData);

  if (isData) renderAnalyticsDashboard();
}

function initAppTabs() {
  const tabs = document.querySelectorAll('.app-tab');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchAppTab(tab.dataset.tab);
    });
  });
}
