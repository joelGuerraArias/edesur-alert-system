// ====== Supabase Init ======
const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ====== Selectores del DOM ======
const feedEl = document.getElementById('feed');
const toastEl = document.getElementById('toast');
const btnActualizar = document.getElementById('btnActualizar');
const btnCargarMas = document.getElementById('btnCargarMas');
const btnExportar = document.getElementById('btnExportar');
const btnDrive = document.getElementById('btnDrive');

// Verificar que los elementos existan
console.log('🔍 Verificando elementos del DOM:');
console.log('feedEl:', feedEl);
console.log('btnActualizar:', btnActualizar);
console.log('btnCargarMas:', btnCargarMas);
console.log('btnExportar:', btnExportar);
console.log('btnDrive:', btnDrive);

// ====== Config / Estado ======
const PAGE_SIZE = 5;
let offset = 0;

// ====== Utilidades ======
function showToast(msg, type='ok'){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type === 'error' ? 'err' : 'ok'}`;
  setTimeout(()=> t.classList.remove('show'), 2500);
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
  const terms = toArrayMaybe(row.termino_d); // termino_d en lugar de terminos
  const card = document.createElement('section');
  card.className = 'alert-card';
  card.dataset.id = row.id; // Para identificar la tarjeta
  card.dataset.termino = (row.termino_d || '').toLowerCase();
  card.dataset.ejecutivo = (row.ejecutivo || '').toLowerCase();
  card.dataset.contexto = (row.contexto || '').toLowerCase();
  card.dataset.transcripcion = (row.transcripcion || '').toLowerCase();
  
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
    const mainTerm = terms.length > 0 ? terms[0] : 'contenido';
    const context = row.ejecutivo || row.contexto || 'Se detectó contenido relevante en el programa.';
    const keyPoints = terms.length > 1 ? 
      `Se identificaron múltiples términos: ${terms.join(', ')}.` : 
      `El término "${mainTerm}" fue identificado en el contexto del programa.`;
    const relevance = row.relevancia || 'Esta mención es significativa para el monitoreo de contenido y puede requerir seguimiento adicional.';
    
    return {
      tema: `Se detectó una mención del término "${mainTerm}" en el contenido.`,
      contexto: context,
      puntos: keyPoints,
      relevancia: relevance
    };
  };

  const summary = generateSummary();

  const videoSection = hasVideo ? `
    <div class="video-section">
      <div class="video-container">
        <button class="close-button" onclick="event.stopPropagation(); closeExpandedCard(this.closest('.alert-card'))">✕</button>
        <video class="video" controls preload="metadata" onerror="this.parentElement.innerHTML = '<div style=\\'display:flex;align-items:center;justify-content:center;height:300px;opacity:.7;border:1px dashed var(--danger);color:var(--danger);\\'>Error al cargar video</div>'">
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
        <span>Coincidencia Detectada${terms.length > 0 ? `: ${escapeHtml(terms[0])}` : ''}</span>
      </div>
      <div class="alert-time">
        <span>📅</span>
        <span>${escapeHtml(formatDate(row.fecha_detencion || row.fecha_programa))}</span>
      </div>
    </div>

    ${videoSection}

    <div class="media-info">
      <div class="info-box">
        <div class="info-label">PROGRAMA</div>
        <div class="info-value">${escapeHtml(fmt(row.nombre_archivo))}</div>
      </div>
      <div class="info-box">
        <div class="info-label">HORARIO</div>
        <div class="info-value">${escapeHtml(fmt(row.hora_programa))}</div>
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
  
  // Contraer todas las tarjetas expandidas
  document.querySelectorAll('.alert-card.expanded').forEach(expandedCard => {
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
    card.classList.remove('expanded');
  }
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
}

// ====== Acciones ======
async function loadFirstPage(){
  btnActualizar.disabled = true;
  btnCargarMas.disabled = true;
  try{
    offset = 0;
    feedEl.innerHTML = '';
    allCards = []; // Limpiar array de tarjetas
    console.log('🔄 Cargando primera página...');
    const rows = await fetchAlerts(PAGE_SIZE, offset);
    console.log('📊 Registros obtenidos:', rows.length);
    
    if (rows.length > 0) {
      appendBatch(rows);
      offset += rows.length;
      showToast(`✅ Cargados ${rows.length} registros`);
      console.log('📊 Total de tarjetas en allCards:', allCards.length);
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
    } else {
      appendBatch(rows);
      offset += rows.length;
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

// ====== Listeners ======
document.addEventListener('DOMContentLoaded', () => {
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
  
  console.log('🏷️ Total de tags de filtro configurados:', document.querySelectorAll('.filter-tag').length);

  enableRealtime();
  loadFirstPage();

  // ===== PRUEBA: Traer 2 datos de Supabase ======
  testSupabaseConnection();
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
      
      // Mostrar los datos en la interfaz
      if (data.length > 0) {
        feedEl.innerHTML = '';
        data.forEach(record => {
          const card = renderAlertCard(record);
          feedEl.appendChild(card);
        });
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
