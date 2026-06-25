// ====== Supabase Init ======
const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ====== Selectores del DOM ======
const feedEl = document.getElementById('feed');
const toastEl = document.getElementById('toast');
const btnActualizar = document.getElementById('btnActualizar');
const btnCargarMas = document.getElementById('btnCargarMas');
const btnForzarRecarga = document.getElementById('btnForzarRecarga');
const btnExportar = document.getElementById('btnExportar');
const btnDrive = document.getElementById('btnDrive');
const btnToggleHidden = document.getElementById('btnToggleHidden');

// Verificar que los elementos existan
console.log('🔍 Verificando elementos del DOM:');
console.log('feedEl:', feedEl);
console.log('btnActualizar:', btnActualizar);
console.log('btnCargarMas:', btnCargarMas);
console.log('btnForzarRecarga:', btnForzarRecarga);
console.log('btnExportar:', btnExportar);
console.log('btnDrive:', btnDrive);

// ====== Config / Estado ======
const PAGE_SIZE = 10; // Aumentado para mostrar más videos inicialmente
let offset = 0;

// ====== Utilidades ======
function showToast(msg, type='ok'){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type === 'error' ? 'err' : 'ok'}`;
  setTimeout(()=> t.classList.remove('show'), 2500);
}

function showLoadMoreButton() {
  if (btnCargarMas) {
    btnCargarMas.style.display = 'inline-block';
  }
}

// Función para capturar el frame actual del video
async function captureVideoFrame(button) {
  const card = button.closest('.alert-card');
  const video = card.querySelector('.video');
  
  if (!video) {
    showToast('No se encontró el video', 'error');
    return;
  }
  
  // Verificar que el video esté cargado
  if (video.readyState < 2) {
    showToast('El video aún se está cargando, espera un momento', 'error');
    return;
  }
  
  // Verificar que el video tenga dimensiones válidas
  if (!video.videoWidth || !video.videoHeight) {
    showToast('El video no tiene dimensiones válidas', 'error');
    return;
  }
  
  try {
    // Crear canvas para capturar el frame
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('No se pudo obtener el contexto del canvas');
    }
    
    // Configurar canvas con las dimensiones del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    console.log('📷 Capturando frame - Dimensiones:', canvas.width, 'x', canvas.height);
    console.log('📷 Tiempo del video:', video.currentTime);
    
    // Capturar el frame actual del video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Intentar convertir a imagen (puede fallar por CORS)
    let thumbnailUrl;
    try {
      thumbnailUrl = canvas.toDataURL('image/jpeg', 0.9);
    } catch (corsError) {
      console.warn('⚠️ Error de CORS al capturar frame:', corsError.message);
      
      // Alternativa: usar un frame por defecto o mensaje
      showToast('⚠️ No se puede capturar frame por restricciones de seguridad. Usando frame por defecto.', 'error');
      
      // Crear un thumbnail alternativo con un mensaje
      const altCanvas = document.createElement('canvas');
      const altCtx = altCanvas.getContext('2d');
      altCanvas.width = 320;
      altCanvas.height = 180;
      
      // Fondo oscuro
      altCtx.fillStyle = '#1a1a1a';
      altCtx.fillRect(0, 0, 320, 180);
      
      // Texto
      altCtx.fillStyle = '#ffffff';
      altCtx.font = '16px Arial';
      altCtx.textAlign = 'center';
      altCtx.fillText('📷 Thumbnail no disponible', 160, 90);
      altCtx.fillText('por restricciones CORS', 160, 110);
      
      thumbnailUrl = altCanvas.toDataURL('image/jpeg', 0.9);
    }
    
    if (!thumbnailUrl || thumbnailUrl === 'data:,') {
      throw new Error('No se pudo generar la imagen del thumbnail');
    }
    
    // Aplicar el thumbnail al video inmediatamente
    video.poster = thumbnailUrl;
    
    // Guardar en Supabase
    const cardId = card.dataset.id;
    console.log('📷 Guardando thumbnail en Supabase para video:', cardId);
    
    await saveThumbnailToSupabase(cardId, thumbnailUrl, video.currentTime);
    
    // Mostrar confirmación
    showToast('📷 Frame capturado y guardado en Supabase');
    
    // Cambiar el ícono del botón para indicar que se capturó
    button.innerHTML = '✅';
    button.style.background = 'var(--ok)';
    button.title = 'Frame capturado - Click para cambiar';
    
    console.log('✅ Frame capturado exitosamente para video:', cardId, 'Tiempo:', video.currentTime);
    
  } catch (error) {
    console.error('❌ Error al capturar frame:', error);
    showToast(`Error al capturar el frame: ${error.message}`, 'error');
  }
}

// Función para guardar thumbnail en Supabase
async function saveThumbnailToSupabase(videoId, thumbnailDataUrl, timestamp) {
  try {
    console.log('📷 Intentando guardar thumbnail en Supabase...');
    console.log('📷 Video ID:', videoId);
    console.log('📷 Timestamp:', timestamp);
    console.log('📷 Thumbnail size:', thumbnailDataUrl.length, 'caracteres');
    
    const { data, error } = await supabaseClient
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
      console.error('❌ Error al guardar thumbnail en Supabase:', error);
      console.error('❌ Detalles del error:', error.message, error.details, error.hint);
      throw new Error(`Error de Supabase: ${error.message}`);
    }
    
    console.log('✅ Thumbnail guardado exitosamente en Supabase:', videoId);
    return data;
  } catch (error) {
    console.error('❌ Error en saveThumbnailToSupabase:', error);
    throw error;
  }
}

// Función para cargar thumbnail desde Supabase
async function loadThumbnailFromSupabase(videoId) {
  try {
    const { data, error } = await supabaseClient
      .from('video_thumbnails')
      .select('thumbnail_data, timestamp')
      .eq('video_id', videoId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Error al cargar thumbnail desde Supabase:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error en loadThumbnailFromSupabase:', error);
    return null;
  }
}

// Función alternativa para capturar frame sin CORS (usando proxy)
async function captureFrameWithProxy(videoUrl, timestamp) {
  try {
    // Usar un servicio de proxy para evitar CORS
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(videoUrl)}`;
    
    // Crear un video temporal para capturar el frame
    const tempVideo = document.createElement('video');
    tempVideo.crossOrigin = 'anonymous';
    tempVideo.src = proxyUrl;
    
    return new Promise((resolve, reject) => {
      tempVideo.addEventListener('loadeddata', () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = tempVideo.videoWidth;
        canvas.height = tempVideo.videoHeight;
        
        tempVideo.currentTime = timestamp;
        tempVideo.addEventListener('seeked', () => {
          ctx.drawImage(tempVideo, 0, 0);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(thumbnailUrl);
        });
      });
      
      tempVideo.addEventListener('error', (error) => {
        reject(new Error('No se pudo cargar el video a través del proxy'));
      });
    });
  } catch (error) {
    console.error('❌ Error en captureFrameWithProxy:', error);
    throw error;
  }
}


function toArrayMaybe(v){
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return String(v).split(',').map(s=>s.trim()).filter(Boolean);
}

function fmt(val, fallback='—'){ return (val ?? '').toString().trim() || fallback; }

const AUDIO_EXTENSIONS = ['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.wma', '.flac'];

function detectMediaType(row) {
  const filename = (row.nombre_archivo || '').toLowerCase();
  const url = (row.url_video || '').toLowerCase();
  const combined = `${filename} ${url}`;

  if (AUDIO_EXTENSIONS.some(ext => combined.includes(ext))) return 'audio';
  if (/_fm_|_radio_|radio_/i.test(filename)) return 'audio';
  if (/\.(mp4|webm|mov|avi|mkv)/i.test(combined)) return 'video';
  if (/\bfm\b/i.test(filename)) return 'audio';

  return 'video';
}

function pauseCardMedia(card) {
  const video = card.querySelector('.video');
  const audio = card.querySelector('.audio-player');
  if (video) {
    video.pause();
    video.currentTime = 0;
  }
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

function getMediaMimeType(mediaType, url) {
  const lowerUrl = (url || '').toLowerCase();
  if (mediaType === 'audio') {
    if (lowerUrl.includes('.mp3')) return 'audio/mpeg';
    if (lowerUrl.includes('.wav')) return 'audio/wav';
    if (lowerUrl.includes('.ogg')) return 'audio/ogg';
    return 'audio/mp4';
  }
  if (lowerUrl.includes('.webm')) return 'video/webm';
  return 'video/mp4';
}

function handleVideoError(videoEl) {
  const container = videoEl.closest('.video-container');
  if (!container || container.querySelector('.media-error')) return;

  videoEl.style.display = 'none';
  const errorEl = document.createElement('div');
  errorEl.className = 'media-error';
  errorEl.style.cssText = 'display:flex;align-items:center;justify-content:center;height:180px;opacity:.7;border:1px dashed var(--danger);color:var(--danger);';
  errorEl.textContent = 'Error al cargar video';
  container.appendChild(errorEl);
}

function handleAudioError(audioEl) {
  const container = audioEl.closest('.audio-container');
  if (!container || container.querySelector('.media-error')) return;

  const thumbnail = container.querySelector('.audio-thumbnail');
  if (thumbnail) thumbnail.style.display = 'none';
  audioEl.style.display = 'none';

  const errorEl = document.createElement('div');
  errorEl.className = 'media-error';
  errorEl.style.cssText = 'display:flex;align-items:center;justify-content:center;height:180px;opacity:.7;border:1px dashed var(--danger);color:var(--danger);';
  errorEl.textContent = 'Error al cargar audio';
  container.appendChild(errorEl);
}

function detectSentiment(row) {
  const text = [
    row.contexto,
    row.transcripcion,
    row.resumen_ejecutivo,
    row.ejecutivo
  ].filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (!text.trim()) return 'neutral';

  if (text.includes('no_relevante') || text.startsWith('no relevante')) {
    return 'neutral';
  }

  const hasPositive = /sentimiento positiv|tono positiv|contexto positiv|\bpositivo\b|\bpositiva\b/.test(text);
  const hasNegative = /sentimiento negativ|tono negativ|contexto negativ|\bnegativo\b|\bnegativa\b/.test(text);

  if (hasPositive && !hasNegative) return 'positive';
  if (hasNegative && !hasPositive) return 'negative';

  const negativeWords = [
    'protest', 'denunc', 'critic', 'queja', 'reclamo', 'afect', 'perdida',
    'dan', 'mortal', 'victim', 'problema', 'crisis', 'falla', 'incumpl',
    'descontent', 'grave', 'terrible', 'peor', 'deficiencia', 'apagon',
    'apagones', 'interrupc', 'sin servicio', 'tarifa alta', 'factura alta',
    'colapso', 'averia', 'retraso', 'impuntual', 'corrupc', 'escandalo'
  ];
  const positiveWords = [
    'logro', 'mejora', 'exito', 'favorable', 'apoyo', 'reconoc',
    'solucion', 'benefic', 'satisfe', 'eficient', 'cumpl', 'avance',
    'optim', 'resuelto', 'normaliz', 'restablec', 'inversion',
    'moderniz', 'progreso', 'transparencia', 'compromiso'
  ];

  let score = 0;
  negativeWords.forEach(word => { if (text.includes(word)) score -= 1; });
  positiveWords.forEach(word => { if (text.includes(word)) score += 1; });

  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

function getSentimentBadgeHtml(sentiment) {
  if (sentiment === 'positive') {
    return '<span class="sentiment-badge sentiment-badge--positive">Positivo</span>';
  }
  if (sentiment === 'negative') {
    return '<span class="sentiment-badge sentiment-badge--negative">Negativo</span>';
  }
  return '';
}

function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Si no es una fecha válida, devolver original
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
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// ====== DB helpers ======
async function fetchAlerts(limit = PAGE_SIZE, fromOffset = 0){
  console.log(`🔍 Consultando Supabase: limit=${limit}, offset=${fromOffset}`);
  
  const { data, error } = await supabaseClient
    .from('alertas_medios')
    .select('*')
    .order('fecha_detencion', { ascending: false })      // 👈 ordenar por fecha de detección (más reciente primero)
    .range(fromOffset, fromOffset + limit - 1);

  if (error) {
    console.error('❌ Error en fetchAlerts:', error);
    throw error;
  }
  
  console.log(`📊 Datos obtenidos: ${data ? data.length : 0} registros`);
  return data || [];
}

// Función de guardado eliminada - solo lectura de datos

// ====== Render ======
function renderAlertCard(row){
  console.log('📄 Renderizando tarjeta para registro:', row);
  
  // Mapear campos de la base de datos a los esperados por la interfaz
  const terms = toArrayMaybe(row.termino_detectado); // termino_detectado en lugar de termino_d
  const card = document.createElement('section');
  card.className = 'alert-card';
  card.dataset.id = row.id; // Para identificar la tarjeta
  card.dataset.termino = (row.termino_detectado || '').toLowerCase();
  card.dataset.ejecutivo = (row.ejecutivo || '').toLowerCase();
  card.dataset.contexto = (row.contexto || '').toLowerCase();
  card.dataset.transcripcion = (row.transcripcion || '').toLowerCase();
  card.dataset.date = row.fecha_detencion || row.fecha_programa || new Date().toISOString(); // Para ordenamiento
  card.dataset.nombrearchivo = (row.nombre_archivo || '').toLowerCase();
  card.dataset.nombremedio = (row.nombre_medio || '').toLowerCase();
  const mediaType = detectMediaType(row);
  card.dataset.mediatype = mediaType;
  const programSource = row.nombre_archivo || row.nombre_medio || '';
  const channel = detectChannel(programSource);
  const rating = calculateRating(programSource, row.id);
  card.dataset.channel = channel;
  card.dataset.rating = String(rating);
  
  console.log('📄 Datos de la tarjeta:', {
    id: row.id,
    termino: card.dataset.termino,
    ejecutivo: card.dataset.ejecutivo.substring(0, 50) + '...',
    contexto: card.dataset.contexto.substring(0, 50) + '...',
    transcripcion: card.dataset.transcripcion.substring(0, 50) + '...'
  });

  const hasMedia = !!row.url_video;
  const hasTranscription = !!row.transcripcion;
  const isAudio = mediaType === 'audio';
  const mimeType = getMediaMimeType(mediaType, row.url_video);
  const programDisplayName = formatMediaName(
    extractProgramName(row.nombre_archivo || row.nombre_medio || '')
  );
  const sentiment = detectSentiment(row);
  const sentimentBadge = getSentimentBadgeHtml(sentiment);
  card.dataset.sentiment = sentiment;

  const mediaSection = hasMedia ? (isAudio ? `
    <div class="audio-section">
      <div class="audio-container">
        <button class="close-button" onclick="event.stopPropagation(); closeExpandedCard(this.closest('.alert-card'))">✕</button>
        <div class="audio-thumbnail">
          ${sentimentBadge}
          <svg class="audio-thumbnail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
          <div class="audio-thumbnail-name">${escapeHtml(programDisplayName)}</div>
        </div>
        <audio class="audio-player" controls preload="metadata" onerror="handleAudioError(this)">
          <source src="${row.url_video}" type="${mimeType}"/>
          Tu navegador no soporta audio HTML5.
        </audio>
      </div>
      <div class="audio-links">
        <div class="link-box">
          <span>🔗</span>
          <a href="${row.url_video}" target="_blank">Ver audio original</a>
        </div>
        <div class="link-box">
          <span>🔗</span>
          <a href="${row.url_video}" target="_blank">Acceso directo</a>
        </div>
      </div>
    </div>` : `
    <div class="video-section">
      <div class="video-container">
        ${sentimentBadge}
        <button class="close-button" onclick="event.stopPropagation(); closeExpandedCard(this.closest('.alert-card'))">✕</button>
        <video class="video" controls preload="metadata" crossorigin="anonymous" playsinline onerror="handleVideoError(this)">
          <source src="${row.url_video}" type="${mimeType}"/>
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
    </div>`) : '';

  // Generar resumen ejecutivo basado en los datos
  const generateSummary = () => {
    const terminoDetectado = row.termino_detectado || '';
    const context = row.ejecutivo || row.contexto || 'Se detectó contenido relevante en el programa.';
    const relevance = row.relevancia || 'Esta mención es significativa para el monitoreo de contenido y puede requerir seguimiento adicional.';
    
    return {
      tema: terminoDetectado,
      contexto: context,
      puntos: terminoDetectado,
      relevancia: relevance
    };
  };

  const summary = generateSummary();

  const termsSection = terms.length > 0 ? `
    <div class="terms-section">
      <div class="alert-title">
        <span class="alert-dot"></span>
        <span>Términos Detectados</span>
      </div>
      <div class="terms-container">
        ${terms.map(t => `<span class="term-badge">${escapeHtml(t)}</span>`).join('')}
      </div>
    </div>` : '';

  const summarySection = `
    <div class="summary-section">
      <div class="alert-title">
        <span class="alert-dot"></span>
        <span>Resumen Ejecutivo</span>
      </div>
      <div class="summary-content">
        <div class="summary-item">
          <div class="summary-label">Tema principal:</div>
          <div class="summary-text">${escapeHtml(summary.tema)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Contexto:</div>
          <div class="summary-text">${escapeHtml(summary.contexto)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Puntos clave:</div>
          <div class="summary-text">${escapeHtml(summary.puntos)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Relevancia:</div>
          <div class="summary-text">${escapeHtml(summary.relevancia)}</div>
        </div>
      </div>
    </div>`;

  const transcriptionSection = hasTranscription ? `
    <div class="transcription-section">
      <div class="alert-title">
        <span class="alert-dot"></span>
        <span>Transcripción del Contenido</span>
      </div>
      <div class="transcription-content">
        ${escapeHtml(row.transcripcion)}
      </div>
    </div>` : '';

  const cameraBtnHtml = isAudio ? '' : `
        <button class="camera-btn" onclick="event.stopPropagation(); captureVideoFrame(this)" title="Capturar frame actual">
          📷
        </button>`;

  // Crear tooltip con contexto
  const contextText = row.ejecutivo || row.contexto || row.transcripcion || 'Sin contexto disponible';
  const tooltipText = contextText.length > 150 ? contextText.substring(0, 150) + '...' : contextText;
  
  console.log('🔍 Tooltip creado para tarjeta:', row.id, 'Texto:', tooltipText.substring(0, 50) + '...');

  card.innerHTML = `
    <div class="tooltip">${escapeHtml(tooltipText)}</div>

    <div class="alert-header">
      <div class="alert-title">
        <span class="alert-dot"></span>
        <span>Coincidencia: ${terms.length > 0 ? escapeHtml(capitalizeFirst(terms[0])) : 'Detectada'}</span>
      </div>
      <div class="alert-time">
        <span>📅</span>
        <span>${escapeHtml(formatShortDate(row.fecha_detencion || row.fecha_programa))}</span>${cameraBtnHtml}
        <button class="hide-btn" onclick="event.stopPropagation(); hideVideoCard(this)" title="Ocultar contenido">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
    </div>

    ${mediaSection}

    <div class="media-info">
      <div class="info-box">
        <div class="info-label">PROGRAMA</div>
        <div class="info-value">${escapeHtml(programDisplayName)}</div>
      </div>
      <div class="info-box">
        <div class="info-label">HORARIO</div>
        <div class="info-value">${escapeHtml(format12Hour(row.hora_programa))}</div>
      </div>
      <div class="info-box">
        <div class="info-label">RATING</div>
        <div class="info-value rating-value">${formatNumber(rating)}</div>
      </div>
      <div class="info-box info-box--relevancia">
        <div class="info-label">RELEVANCIA</div>
        <div class="info-value">${escapeHtml(fmt(row.relevancia))}</div>
      </div>
    </div>

    ${termsSection}
    ${summarySection}
    ${transcriptionSection}
  `;
  
  // Agregar event listener para expandir/contraer
  card.addEventListener('click', () => {
    toggleCardExpansion(card);
  });
  
  // Cargar thumbnail desde Supabase
  loadThumbnailFromSupabase(row.id).then(thumbnailData => {
    if (thumbnailData && thumbnailData.thumbnail_data) {
      const video = card.querySelector('.video');
      if (video) {
        video.poster = thumbnailData.thumbnail_data;
        // Marcar el botón como capturado
        const cameraBtn = card.querySelector('.camera-btn');
        if (cameraBtn) {
          cameraBtn.innerHTML = '✅';
          cameraBtn.style.background = 'var(--ok)';
          cameraBtn.title = 'Frame capturado - Click para cambiar';
        }
        console.log('📷 Thumbnail cargado desde Supabase para video:', row.id);
      }
    }
  }).catch(error => {
    console.error('❌ Error al cargar thumbnail desde Supabase:', error);
  });
  
  // Agregar event listener para tooltip con delay
  let tooltipTimer;
  
  card.addEventListener('mouseenter', () => {
    tooltipTimer = setTimeout(() => {
      const tooltip = card.querySelector('.tooltip');
      if (tooltip) {
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
        console.log('🔍 Tooltip mostrado para tarjeta:', row.id);
      }
    }, 3000); // 3 segundos de delay
  });
  
  card.addEventListener('mouseleave', () => {
    clearTimeout(tooltipTimer);
    const tooltip = card.querySelector('.tooltip');
    if (tooltip) {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
    }
  });
  
  return card;
}

// Función para expandir/contraer tarjetas
function toggleCardExpansion(card) {
  const isExpanded = card.classList.contains('expanded');
  
  // Contraer todas las tarjetas expandidas y detener su reproducción
  document.querySelectorAll('.alert-card.expanded').forEach(expandedCard => {
    pauseCardMedia(expandedCard);
    expandedCard.classList.remove('expanded');
  });
  
  // Si la tarjeta no estaba expandida, expandirla
  if (!isExpanded) {
    card.classList.add('expanded');
  }
}

// Función para cerrar tarjeta expandida
function closeExpandedCard(card) {
  if (card) {
    pauseCardMedia(card);
    card.classList.remove('expanded');
  }
}

// Función para ocultar tarjeta de video
function hideVideoCard(button) {
  const card = button.closest('.alert-card');
  if (card) {
    pauseCardMedia(card);

    // Cerrar si está expandida
    card.classList.remove('expanded');

    // Marcar como oculta
    card.classList.add('hidden-card');
    card.dataset.hidden = 'true';

    // Cambiar el ícono del botón a "ojo tachado"
    const hideBtn = card.querySelector('.hide-btn');
    if (hideBtn) {
      hideBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
      hideBtn.title = 'Mostrar video';
      hideBtn.onclick = (e) => {
        e.stopPropagation();
        showVideoCard(hideBtn);
      };
    }

    // Mostrar notificación
    showToast('Video oculto - Usa el botón del menú para ver videos ocultos');

    console.log('🙈 Tarjeta oculta:', card.dataset.id);

    // Actualizar contador de videos ocultos
    updateHiddenCount();
  }
}

// Función para mostrar tarjeta de video
function showVideoCard(button) {
  const card = button.closest('.alert-card');
  if (card) {
    // Quitar marca de oculta
    card.classList.remove('hidden-card');
    card.dataset.hidden = 'false';

    // Restaurar el ícono del botón a "ojo normal"
    const hideBtn = card.querySelector('.hide-btn');
    if (hideBtn) {
      hideBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
      hideBtn.title = 'Ocultar video';
      hideBtn.onclick = (e) => {
        e.stopPropagation();
        hideVideoCard(hideBtn);
      };
    }

    // Mostrar notificación
    showToast('Video visible de nuevo');

    console.log('👁️ Tarjeta visible:', card.dataset.id);

    // Actualizar contador de videos ocultos
    updateHiddenCount();
  }
}

// Función para actualizar contador de videos ocultos
function updateHiddenCount() {
  const hiddenCount = document.querySelectorAll('.alert-card.hidden-card').length;
  const toggleBtn = document.getElementById('btnToggleHidden');
  if (toggleBtn) {
    const countSpan = toggleBtn.querySelector('.hidden-count');
    if (countSpan) {
      countSpan.textContent = hiddenCount > 0 ? ` (${hiddenCount})` : '';
    }

    // Mostrar/ocultar botón según si hay videos ocultos
    if (hiddenCount > 0) {
      toggleBtn.style.display = 'flex';
    } else {
      toggleBtn.style.display = 'none';
    }
  }
}

// Variable para rastrear si se están mostrando los videos ocultos
let showingHidden = false;

// Función para toggle de videos ocultos
function toggleHiddenCards() {
  showingHidden = !showingHidden;
  const toggleBtn = document.getElementById('btnToggleHidden');

  if (showingHidden) {
    // Mostrar todos los videos (incluidos los ocultos)
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

    showToast('Mostrando videos ocultos (en gris)');
  } else {
    // Ocultar los videos marcados como ocultos
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

    showToast('Videos ocultos de nuevo');
  }
}

// Función para formatear fecha a formato corto
function formatShortDate(dateString) {
  if (!dateString) return 'Sin fecha';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Fecha inválida';
  
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 
                  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month}. ${year}`;
}

// Función para formatear hora a formato 12 horas
function format12Hour(timeString) {
  if (!timeString) return 'Sin hora';
  
  // Si ya tiene formato HH:MM:SS, usarlo directamente
  if (timeString.includes(':')) {
    const [hours, minutes, seconds] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  }
  
  return timeString;
}

// Función para limpiar y capitalizar nombres de medios/programas
const MEDIA_NAME_ALIASES = {
  'color vision': 'Color Visión',
  'cdn': 'CDN',
  'cdn37': 'CDN 37',
  'cdn 37': 'CDN 37',
  'antena': 'Antena',
  'telecentro': 'Telecentro',
  'ritmo': 'Ritmo',
  'super q': 'Super Q',
  'superq': 'Super Q',
  'rumba': 'Rumba',
  'telesistema': 'Telesistema',
  'teleantillas': 'Teleantillas',
  'tele antillas': 'Teleantillas',
  'rnn': 'RNN',
  'rtvd': 'RTVD',
  'teleuniverso': 'Teleuniverso',
  'cinevision': 'Cinevisión',
  'cine vision': 'Cinevisión',
  'panorama': 'Panorama',
  'telecentro 13': 'Telecentro 13',
  'sin programa': 'Sin programa',
  'sin medio': 'Sin medio'
};

const MEDIA_WORD_REPLACEMENTS = [
  [/color\s*visi[oó]n/gi, 'Color Visión'],
  [/cdn\s*37/gi, 'CDN 37'],
  [/super\s*q/gi, 'Super Q'],
  [/tele\s*antillas/gi, 'Teleantillas'],
  [/tele\s*centro/gi, 'Telecentro'],
  [/cine\s*visi[oó]n/gi, 'Cinevisión'],
  [/tele\s*sistema/gi, 'Telesistema'],
  [/tele\s*universo/gi, 'Teleuniverso']
];

const MEDIA_ACRONYMS = new Set(['CDN', 'RNN', 'RTVD', 'Q', 'PM', 'PRM']);

function normalizeRawName(name) {
  return (name ?? '').toString().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatMediaWord(word) {
  if (!word) return word;

  const bare = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (MEDIA_NAME_ALIASES[bare]) return MEDIA_NAME_ALIASES[bare];

  const cdnMatch = word.match(/^cdn(\d+)$/i);
  if (cdnMatch) return `CDN ${cdnMatch[1]}`;

  const upper = word.toUpperCase();
  if (MEDIA_ACRONYMS.has(upper)) return upper;

  if (/^\d+$/.test(word)) return word;

  if (/[A-Z]/.test(word) && word !== word.toLowerCase()) return word;

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatMediaName(name) {
  if (!name) return '';

  let text = normalizeRawName(name);
  if (!text) return text;

  const lookupKey = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (MEDIA_NAME_ALIASES[lookupKey]) return MEDIA_NAME_ALIASES[lookupKey];

  MEDIA_WORD_REPLACEMENTS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  return text
    .split(/\s+/)
    .map(formatMediaWord)
    .join(' ');
}

function cleanDisplayName(name) {
  return formatMediaName(name);
}

// Función para extraer el primer término del programa
function extractProgramName(filename) {
  if (!filename) return 'Sin programa';
  
  // Remover extensión
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Buscar el primer número que no esté pegado a una letra
  const match = nameWithoutExt.match(/^([^0-9]*[A-Za-z][^0-9]*?)(?=\s*\d)/);
  
  if (match) {
    return cleanDisplayName(match[1].trim());
  }
  
  // Si no hay números o están todos pegados a letras, devolver todo hasta el primer espacio seguido de número
  const fallbackMatch = nameWithoutExt.match(/^([A-Za-z][A-Za-z0-9]*\s*[A-Za-z]*)/);
  if (fallbackMatch) {
    return cleanDisplayName(fallbackMatch[1].trim());
  }
  
  return cleanDisplayName(nameWithoutExt);
}

// Función para capitalizar primera letra
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

const TOP_CHANNELS = [
  { id: 'color', name: 'Color Visión' },
  { id: 'telesistema', name: 'Telesistema' },
  { id: 'teleantillas', name: 'Teleantillas' },
  { id: 'cdn', name: 'CDN' },
  { id: 'rnn', name: 'RNN' },
  { id: 'telecentro', name: 'Telecentro' },
  { id: 'antena', name: 'Antena' },
  { id: 'ritmo', name: 'Ritmo' },
  { id: 'superq', name: 'Super Q' },
  { id: 'rumba', name: 'Rumba' }
];

const CHANNEL_NAMES = Object.fromEntries(TOP_CHANNELS.map(ch => [ch.id, ch.name]));

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRating(min, max, seed) {
  const range = max - min + 1;
  return min + (hashString(String(seed)) % range);
}

function detectChannel(programName) {
  const name = (programName || '').toLowerCase();
  if (name.includes('telesistema')) return 'telesistema';
  if (name.includes('teleantillas')) return 'teleantillas';
  if (name.includes('telecentro')) return 'telecentro';
  if (name.includes('cdn')) return 'cdn';
  if (name.includes('rnn')) return 'rnn';
  if (name.includes('antena')) return 'antena';
  if (name.includes('ritmo')) return 'ritmo';
  if (name.includes('super q') || name.includes('superq')) return 'superq';
  if (name.includes('rumba')) return 'rumba';
  if (name.includes('color') || name.includes('vision')) return 'color';
  return '';
}

// Función para calcular el rating basado en el programa/canal (estable por registro)
function calculateRating(programName, seed) {
  if (!programName) programName = '';
  const name = programName.toLowerCase();
  const stableSeed = seed ?? programName;

  if (name.includes('panorama') || name.includes('luna')) {
    return seededRating(8434, 11454, stableSeed);
  }

  if (name.includes('cdn') || name.includes('teleuniverso') || name.includes('rnn') || name.includes('cinevision')) {
    return seededRating(45790, 84533, stableSeed);
  }

  if (name.includes('color') || name.includes('vision') || name.includes('rtvd') || name.includes('teleantillas') || name.includes('telesistema') || name.includes('antena')) {
    return seededRating(87332, 132413, stableSeed);
  }

  return seededRating(13432, 45334, stableSeed);
}

function updateTopRatingSection() {
  const totals = Object.fromEntries(TOP_CHANNELS.map(ch => [ch.id, 0]));
  const counts = Object.fromEntries(TOP_CHANNELS.map(ch => [ch.id, 0]));
  const cards = typeof getClientScopedCards === 'function' ? getClientScopedCards() : allCards;

  cards.forEach(card => {
    const channel = card.dataset.channel;
    const rating = parseInt(card.dataset.rating, 10) || 0;
    if (!channel || totals[channel] === undefined) return;
    totals[channel] += rating;
    counts[channel] += 1;
  });

  const ranked = TOP_CHANNELS
    .map(ch => ({ ...ch, total: totals[ch.id], count: counts[ch.id] }))
    .sort((a, b) => b.total - a.total);

  const container = document.querySelector('.top-rating-container');
  if (container) {
    ranked.forEach((ch, index) => {
      const item = container.querySelector(`[data-channel="${ch.id}"]`);
      if (!item) return;
      item.querySelector('.top-rating-position').textContent = index + 1;
      item.querySelector('.top-rating-value').textContent = formatNumber(ch.total);
      container.appendChild(item);
    });
  }

  const leader = ranked[0];
  const totalEl = document.getElementById('topRatingTotal');
  if (totalEl && leader) {
    totalEl.dataset.channel = leader.id;
    totalEl.querySelector('.total-label').textContent =
      `🏆 ${leader.name} - ${leader.count} contenido${leader.count === 1 ? '' : 's'}:`;
    totalEl.querySelector('.total-value').textContent = formatNumber(leader.total);
  }
}

// Función para formatear número con separador de miles
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


// Simple escape para evitar XSS si traes texto desde BD
function escapeHtml(str){
  return (str ?? '').toString()
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// Renderiza un lote (append al final)
function appendBatch(rows){
  rows.forEach(r => {
    const card = renderAlertCard(r);
    allCards.push(card);
    console.log('📄 Tarjeta agregada:', r.id, 'Total allCards:', allCards.length);
  });
  applyAllFilters();
  updateTopRatingSection();
  if (typeof refreshAnalytics === 'function') refreshAnalytics();
}

// Prepend (para inserciones en tiempo real)
function prependOne(row){
  const el = renderAlertCard(row);
  allCards.unshift(el);
  console.log('🆕 Nueva alerta agregada al inicio:', row.id, 'Total allCards:', allCards.length);
  applyAllFilters();
  updateTopRatingSection();
  if (typeof refreshAnalytics === 'function') refreshAnalytics();
}

// ====== Acciones ======
async function loadFirstPage(){
  btnActualizar.disabled = true;
  btnCargarMas.disabled = true;
  try{
    offset = 0;
    feedEl.innerHTML = '';
    allCards = []; // Limpiar array de tarjetas
    console.log('🔄 Cargando todos los videos disponibles...');
    
    // Cargar todos los videos disponibles (sin límite de PAGE_SIZE)
    const rows = await fetchAlerts(100, offset); // Aumentar límite para cargar más videos
    console.log('📊 Registros obtenidos:', rows.length);
    
    if (rows.length > 0) {
      appendBatch(rows);
      setClientMode(currentClientMode, { silent: true });
      offset += rows.length;
      showToast(`✅ Cargados ${rows.length} registros`);
      console.log('📊 Total de tarjetas en allCards:', allCards.length);
      
      // Mostrar/ocultar botón "Cargar más" según si hay más videos
      if (rows.length < 100) {
        btnCargarMas.style.display = 'none';
        console.log('📊 Todos los videos cargados, ocultando botón "Cargar más"');
      } else {
        showLoadMoreButton();
        console.log('📊 Hay más videos disponibles, mostrando botón "Cargar más"');
      }
    } else {
      // Mostrar mensaje de no hay datos
      feedEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px;">
          <h3>📭 No hay alertas disponibles</h3>
          <p>No se encontraron registros en la tabla 'alertas_medios'.</p>
          <p>Verifica que el sistema de análisis de videos esté insertando datos.</p>
        </div>
      `;
      showToast('⚠️ No hay datos disponibles', 'error');
    }
  }catch(e){
    showToast('Error cargando: ' + e.message, 'error');
    console.error('❌ Error en loadFirstPage:', e);
    
    // Mostrar error en la interfaz
    feedEl.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px; border-color: var(--danger);">
        <h3>❌ Error de conexión</h3>
        <p>No se pudo cargar los datos desde Supabase.</p>
        <p>Error: ${e.message}</p>
      </div>
    `;
  }finally{
    btnActualizar.disabled = false;
    btnCargarMas.disabled = false;
  }
}

async function loadMore(){
  btnCargarMas.disabled = true;
  try{
    const rows = await fetchAlerts(PAGE_SIZE, offset);
    if (rows.length === 0){
      showToast('No hay más registros');
      btnCargarMas.style.display = 'none'; // Ocultar botón si no hay más datos
    } else {
      appendBatch(rows);
      offset += rows.length;
      showToast(`✅ Cargados ${rows.length} registros adicionales`);
      
      // Si se cargaron menos registros que PAGE_SIZE, significa que no hay más
      if (rows.length < PAGE_SIZE) {
        btnCargarMas.style.display = 'none';
        console.log('📊 No hay más videos disponibles, ocultando botón "Cargar más"');
      }
    }
  }catch(e){
    showToast('Error cargando más: ' + e.message, 'error');
    console.error(e);
  }finally{
    btnCargarMas.disabled = false;
  }
}

// Función de guardado eliminada - solo lectura de datos

// ====== Realtime (INSERT/UPDATE/DELETE) ======
function enableRealtime(){
  const channel = supabaseClient
    .channel('alertas-feed')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'alertas_medios' },
      payload => {
        const row = payload.new || payload.record || payload;
        prependOne(row);
        showToast('🆕 Nueva alerta recibida');
      }
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'alertas_medios' },
      payload => {
        const row = payload.new || payload.record || payload;
        // Actualizar la tarjeta existente si es necesario
        showToast('🔄 Alerta actualizada');
        loadFirstPage(); // Recargar para simplificar
      }
    )
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'alertas_medios' },
      payload => {
        showToast('🗑️ Alerta eliminada');
        loadFirstPage(); // Recargar para simplificar
      }
    )
    .subscribe();

  // Manejar errores de conexión
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('✅ Conectado al canal de tiempo real');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ Error en el canal de tiempo real');
      showToast('Error en conexión en tiempo real', 'error');
    }
  });
}

// ====== Filtros ======
let currentFilter = null;
let currentChannelFilter = null;
let currentMediaTypeFilter = 'all';
let currentClientMode = 'edesur';
let allCards = [];
let sortOrder = 'desc'; // 'desc' = más recientes primero, 'asc' = más antiguos primero

function cardMatchesFilters(card) {
  if (currentMediaTypeFilter !== 'all' && card.dataset.mediatype !== currentMediaTypeFilter) {
    return false;
  }

  if (currentChannelFilter) {
    if (card.dataset.channel !== currentChannelFilter) {
      return false;
    }
  }

  if (typeof FIXED_CLIENT_MODE !== 'undefined' && FIXED_CLIENT_MODE) {
    if (!cardMatchesAnyClientTerm(card, FIXED_CLIENT_MODE)) {
      return false;
    }
  }

  if (currentFilter) {
    const termino = (card.dataset.termino || '').toLowerCase();
    const ejecutivo = (card.dataset.ejecutivo || '').toLowerCase();
    const contexto = (card.dataset.contexto || '').toLowerCase();
    const transcripcion = (card.dataset.transcripcion || '').toLowerCase();
    const filter = currentFilter.toLowerCase();

    if (!termino.includes(filter) &&
        !ejecutivo.includes(filter) &&
        !contexto.includes(filter) &&
        !transcripcion.includes(filter)) {
      return false;
    }
  }

  return true;
}

function applyAllFilters() {
  const feed = document.getElementById('feed');
  if (!feed) return;

  // Quitar tarjetas del feed sin destruirlas (preserva thumbnails y estado del video)
  allCards.forEach(card => {
    if (card.parentNode === feed) {
      feed.removeChild(card);
    }
  });

  const visibleCards = allCards.filter(cardMatchesFilters);
  visibleCards.forEach(card => feed.appendChild(card));
  reorganizeCards();

  console.log('📊 Tarjetas visibles después de filtros:', visibleCards.length);
  return visibleCards.length;
}

function getMediaTypeLabel(type) {
  if (type === 'video') return 'videos';
  if (type === 'audio') return 'audios';
  return 'contenidos';
}

// Función para filtrar por canal (desde el top rating)
function filterByChannel(channel) {
  console.log('📺 Filtrando por canal:', channel);
  
  if (currentChannelFilter === channel) {
    currentChannelFilter = null;
    document.querySelectorAll('.top-rating-item').forEach(item => {
      item.classList.remove('active');
    });
    document.getElementById('topRatingTotal')?.classList.remove('active');
    
    const visibleCount = applyAllFilters();
    showToast(`Mostrando todos los contenidos (${visibleCount})`);
    return;
  }
  
  currentChannelFilter = channel;
  
  document.querySelectorAll('.top-rating-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.channel === channel) {
      item.classList.add('active');
    }
  });
  
  const totalEl = document.getElementById('topRatingTotal');
  if (totalEl) {
    if (totalEl.dataset.channel === channel) {
      totalEl.classList.add('active');
    } else {
      totalEl.classList.remove('active');
    }
  }
  
  const visibleCount = applyAllFilters();
  
  const channelDisplayName = CHANNEL_NAMES[channel] || channel;
  showToast(`📺 ${channelDisplayName}: ${visibleCount} contenidos`);
  console.log('📺 Contenidos encontrados para', channelDisplayName + ':', visibleCount);
}

function filterByMediaType(type) {
  if (!type || type === currentMediaTypeFilter) return;

  console.log('🎛️ Filtrando por tipo de medio:', type);
  currentMediaTypeFilter = type;

  document.querySelectorAll('.media-type-tag').forEach(tag => {
    tag.classList.toggle('active', tag.dataset.mediaType === type);
  });

  const visibleCount = applyAllFilters();
  const label = getMediaTypeLabel(type === 'all' ? null : type);
  showToast(type === 'all'
    ? `Mostrando todos los contenidos (${visibleCount})`
    : `Mostrando solo ${label} (${visibleCount})`);
}

const CLIENT_DEFAULT_FILTERS = {
  edesur: 'edesur',
  intrant: 'morrison',
  presidencia: 'abinader'
};

const CLIENT_MODE_LABELS = {
  edesur: 'EDESUR',
  intrant: 'INTRANT',
  presidencia: 'PRESIDENCIA'
};

const VALID_CLIENT_MODES = Object.keys(CLIENT_DEFAULT_FILTERS);
const FIXED_CLIENT_MODE = (typeof window.FIXED_CLIENT_MODE === 'string' && VALID_CLIENT_MODES.includes(window.FIXED_CLIENT_MODE))
  ? window.FIXED_CLIENT_MODE
  : null;

function getDefaultClientMode() {
  return FIXED_CLIENT_MODE || 'edesur';
}

function initFixedClientPage() {
  if (!FIXED_CLIENT_MODE) return;

  document.querySelector('.client-switch-container')?.remove();

  document.querySelectorAll('.filter-tag').forEach(tag => {
    if (tag.dataset.client !== FIXED_CLIENT_MODE) {
      tag.remove();
    }
  });

  const filterTagsEl = document.getElementById('filterTags');
  if (filterTagsEl) {
    filterTagsEl.dataset.clientMode = FIXED_CLIENT_MODE;
  }
}

const CLIENT_FILTER_TERMS_FALLBACK = {
  edesur: ['edesur', 'apagones', 'apagon', 'punta-catalina', 'jose-actis', 'edenorte', 'pacto-electrico', 'marranzini'],
  intrant: ['morrison', 'intrant', 'digesett', 'milton morrison'],
  presidencia: ['abinader', 'prm', 'luis abinader']
};

function getClientFilterTerms(mode) {
  if (!mode) return [];
  const tags = document.querySelectorAll(`.filter-tag[data-client="${mode}"]`);
  if (tags.length) {
    return Array.from(tags).map(tag => tag.dataset.filter).filter(Boolean);
  }
  return CLIENT_FILTER_TERMS_FALLBACK[mode] || [];
}

function getClientTermEntries(mode) {
  const tags = document.querySelectorAll(`.filter-tag[data-client="${mode}"]`);
  if (tags.length) {
    return Array.from(tags).map(tag => ({
      filter: tag.dataset.filter,
      label: tag.textContent.trim()
    }));
  }
  return (CLIENT_FILTER_TERMS_FALLBACK[mode] || []).map(filter => ({
    filter,
    label: filter
  }));
}

function getCardSearchText(card) {
  return [
    card.dataset.termino,
    card.dataset.ejecutivo,
    card.dataset.contexto,
    card.dataset.transcripcion,
    card.dataset.nombrearchivo,
    card.dataset.nombremedio
  ].join(' ').toLowerCase();
}

function cardMatchesAnyClientTerm(card, mode) {
  const terms = getClientFilterTerms(mode);
  if (!terms.length) return true;
  const haystack = getCardSearchText(card);
  return terms.some(term => haystack.includes(String(term).toLowerCase()));
}

function getClientScopedCards() {
  if (FIXED_CLIENT_MODE) {
    return allCards.filter(card => cardMatchesAnyClientTerm(card, FIXED_CLIENT_MODE));
  }
  return allCards;
}

function clearChannelFilter() {
  currentChannelFilter = null;
  document.querySelectorAll('.top-rating-item').forEach(item => {
    item.classList.remove('active');
  });
  document.getElementById('topRatingTotal')?.classList.remove('active');
}

function clearAllFilters() {
  clearChannelFilter();

  currentMediaTypeFilter = 'all';
  document.querySelectorAll('.media-type-tag').forEach(tag => {
    tag.classList.toggle('active', tag.dataset.mediaType === 'all');
  });

  const defaultMode = getDefaultClientMode();
  if (!FIXED_CLIENT_MODE) {
    currentClientMode = defaultMode;
    const filterTagsEl = document.getElementById('filterTags');
    if (filterTagsEl) {
      filterTagsEl.dataset.clientMode = defaultMode;
    }
    document.querySelectorAll('.client-mode-tag').forEach(tag => {
      tag.classList.toggle('active', tag.dataset.client === defaultMode);
    });
    filterCards(CLIENT_DEFAULT_FILTERS[defaultMode], { silent: true });
  } else {
    clearTermFilter({ silent: true });
  }

  showToast('Filtros restablecidos');
}

function clearTermFilter(options = {}) {
  currentFilter = null;
  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.classList.remove('active');
  });
  const visibleCount = applyAllFilters();
  if (!options.silent) {
    showToast(`Mostrando todos los contenidos (${visibleCount})`);
  }
  return visibleCount;
}

function setClientMode(mode, options = {}) {
  if (!VALID_CLIENT_MODES.includes(mode)) return;
  if (FIXED_CLIENT_MODE && mode !== FIXED_CLIENT_MODE) return;

  const switched = currentClientMode !== mode;
  currentClientMode = mode;

  const filterTagsEl = document.getElementById('filterTags');
  if (filterTagsEl) {
    filterTagsEl.dataset.clientMode = mode;
  }

  document.querySelectorAll('.client-mode-tag').forEach(tag => {
    tag.classList.toggle('active', tag.dataset.client === mode);
  });

  if (FIXED_CLIENT_MODE) {
    if (switched) {
      clearTermFilter({ silent: options.silent || !switched });
    } else if (currentFilter) {
      filterCards(currentFilter, { silent: true });
    } else {
      clearTermFilter({ silent: true });
    }
    if (!options.silent && switched) {
      showToast(`Modo ${CLIENT_MODE_LABELS[mode]} activo`);
    }
    if (typeof refreshAnalytics === 'function') refreshAnalytics();
    return;
  }

  const defaultFilter = CLIENT_DEFAULT_FILTERS[mode];
  const nextFilter = switched ? defaultFilter : (currentFilter || defaultFilter);
  filterCards(nextFilter, { silent: options.silent || !switched });

  if (!options.silent && switched) {
    showToast(`Modo ${CLIENT_MODE_LABELS[mode]} activo`);
  }
  if (typeof refreshAnalytics === 'function') refreshAnalytics();
}

function filterCards(filter, options = {}) {
  if (!filter) return;

  console.log('🔍 Filtrando por:', filter);
  console.log('📊 Total de tarjetas disponibles:', allCards.length);
  currentFilter = filter;
  
  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.classList.remove('active');
  });
  
  const activeTag = document.querySelector(
    `.filter-tag[data-filter="${filter}"][data-client="${currentClientMode}"]`
  );
  if (activeTag) {
    activeTag.classList.add('active');
  }
  
  const visibleCount = applyAllFilters();
  if (!options.silent) {
    showToast(`Filtrado por: ${filter} (${visibleCount} contenidos)`);
  }
}

// Función para cambiar el ordenamiento
function toggleSortOrder() {
  sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
  console.log('🔄 Cambiando ordenamiento a:', sortOrder === 'desc' ? 'Más recientes' : 'Más antiguos');
  
  // Reorganizar las tarjetas según el nuevo orden
  reorganizeCards();
  
  showToast(sortOrder === 'desc' ? '📅 Ordenado: Más recientes primero' : '📅 Ordenado: Más antiguos primero');
}

// Función para reorganizar las tarjetas según el ordenamiento
function reorganizeCards() {
  const feed = document.getElementById('feed');
  const visibleCards = Array.from(feed.children);
  
  // Ordenar las tarjetas por fecha
  visibleCards.sort((a, b) => {
    const dateA = new Date(a.dataset.date || 0);
    const dateB = new Date(b.dataset.date || 0);
    
    if (sortOrder === 'desc') {
      return dateB - dateA; // Más recientes primero
    } else {
      return dateA - dateB; // Más antiguos primero
    }
  });
  
  // Reorganizar en el DOM
  visibleCards.forEach(card => {
    feed.appendChild(card);
  });
  
  console.log('🔄 Tarjetas reorganizadas con ordenamiento:', sortOrder);
}

// Función para actualizar el texto del botón alternativo
function updateSortButtonText() {
  const sortButton = document.getElementById('sortButton');
  const sortText = sortButton?.querySelector('.sort-text');
  
  if (sortText) {
    sortText.textContent = sortOrder === 'desc' ? 'Más recientes' : 'Más antiguos';
  }
}

// ====== Forzar recarga de caché ======
console.log('🚀 Aplicación cargada - Versión 2.0');
console.log('📅 Fecha de carga:', new Date().toLocaleString());

// Verificar que todos los archivos se cargaron correctamente
const checkFilesLoaded = () => {
  const stylesLoaded = document.querySelector('link[href*="styles.css"]') !== null;
  const scriptLoaded = document.querySelector('script[src*="script.js"]') !== null;
  
  console.log('📁 Archivos cargados:');
  console.log('  - CSS:', stylesLoaded ? '✅' : '❌');
  console.log('  - JS:', scriptLoaded ? '✅' : '❌');
  
  if (!stylesLoaded || !scriptLoaded) {
    console.warn('⚠️ Algunos archivos no se cargaron correctamente');
    showToast('⚠️ Error de carga - Recarga la página', 'error');
  }
};

// ====== Listeners ======
document.addEventListener('DOMContentLoaded', () => {
  checkFilesLoaded();
  // Verificar que los elementos existan antes de agregar listeners
  if (btnActualizar) {
    btnActualizar.addEventListener('click', loadFirstPage);
    console.log('✅ Listener agregado a btnActualizar');
  } else {
    console.error('❌ btnActualizar no encontrado');
  }
  
  if (btnCargarMas) {
    btnCargarMas.addEventListener('click', loadMore);
    console.log('✅ Listener agregado a btnCargarMas');
  } else {
    console.error('❌ btnCargarMas no encontrado');
  }
  
  if (btnForzarRecarga) {
    btnForzarRecarga.addEventListener('click', () => {
      showToast('🔄 Forzando recarga completa...');
      // Forzar recarga sin caché
      window.location.reload(true);
    });
    console.log('✅ Listener agregado a btnForzarRecarga');
  } else {
    console.error('❌ btnForzarRecarga no encontrado');
  }
  
  // Botones adicionales (funcionalidad futura)
  if (btnExportar) {
    btnExportar.addEventListener('click', () => {
      showToast('Funcionalidad de exportación en desarrollo', 'error');
    });
    console.log('✅ Listener agregado a btnExportar');
  } else {
    console.error('❌ btnExportar no encontrado');
  }
  
  if (btnDrive) {
    btnDrive.addEventListener('click', () => {
      showToast('Funcionalidad de Drive en desarrollo', 'error');
    });
    console.log('✅ Listener agregado a btnDrive');
  } else {
    console.error('❌ btnDrive no encontrado');
  }

  if (btnToggleHidden) {
    btnToggleHidden.addEventListener('click', toggleHiddenCards);
    console.log('✅ Listener agregado a btnToggleHidden');
  } else {
    console.error('❌ btnToggleHidden no encontrado');
  }

  // Agregar listeners a los tags de filtro
  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (tag.dataset.client !== currentClientMode) return;
      const filter = tag.dataset.filter;
      console.log('🏷️ Tag clickeado:', filter, 'Filtro actual:', currentFilter);
      filterCards(filter);
    });
  });

  document.querySelectorAll('.client-mode-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setClientMode(tag.dataset.client);
    });
  });

  document.querySelectorAll('.media-type-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mediaType = tag.dataset.mediaType;
      filterByMediaType(mediaType);
    });
  });

  const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
  if (btnLimpiarFiltros) {
    btnLimpiarFiltros.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearAllFilters();
    });
  }
  
  // Agregar listener al switch de ordenamiento
  const sortToggle = document.getElementById('sortToggle');
  const sortButton = document.getElementById('sortButton');
  
  if (sortToggle) {
    sortToggle.addEventListener('change', () => {
      toggleSortOrder();
    });
    console.log('✅ Listener agregado al switch de ordenamiento');
    
    // Detectar si el switch se renderiza correctamente
    setTimeout(() => {
      const switchContainer = document.querySelector('.sort-switch-container');
      const slider = document.querySelector('.slider');
      
      if (switchContainer && slider) {
        const computedStyle = window.getComputedStyle(slider);
        const width = computedStyle.width;
        const height = computedStyle.height;
        
        // Si el switch no se renderiza correctamente, mostrar botón alternativo
        if (width === '0px' || height === '0px' || width === 'auto' || height === 'auto') {
          console.warn('⚠️ Switch no se renderiza correctamente, usando botón alternativo');
          switchContainer.style.display = 'none';
          if (sortButton) {
            sortButton.style.display = 'flex';
          }
        }
      }
    }, 1000);
  } else {
    console.error('❌ sortToggle no encontrado');
  }
  
  // Listener para el botón alternativo
  if (sortButton) {
    sortButton.addEventListener('click', () => {
      toggleSortOrder();
      updateSortButtonText();
    });
    console.log('✅ Listener agregado al botón de ordenamiento alternativo');
  }
  
  
  
  console.log('🏷️ Total de tags de filtro configurados:', document.querySelectorAll('.filter-tag').length);

  initFixedClientPage();
  if (typeof initAppTabs === 'function') initAppTabs();
  enableRealtime();
  setClientMode(getDefaultClientMode(), { silent: true });
  loadFirstPage();
});

// ====== Función de prueba para verificar datos ======
async function testSupabaseConnection(){
  try {
    console.log('🔍 Probando conexión con Supabase...');
    console.log('URL:', window.SUPABASE_URL);
    console.log('Key:', window.SUPABASE_ANON_KEY ? 'Presente' : 'Faltante');
    
    const { data, error } = await supabaseClient
      .from('alertas_medios')
      .select('*')
      .order('fecha_detencion', { ascending: false })  // 👈 Ordenar por fecha de detección (más reciente primero)
      .limit(5);

    if (error) {
      console.error('❌ Error al conectar con Supabase:', error);
      showToast('Error de conexión: ' + error.message, 'error');
      return;
    }

    console.log('✅ Conexión exitosa. Datos recibidos:', data);
    console.log('📊 Total de registros:', data ? data.length : 0);
    
    if (data && data.length > 0) {
      console.log('📋 Estructura del primer registro:', Object.keys(data[0]));
      console.log('📄 Primer registro completo:', data[0]);
      showToast(`✅ Conexión OK. ${data.length} registros encontrados.`);
      
      // Mostrar los datos en la interfaz respetando el ordenamiento
      if (data.length > 0) {
        feedEl.innerHTML = '';
        allCards = []; // Limpiar array de tarjetas
        data.forEach(record => {
          const card = renderAlertCard(record);
          feedEl.appendChild(card);
          allCards.push(card);
        });
        console.log('📊 Total de tarjetas en allCards:', allCards.length);
      }
    } else {
      console.log('⚠️ No hay datos en la tabla alertas_medios');
      showToast('⚠️ Conexión OK pero no hay datos en la tabla', 'error');
      
      // Mostrar mensaje de no hay datos
      feedEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px;">
          <h3>📭 No hay alertas disponibles</h3>
          <p>La tabla 'alertas_medios' está vacía o no contiene datos.</p>
          <p>Verifica que el sistema de análisis de videos esté insertando datos.</p>
        </div>
      `;
    }
  } catch (e) {
    console.error('❌ Error inesperado:', e);
    showToast('Error inesperado: ' + e.message, 'error');
    
    // Mostrar error en la interfaz
    feedEl.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px; border-color: var(--danger);">
        <h3>❌ Error de conexión</h3>
        <p>No se pudo conectar con Supabase.</p>
        <p>Error: ${e.message}</p>
      </div>
    `;
  }
}
