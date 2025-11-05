// ====== Supabase Init ======
const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ====== Selectores del DOM ======
const feedEl = document.getElementById('feed');
const toastEl = document.getElementById('toast');
const btnActualizar = document.getElementById('btnActualizar');
const btnCargarMas = document.getElementById('btnCargarMas');
const btnForzarRecarga = document.getElementById('btnForzarRecarga');
const btnExportar = document.getElementById('btnExportar');
const btnDrive = document.getElementById('btnDrive');

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
    const { data, error } = await supabase
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
  
  const { data, error } = await supabase
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
  
  console.log('📄 Datos de la tarjeta:', {
    id: row.id,
    termino: card.dataset.termino,
    ejecutivo: card.dataset.ejecutivo.substring(0, 50) + '...',
    contexto: card.dataset.contexto.substring(0, 50) + '...',
    transcripcion: card.dataset.transcripcion.substring(0, 50) + '...'
  });

  const hasVideo = !!row.url_video; // url_video en lugar de video_url
  const hasTranscription = !!row.transcripcion;

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

  const videoSection = hasVideo ? `
    <div class="video-section">
      <div class="video-container">
        <button class="close-button" onclick="event.stopPropagation(); closeExpandedCard(this.closest('.alert-card'))">✕</button>
        <video class="video" controls preload="metadata" crossorigin="anonymous" onerror="this.parentElement.innerHTML = '<div style=\\'display:flex;align-items:center;justify-content:center;height:300px;opacity:.7;border:1px dashed var(--danger);color:var(--danger);\\'>Error al cargar video</div>'">
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
    </div>` : '';

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
        <span>${escapeHtml(formatShortDate(row.fecha_detencion || row.fecha_programa))}</span>
        <button class="camera-btn" onclick="event.stopPropagation(); captureVideoFrame(this)" title="Capturar frame actual">
          📷
        </button>
        <button class="hide-btn" onclick="event.stopPropagation(); hideVideoCard(this)" title="Ocultar video">
          👁️
        </button>
      </div>
    </div>

    ${videoSection}

    <div class="media-info">
      <div class="info-box">
        <div class="info-label">PROGRAMA</div>
        <div class="info-value">${escapeHtml(extractProgramName(row.nombre_archivo))}</div>
      </div>
      <div class="info-box">
        <div class="info-label">HORARIO</div>
        <div class="info-value">${escapeHtml(format12Hour(row.hora_programa))}</div>
      </div>
      <div class="info-box">
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
  
  // Contraer todas las tarjetas expandidas y detener sus videos
  document.querySelectorAll('.alert-card.expanded').forEach(expandedCard => {
    const video = expandedCard.querySelector('.video');
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
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
    // Detener el video si está reproduciéndose
    const video = card.querySelector('.video');
    if (video) {
      video.pause();
      video.currentTime = 0; // Opcional: volver al inicio
    }

    card.classList.remove('expanded');
  }
}

// Función para ocultar tarjeta de video
function hideVideoCard(button) {
  const card = button.closest('.alert-card');
  if (card) {
    // Detener el video si está reproduciéndose
    const video = card.querySelector('.video');
    if (video) {
      video.pause();
      video.currentTime = 0;
    }

    // Cerrar si está expandida
    card.classList.remove('expanded');

    // Ocultar la tarjeta con animación
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';

    setTimeout(() => {
      card.style.display = 'none';

      // Mostrar notificación
      showToast('Video oculto - Recarga la página para verlo nuevamente');
    }, 300);

    console.log('🙈 Tarjeta oculta:', card.dataset.id);
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

// Función para extraer el primer término del programa
function extractProgramName(filename) {
  if (!filename) return 'Sin programa';
  
  // Remover extensión
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Buscar el primer número que no esté pegado a una letra
  const match = nameWithoutExt.match(/^([^0-9]*[A-Za-z][^0-9]*?)(?=\s*\d)/);
  
  if (match) {
    return match[1].trim();
  }
  
  // Si no hay números o están todos pegados a letras, devolver todo hasta el primer espacio seguido de número
  const fallbackMatch = nameWithoutExt.match(/^([A-Za-z][A-Za-z0-9]*\s*[A-Za-z]*)/);
  if (fallbackMatch) {
    return fallbackMatch[1].trim();
  }
  
  return nameWithoutExt;
}

// Función para capitalizar primera letra
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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
  const feed = document.getElementById('feed');
  rows.forEach(r => {
    const card = renderAlertCard(r);
    feed.appendChild(card);
    allCards.push(card);
    console.log('📄 Tarjeta agregada:', r.id, 'Total allCards:', allCards.length);
  });
}

// Prepend (para inserciones en tiempo real)
function prependOne(row){
  const feed = document.getElementById('feed');
  const el = renderAlertCard(row);
  feed.insertBefore(el, feed.firstChild);
  allCards.unshift(el);
  console.log('🆕 Nueva alerta agregada al inicio:', row.id, 'Total allCards:', allCards.length);
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
  const channel = supabase
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
let allCards = [];
let sortOrder = 'desc'; // 'desc' = más recientes primero, 'asc' = más antiguos primero

// Función para filtrar tarjetas
function filterCards(filter) {
  console.log('🔍 Filtrando por:', filter);
  console.log('📊 Total de tarjetas disponibles:', allCards.length);
  currentFilter = filter;
  
  // Actualizar estado visual de los tags
  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.classList.remove('active');
  });
  
  if (filter) {
    const activeTag = document.querySelector(`[data-filter="${filter}"]`);
    if (activeTag) {
      activeTag.classList.add('active');
    }
  }
  
  // Filtrar tarjetas
  let visibleCount = 0;
  const visibleCards = [];
  
  allCards.forEach(card => {
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
    
    console.log(`📄 Tarjeta ${cardData.id}: ${shouldShow ? 'visible' : 'oculta'}`, {
      termino, ejecutivo, contexto, transcripcion, filter
    });
  });
  
  // Reorganizar el grid para mostrar solo las tarjetas visibles
  const feed = document.getElementById('feed');
  
  // Limpiar el feed
  feed.innerHTML = '';
  
  // Agregar solo las tarjetas visibles
  visibleCards.forEach(card => {
    feed.appendChild(card);
  });
  
  console.log('📊 Tarjetas visibles después del filtro:', visibleCount);
  showToast(filter ? `Filtrado por: ${filter} (${visibleCount} videos)` : `Mostrando todos los videos (${allCards.length})`);
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

  // Agregar listeners a los tags de filtro
  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const filter = tag.dataset.filter;
      console.log('🏷️ Tag clickeado:', filter, 'Filtro actual:', currentFilter);
      console.log('📊 Total de tarjetas antes del filtro:', allCards.length);
      console.log('🏷️ Tags encontrados:', document.querySelectorAll('.filter-tag').length);
      filterCards(currentFilter === filter ? null : filter);
    });
  });
  
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

  enableRealtime();
  loadFirstPage();
});

// ====== Función de prueba para verificar datos ======
async function testSupabaseConnection(){
  try {
    console.log('🔍 Probando conexión con Supabase...');
    console.log('URL:', window.SUPABASE_URL);
    console.log('Key:', window.SUPABASE_ANON_KEY ? 'Presente' : 'Faltante');
    
    const { data, error } = await supabase
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
