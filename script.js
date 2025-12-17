// ====== CONFIG ======
const CONFIG = {
  DEBUG: false,
  PAGE_SIZE: 20,
  VERSION: '4.0',
  SUPABASE: {
    url: window.SUPABASE_URL,
    key: window.SUPABASE_ANON_KEY
  }
};

// ====== LOGGING SYSTEM ======
const Logger = {
  log(...args) { CONFIG.DEBUG && console.log(...args); },
  error(...args) { console.error(...args); },
  warn(...args) { CONFIG.DEBUG && console.warn(...args); }
};

// ====== SUPABASE INIT ======
const supabase = window.supabase.createClient(CONFIG.SUPABASE.url, CONFIG.SUPABASE.key);

// ====== RATING SYSTEM ======
const RatingSystem = {
  ranges: {
    'panorama': { min: 8434, max: 11345 },
    'luna tv': { min: 8434, max: 11345 },
    'cinevision': { min: 8434, max: 11345 },
    'teleantillas': { min: 23943, max: 45000 },
    'rnn': { min: 23943, max: 45000 },
    'teleuniverso': { min: 23943, max: 45000 },
    'color vision': { min: 60000, max: 80000 },
    'default': { min: 23543, max: 30000 }
  },

  getRatingForProgram(programName) {
    if (!programName) return this.generateRating('default');

    const normalized = programName.toLowerCase().trim();

    // Buscar coincidencia exacta o parcial
    for (const [channel, range] of Object.entries(this.ranges)) {
      if (channel !== 'default' && normalized.includes(channel)) {
        return this.generateRating(channel);
      }
    }

    return this.generateRating('default');
  },

  generateRating(channelKey) {
    const range = this.ranges[channelKey] || this.ranges.default;
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  },

  formatRating(rating) {
    return rating.toLocaleString('es-ES');
  }
};

// ====== STATE MANAGEMENT ======
const AppState = {
  offset: 0,
  currentFilter: null,
  allCards: [],
  sortOrder: 'desc',
  showingHidden: false,

  reset() {
    this.offset = 0;
    this.currentFilter = null;
    this.allCards = [];
  },

  addCard(card) {
    this.allCards.push(card);
  },

  prependCard(card) {
    this.allCards.unshift(card);
  }
};

// ====== DOM CACHE ======
const DOM = {
  feedEl: null,
  toastEl: null,
  btnActualizar: null,
  btnCargarMas: null,
  btnForzarRecarga: null,
  btnExportar: null,
  btnDrive: null,
  btnToggleHidden: null,
  sortToggle: null,
  sortButton: null,

  init() {
    this.feedEl = document.getElementById('feed');
    this.toastEl = document.getElementById('toast');
    this.btnActualizar = document.getElementById('btnActualizar');
    this.btnCargarMas = document.getElementById('btnCargarMas');
    this.btnForzarRecarga = document.getElementById('btnForzarRecarga');
    this.btnExportar = document.getElementById('btnExportar');
    this.btnDrive = document.getElementById('btnDrive');
    this.btnToggleHidden = document.getElementById('btnToggleHidden');
    this.sortToggle = document.getElementById('sortToggle');
    this.sortButton = document.getElementById('sortButton');

    Logger.log('✅ DOM elements cached');
  }
};

// ====== UTILITIES ======
const Utils = {
  escapeHtml(str) {
    return (str ?? '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  toArrayMaybe(v) {
    if (Array.isArray(v)) return v;
    if (v == null) return [];
    return String(v).split(',').map(s => s.trim()).filter(Boolean);
  },

  fmt(val, fallback = '—') {
    return (val ?? '').toString().trim() || fallback;
  },

  formatDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  },

  formatShortDate(dateString) {
    if (!dateString) return 'Sin fecha';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';

    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month}. ${year}`;
  },

  format12Hour(timeString) {
    if (!timeString) return 'Sin hora';

    if (timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    }

    return timeString;
  },

  extractProgramName(filename) {
    if (!filename) return 'Sin programa';

    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const match = nameWithoutExt.match(/^([^0-9]*[A-Za-z][^0-9]*?)(?=\s*\d)/);

    if (match) {
      return match[1].trim();
    }

    const fallbackMatch = nameWithoutExt.match(/^([A-Za-z][A-Za-z0-9]*\s*[A-Za-z]*)/);
    if (fallbackMatch) {
      return fallbackMatch[1].trim();
    }

    return nameWithoutExt;
  },

  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }
};

// ====== UI MANAGER ======
const UI = {
  showToast(msg, type = 'ok') {
    const t = DOM.toastEl;
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${type === 'error' ? 'err' : 'ok'}`;
    setTimeout(() => t.classList.remove('show'), 2500);
  },

  showLoadMoreButton() {
    if (DOM.btnCargarMas) {
      DOM.btnCargarMas.style.display = 'inline-block';
    }
  },

  hideLoadMoreButton() {
    if (DOM.btnCargarMas) {
      DOM.btnCargarMas.style.display = 'none';
    }
  },

  updateHiddenCount() {
    const hiddenCount = document.querySelectorAll('.alert-card.hidden-card').length;
    const toggleBtn = DOM.btnToggleHidden;
    if (toggleBtn) {
      const countSpan = toggleBtn.querySelector('.hidden-count');
      if (countSpan) {
        countSpan.textContent = hiddenCount > 0 ? ` (${hiddenCount})` : '';
      }

      toggleBtn.style.display = hiddenCount > 0 ? 'flex' : 'none';
    }
  },

  updateSortButtonText() {
    const sortText = DOM.sortButton?.querySelector('.sort-text');
    if (sortText) {
      sortText.textContent = AppState.sortOrder === 'desc' ? 'Más recientes' : 'Más antiguos';
    }
  }
};

// ====== DATABASE OPERATIONS ======
const Database = {
  async fetchAlerts(limit = CONFIG.PAGE_SIZE, fromOffset = 0) {
    Logger.log(`🔍 Consultando Supabase: limit=${limit}, offset=${fromOffset}`);

    const { data, error } = await supabase
      .from('alertas_medios')
      .select('*')
      .order('fecha_detencion', { ascending: false })
      .range(fromOffset, fromOffset + limit - 1);

    if (error) {
      Logger.error('❌ Error en fetchAlerts:', error);
      throw error;
    }

    Logger.log(`📊 Datos obtenidos: ${data ? data.length : 0} registros`);
    return data || [];
  },

  async saveThumbnail(videoId, thumbnailDataUrl, timestamp) {
    try {
      Logger.log('📷 Guardando thumbnail en Supabase...', videoId);

      const { data, error } = await supabase
        .from('video_thumbnails')
        .upsert({
          video_id: videoId,
          thumbnail_data: thumbnailDataUrl,
          timestamp: timestamp,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'video_id'
        });

      if (error) {
        Logger.error('❌ Error al guardar thumbnail:', error);
        throw new Error(`Error de Supabase: ${error.message}`);
      }

      Logger.log('✅ Thumbnail guardado exitosamente:', videoId);
      return data;
    } catch (error) {
      Logger.error('❌ Error en saveThumbnail:', error);
      throw error;
    }
  },

  async loadThumbnail(videoId) {
    try {
      const { data, error } = await supabase
        .from('video_thumbnails')
        .select('thumbnail_data, timestamp')
        .eq('video_id', videoId)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error('❌ Error al cargar thumbnail:', error);
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('❌ Error en loadThumbnail:', error);
      return null;
    }
  }
};

// ====== VIDEO MANAGER ======
const VideoManager = {
  async captureFrame(button) {
    const card = button.closest('.alert-card');
    const video = card.querySelector('.video');

    if (!video) {
      UI.showToast('No se encontró el video', 'error');
      return;
    }

    if (video.readyState < 2) {
      UI.showToast('El video aún se está cargando, espera un momento', 'error');
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      UI.showToast('El video no tiene dimensiones válidas', 'error');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No se pudo obtener el contexto del canvas');
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      Logger.log('📷 Capturando frame - Dimensiones:', canvas.width, 'x', canvas.height);

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let thumbnailUrl;
      try {
        thumbnailUrl = canvas.toDataURL('image/jpeg', 0.9);
      } catch (corsError) {
        Logger.warn('⚠️ Error de CORS al capturar frame:', corsError.message);
        thumbnailUrl = this.createFallbackThumbnail();
      }

      if (!thumbnailUrl || thumbnailUrl === 'data:,') {
        throw new Error('No se pudo generar la imagen del thumbnail');
      }

      video.poster = thumbnailUrl;

      const cardId = card.dataset.id;
      await Database.saveThumbnail(cardId, thumbnailUrl, video.currentTime);

      UI.showToast('📷 Frame capturado y guardado');

      button.innerHTML = '✅';
      button.style.background = 'var(--ok)';
      button.title = 'Frame capturado - Click para cambiar';

      Logger.log('✅ Frame capturado exitosamente:', cardId);

    } catch (error) {
      Logger.error('❌ Error al capturar frame:', error);
      UI.showToast(`Error al capturar el frame: ${error.message}`, 'error');
    }
  },

  createFallbackThumbnail() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 180;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 320, 180);

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('📷 Thumbnail no disponible', 160, 90);
    ctx.fillText('por restricciones CORS', 160, 110);

    return canvas.toDataURL('image/jpeg', 0.9);
  }
};

// ====== CARD MANAGER ======
const CardManager = {
  renderAlertCard(row) {
    Logger.log('📄 Renderizando tarjeta:', row.id);

    const terms = Utils.toArrayMaybe(row.termino_detectado);
    const card = document.createElement('section');
    card.className = 'alert-card';
    card.dataset.id = row.id;
    card.dataset.termino = (row.termino_detectado || '').toLowerCase();
    card.dataset.ejecutivo = (row.ejecutivo || '').toLowerCase();
    card.dataset.contexto = (row.contexto || '').toLowerCase();
    card.dataset.transcripcion = (row.transcripcion || '').toLowerCase();
    card.dataset.date = row.fecha_detencion || row.fecha_programa || new Date().toISOString();

    const hasVideo = !!row.url_video;
    const hasTranscription = !!row.transcripcion;

    // Generar rating basado en el programa
    const programName = Utils.extractProgramName(row.nombre_archivo);
    const rating = RatingSystem.getRatingForProgram(programName);
    const formattedRating = RatingSystem.formatRating(rating);

    const summary = this.generateSummary(row);
    const videoSection = this.renderVideoSection(row, hasVideo);
    const termsSection = this.renderTermsSection(terms);
    const summarySection = this.renderSummarySection(summary);
    const transcriptionSection = this.renderTranscriptionSection(row, hasTranscription);

    const contextText = row.ejecutivo || row.contexto || row.transcripcion || 'Sin contexto disponible';
    const tooltipText = contextText.length > 150 ? contextText.substring(0, 150) + '...' : contextText;

    card.innerHTML = `
      <div class="tooltip">${Utils.escapeHtml(tooltipText)}</div>

      <div class="alert-header">
        <div class="alert-title">
          <span class="alert-dot"></span>
          <span>Coincidencia: ${terms.length > 0 ? Utils.escapeHtml(Utils.capitalizeFirst(terms[0])) : 'Detectada'}</span>
        </div>
        <div class="alert-time">
          <span>📅</span>
          <span>${Utils.escapeHtml(Utils.formatShortDate(row.fecha_detencion || row.fecha_programa))}</span>
          <button class="camera-btn" data-action="capture-frame" title="Capturar frame actual">
            📷
          </button>
          <button class="hide-btn" data-action="hide-card" title="Ocultar video">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </div>

      ${videoSection}

      <div class="media-info">
        <div class="info-box">
          <div class="info-label">PROGRAMA</div>
          <div class="info-value">${Utils.escapeHtml(programName)} → Rating: +${formattedRating}</div>
        </div>
        <div class="info-box">
          <div class="info-label">HORARIO</div>
          <div class="info-value">${Utils.escapeHtml(Utils.format12Hour(row.hora_programa))}</div>
        </div>
      </div>

      ${termsSection}
      ${summarySection}
      ${transcriptionSection}
    `;

    this.attachCardEvents(card, row);

    return card;
  },

  generateSummary(row) {
    const terminoDetectado = row.termino_detectado || '';
    const context = row.ejecutivo || row.contexto || 'Se detectó contenido relevante en el programa.';
    const relevance = row.relevancia || 'Esta mención es significativa para el monitoreo de contenido y puede requerir seguimiento adicional.';

    return {
      tema: terminoDetectado,
      contexto: context,
      puntos: terminoDetectado,
      relevancia: relevance
    };
  },

  renderVideoSection(row, hasVideo) {
    if (!hasVideo) return '';

    return `
      <div class="video-section">
        <div class="video-container">
          <button class="close-button" data-action="close-card">✕</button>
          <video class="video" controls preload="none" crossorigin="anonymous" onerror="this.parentElement.innerHTML = '<div style=\\'display:flex;align-items:center;justify-content:center;height:300px;opacity:.7;border:1px dashed var(--danger);color:var(--danger);\\'>Error al cargar video</div>'">
            <source src="${row.url_video}" type="video/mp4"/>
            Tu navegador no soporta video HTML5.
          </video>
        </div>
        <div class="video-links">
          <div class="link-box">
            <span>🔗</span>
            <a href="${row.url_video}" target="_blank">Ver video original</a>
          </div>
          <div class="link-box">
            <span>🔗</span>
            <a href="${row.url_video}" target="_blank">Acceso directo</a>
          </div>
        </div>
      </div>`;
  },

  renderTermsSection(terms) {
    if (terms.length === 0) return '';

    return `
      <div class="terms-section">
        <div class="alert-title">
          <span class="alert-dot"></span>
          <span>Términos Detectados</span>
        </div>
        <div class="terms-container">
          ${terms.map(t => `<span class="term-badge">${Utils.escapeHtml(t)}</span>`).join('')}
        </div>
      </div>`;
  },

  renderSummarySection(summary) {
    return `
      <div class="summary-section">
        <div class="alert-title">
          <span class="alert-dot"></span>
          <span>Resumen Ejecutivo</span>
        </div>
        <div class="summary-content">
          <div class="summary-item">
            <div class="summary-label">Tema principal:</div>
            <div class="summary-text">${Utils.escapeHtml(summary.tema)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Contexto:</div>
            <div class="summary-text">${Utils.escapeHtml(summary.contexto)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Puntos clave:</div>
            <div class="summary-text">${Utils.escapeHtml(summary.puntos)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Relevancia:</div>
            <div class="summary-text">${Utils.escapeHtml(summary.relevancia)}</div>
          </div>
        </div>
      </div>`;
  },

  renderTranscriptionSection(row, hasTranscription) {
    if (!hasTranscription) return '';

    return `
      <div class="transcription-section">
        <div class="alert-title">
          <span class="alert-dot"></span>
          <span>Transcripción del Contenido</span>
        </div>
        <div class="transcription-content">
          ${Utils.escapeHtml(row.transcripcion)}
        </div>
      </div>`;
  },

  attachCardEvents(card, row) {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('button') && !e.target.closest('a')) {
        this.toggleCardExpansion(card);
      }
    });

    let tooltipTimer;
    card.addEventListener('mouseenter', () => {
      tooltipTimer = setTimeout(() => {
        const tooltip = card.querySelector('.tooltip');
        if (tooltip) {
          tooltip.style.opacity = '1';
          tooltip.style.visibility = 'visible';
        }
      }, 3000);
    });

    card.addEventListener('mouseleave', () => {
      clearTimeout(tooltipTimer);
      const tooltip = card.querySelector('.tooltip');
      if (tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
      }
    });

    Database.loadThumbnail(row.id).then(thumbnailData => {
      if (thumbnailData && thumbnailData.thumbnail_data) {
        const video = card.querySelector('.video');
        if (video) {
          video.poster = thumbnailData.thumbnail_data;
          const cameraBtn = card.querySelector('.camera-btn');
          if (cameraBtn) {
            cameraBtn.innerHTML = '✅';
            cameraBtn.style.background = 'var(--ok)';
            cameraBtn.title = 'Frame capturado - Click para cambiar';
          }
          Logger.log('📷 Thumbnail cargado:', row.id);
        }
      }
    }).catch(error => {
      Logger.error('❌ Error al cargar thumbnail:', error);
    });
  },

  toggleCardExpansion(card) {
    const isExpanded = card.classList.contains('expanded');

    document.querySelectorAll('.alert-card.expanded').forEach(expandedCard => {
      const video = expandedCard.querySelector('.video');
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
      expandedCard.classList.remove('expanded');
    });

    if (!isExpanded) {
      card.classList.add('expanded');
    }
  },

  closeExpandedCard(card) {
    if (card) {
      const video = card.querySelector('.video');
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
      card.classList.remove('expanded');
    }
  },

  hideCard(button) {
    const card = button.closest('.alert-card');
    if (!card) return;

    const video = card.querySelector('.video');
    if (video) {
      video.pause();
      video.currentTime = 0;
    }

    card.classList.remove('expanded');
    card.classList.add('hidden-card');
    card.setAttribute('data-hidden', 'true');

    const hideBtn = card.querySelector('.hide-btn');
    if (hideBtn) {
      hideBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
      hideBtn.title = 'Mostrar video';
      hideBtn.dataset.action = 'show-card';
    }

    UI.showToast('Video oculto - Usa el botón del menú para ver videos ocultos');
    UI.updateHiddenCount();
  },

  showCard(button) {
    const card = button.closest('.alert-card');
    if (!card) return;

    card.classList.remove('hidden-card');
    card.setAttribute('data-hidden', 'false');

    const hideBtn = card.querySelector('.hide-btn');
    if (hideBtn) {
      hideBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
      hideBtn.title = 'Ocultar video';
      hideBtn.dataset.action = 'hide-card';
    }

    UI.showToast('Video visible de nuevo');
    UI.updateHiddenCount();
  },

  appendBatch(rows) {
    rows.forEach(r => {
      const card = this.renderAlertCard(r);
      DOM.feedEl.appendChild(card);
      AppState.addCard(card);
    });
  },

  prependOne(row) {
    const el = this.renderAlertCard(row);
    DOM.feedEl.insertBefore(el, DOM.feedEl.firstChild);
    AppState.prependCard(el);
  }
};

// ====== FILTER MANAGER ======
const FilterManager = {
  applyFilter(filter) {
    Logger.log('🔍 Filtrando por:', filter);
    AppState.currentFilter = filter;

    document.querySelectorAll('.filter-tag').forEach(tag => {
      tag.classList.remove('active');
    });

    if (filter) {
      const activeTag = document.querySelector(`[data-filter="${filter}"]`);
      if (activeTag) {
        activeTag.classList.add('active');
      }
    }

    let visibleCount = 0;
    const visibleCards = [];

    AppState.allCards.forEach(card => {
      const cardData = card.dataset;
      const termino = (cardData.termino || '').toLowerCase();
      const ejecutivo = (cardData.ejecutivo || '').toLowerCase();
      const contexto = (cardData.contexto || '').toLowerCase();
      const transcripcion = (cardData.transcripcion || '').toLowerCase();

      const shouldShow = !filter ||
        termino.includes(filter.toLowerCase()) ||
        ejecutivo.includes(filter.toLowerCase()) ||
        contexto.includes(filter.toLowerCase()) ||
        transcripcion.includes(filter.toLowerCase());

      if (shouldShow) {
        visibleCards.push(card);
        visibleCount++;
      }
    });

    DOM.feedEl.innerHTML = '';
    visibleCards.forEach(card => {
      DOM.feedEl.appendChild(card);
    });

    UI.showToast(filter ? `Filtrado por: ${filter} (${visibleCount} videos)` : `Mostrando todos los videos (${AppState.allCards.length})`);
  },

  toggleSortOrder() {
    AppState.sortOrder = AppState.sortOrder === 'desc' ? 'asc' : 'desc';
    Logger.log('🔄 Cambiando ordenamiento a:', AppState.sortOrder === 'desc' ? 'Más recientes' : 'Más antiguos');

    this.reorganizeCards();
    UI.showToast(AppState.sortOrder === 'desc' ? '📅 Ordenado: Más recientes primero' : '📅 Ordenado: Más antiguos primero');
  },

  reorganizeCards() {
    const visibleCards = Array.from(DOM.feedEl.children);

    visibleCards.sort((a, b) => {
      const dateA = new Date(a.dataset.date || 0);
      const dateB = new Date(b.dataset.date || 0);

      return AppState.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    visibleCards.forEach(card => {
      DOM.feedEl.appendChild(card);
    });
  },

  toggleHiddenCards() {
    AppState.showingHidden = !AppState.showingHidden;
    const toggleBtn = DOM.btnToggleHidden;

    if (AppState.showingHidden) {
      document.querySelectorAll('.alert-card.hidden-card').forEach(card => {
        card.style.opacity = '0.6';
        card.style.filter = 'grayscale(50%)';
      });

      if (toggleBtn) {
        toggleBtn.classList.add('active');
        const icon = toggleBtn.querySelector('svg');
        if (icon) {
          icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          `;
        }
      }

      UI.showToast('Mostrando videos ocultos (en gris)');
    } else {
      document.querySelectorAll('.alert-card.hidden-card').forEach(card => {
        card.style.opacity = '';
        card.style.filter = '';
      });

      if (toggleBtn) {
        toggleBtn.classList.remove('active');
        const icon = toggleBtn.querySelector('svg');
        if (icon) {
          icon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          `;
        }
      }

      UI.showToast('Videos ocultos de nuevo');
    }
  }
};

// ====== REALTIME MANAGER ======
const RealtimeManager = {
  channel: null,

  enable() {
    this.channel = supabase
      .channel('alertas-feed')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alertas_medios' },
        payload => {
          const row = payload.new || payload.record || payload;
          CardManager.prependOne(row);
          UI.showToast('🆕 Nueva alerta recibida');
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alertas_medios' },
        () => {
          UI.showToast('🔄 Alerta actualizada');
          App.loadFirstPage();
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'alertas_medios' },
        () => {
          UI.showToast('🗑️ Alerta eliminada');
          App.loadFirstPage();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          Logger.log('✅ Conectado al canal de tiempo real');
        } else if (status === 'CHANNEL_ERROR') {
          Logger.error('❌ Error en el canal de tiempo real');
          UI.showToast('Error en conexión en tiempo real', 'error');
        }
      });
  }
};

// ====== MAIN APP ======
const App = {
  async loadFirstPage() {
    if (DOM.btnActualizar) DOM.btnActualizar.disabled = true;
    if (DOM.btnCargarMas) DOM.btnCargarMas.disabled = true;

    try {
      AppState.reset();
      DOM.feedEl.innerHTML = '';
      Logger.log('🔄 Cargando videos...');

      const rows = await Database.fetchAlerts(CONFIG.PAGE_SIZE, 0);
      Logger.log('📊 Registros obtenidos:', rows.length);

      if (rows.length > 0) {
        CardManager.appendBatch(rows);
        AppState.offset = rows.length;
        UI.showToast(`✅ Cargados ${rows.length} registros`);

        if (rows.length < CONFIG.PAGE_SIZE) {
          UI.hideLoadMoreButton();
        } else {
          UI.showLoadMoreButton();
        }
      } else {
        DOM.feedEl.innerHTML = `
          <div class="card" style="text-align: center; padding: 40px;">
            <h3>📭 No hay alertas disponibles</h3>
            <p>No se encontraron registros en la tabla 'alertas_medios'.</p>
            <p>Verifica que el sistema de análisis de videos esté insertando datos.</p>
          </div>
        `;
        UI.showToast('⚠️ No hay datos disponibles', 'error');
      }
    } catch (e) {
      UI.showToast('Error cargando: ' + e.message, 'error');
      Logger.error('❌ Error en loadFirstPage:', e);

      DOM.feedEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px; border-color: var(--danger);">
          <h3>❌ Error de conexión</h3>
          <p>No se pudo cargar los datos desde Supabase.</p>
          <p>Error: ${e.message}</p>
        </div>
      `;
    } finally {
      if (DOM.btnActualizar) DOM.btnActualizar.disabled = false;
      if (DOM.btnCargarMas) DOM.btnCargarMas.disabled = false;
    }
  },

  async loadMore() {
    if (DOM.btnCargarMas) DOM.btnCargarMas.disabled = true;

    try {
      const rows = await Database.fetchAlerts(CONFIG.PAGE_SIZE, AppState.offset);
      if (rows.length === 0) {
        UI.showToast('No hay más registros');
        UI.hideLoadMoreButton();
      } else {
        CardManager.appendBatch(rows);
        AppState.offset += rows.length;
        UI.showToast(`✅ Cargados ${rows.length} registros adicionales`);

        if (rows.length < CONFIG.PAGE_SIZE) {
          UI.hideLoadMoreButton();
        }
      }
    } catch (e) {
      UI.showToast('Error cargando más: ' + e.message, 'error');
      Logger.error(e);
    } finally {
      if (DOM.btnCargarMas) DOM.btnCargarMas.disabled = false;
    }
  },

  initEventListeners() {
    // Event delegation para botones de acciones
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      e.stopPropagation();

      const action = target.dataset.action;

      switch (action) {
        case 'capture-frame':
          VideoManager.captureFrame(target);
          break;
        case 'hide-card':
          CardManager.hideCard(target);
          break;
        case 'show-card':
          CardManager.showCard(target);
          break;
        case 'close-card':
          CardManager.closeExpandedCard(target.closest('.alert-card'));
          break;
      }
    });

    // Botones principales
    if (DOM.btnActualizar) {
      DOM.btnActualizar.addEventListener('click', () => this.loadFirstPage());
    }

    if (DOM.btnCargarMas) {
      DOM.btnCargarMas.addEventListener('click', () => this.loadMore());
    }

    if (DOM.btnForzarRecarga) {
      DOM.btnForzarRecarga.addEventListener('click', () => {
        UI.showToast('🔄 Forzando recarga completa...');
        window.location.reload();
      });
    }

    if (DOM.btnExportar) {
      DOM.btnExportar.addEventListener('click', () => {
        UI.showToast('Funcionalidad de exportación en desarrollo', 'error');
      });
    }

    if (DOM.btnDrive) {
      DOM.btnDrive.addEventListener('click', () => {
        UI.showToast('Funcionalidad de Drive en desarrollo', 'error');
      });
    }

    if (DOM.btnToggleHidden) {
      DOM.btnToggleHidden.addEventListener('click', () => FilterManager.toggleHiddenCards());
    }

    // Filtros
    document.querySelectorAll('.filter-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const filter = tag.dataset.filter;
        FilterManager.applyFilter(AppState.currentFilter === filter ? null : filter);
      });
    });

    // Switch de ordenamiento
    if (DOM.sortToggle) {
      DOM.sortToggle.addEventListener('change', () => {
        FilterManager.toggleSortOrder();
      });

      // Detectar si el switch se renderiza correctamente
      setTimeout(() => {
        const switchContainer = document.querySelector('.sort-switch-container');
        const slider = document.querySelector('.slider');

        if (switchContainer && slider) {
          const computedStyle = window.getComputedStyle(slider);
          const width = computedStyle.width;
          const height = computedStyle.height;

          if (width === '0px' || height === '0px' || width === 'auto' || height === 'auto') {
            Logger.warn('⚠️ Switch no se renderiza correctamente, usando botón alternativo');
            switchContainer.style.display = 'none';
            if (DOM.sortButton) {
              DOM.sortButton.style.display = 'flex';
            }
          }
        }
      }, 1000);
    }

    if (DOM.sortButton) {
      DOM.sortButton.addEventListener('click', () => {
        FilterManager.toggleSortOrder();
        UI.updateSortButtonText();
      });
    }

    Logger.log('✅ Event listeners configurados');
  },

  async init() {
    Logger.log('🚀 Inicializando aplicación - Versión', CONFIG.VERSION);

    DOM.init();
    this.initEventListeners();
    RealtimeManager.enable();
    await this.loadFirstPage();

    Logger.log('✅ Aplicación inicializada');
  }
};

// ====== INIT ON DOM READY ======
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Exponer para debugging
if (CONFIG.DEBUG) {
  window.App = App;
  window.AppState = AppState;
  window.RatingSystem = RatingSystem;
}
