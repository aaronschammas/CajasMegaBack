// ──────────────────────────────────────────────────────────────────────────────
// alquileres.js — Módulo de Gestión de Alquileres
// ──────────────────────────────────────────────────────────────────────────────

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

let propiedades    = [];
let propsFiltradas = [];
let propActual     = null;
let pagoContexto   = null;
let esAdmin        = false;
let metaCrearData  = {};
let imagenesCrear  = [];   // base64 para el formulario de crear

// ──────────────────────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initAnioSelector();
  await detectarRol();
  await loadPropiedades();
  bindEventos();
  document.getElementById('legAll')?.classList.add('active');
  // Verificar actualizaciones pendientes (con delay para no bloquear la carga)
  setTimeout(checkActualizacionesPendientes, 1200);
});

function initAnioSelector() {
  const sel = document.getElementById('filterAnio');
  const actual = new Date().getFullYear();
  for (let a = actual; a >= actual - 3; a--) {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    sel.appendChild(opt);
  }
}

async function detectarRol() {
  try {
    const res = await api('GET', '/api/me');
    document.getElementById('headerUser').textContent = res.email || '';
    esAdmin = (res.role === 'Administrador General');

    if (esAdmin) {
      document.getElementById('btnNuevaPropiedad').style.display = 'flex';
      document.getElementById('reportPanel').style.display = 'block';
      document.getElementById('btnDashboard').style.display = 'inline-flex'; // ← acceso al dashboard
      loadReporte('mes');
    } else {
      // Gestor de Alquileres
      document.getElementById('btnNuevaPropiedad').style.display = 'flex';
    }
  } catch (e) {
    console.warn('No se pudo obtener info de usuario:', e);
  }
}

function bindEventos() {
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await api('POST', '/logout');
    window.location.href = '/';
  });

  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadReporte(btn.dataset.p);
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// CARGA DE DATOS
// ──────────────────────────────────────────────────────────────────────────────
async function loadPropiedades() {
  const anio  = document.getElementById('filterAnio').value;
  const tbody = document.getElementById('tablaBody');
  tbody.innerHTML = `<tr><td colspan="16" style="padding:40px;text-align:center;color:#94a3b8;"><span class="spinner"></span></td></tr>`;

  try {
    const data = await api('GET', `/api/alquileres/propiedades?anio=${anio}`);
    propiedades = data.propiedades || [];
    await loadResumen(anio);
    applyFilters();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="16" style="padding:40px;text-align:center;color:#ef4444;">Error al cargar propiedades: ${e.message}</td></tr>`;
  }
}

async function loadResumen(anio) {
  try {
    const r = await api('GET', `/api/alquileres/resumen?anio=${anio || ''}`);
    document.getElementById('kpiIngreso').textContent    = fmt(r.ingreso_anual_proyectado);
    document.getElementById('kpiDeuda').textContent      = fmt(r.deuda_total);
    document.getElementById('kpiOcupacion').textContent  = Math.round(r.tasa_ocupacion) + '%';
    document.getElementById('kpiAtrasados').textContent  = r.pagos_atrasados;
    document.getElementById('kpiMeses').textContent      = `${r.meses_pendientes_total} meses pendientes`;
    document.getElementById('kpiPropOcup').textContent   = `${r.propiedades_ocupadas} de ${r.total_propiedades} ocupadas`;
    document.getElementById('kpiPropAtraso').textContent = `${r.propiedades_con_atraso} propiedades afectadas`;
  } catch (e) { console.warn('Error al cargar resumen KPIs:', e); }
}

async function loadReporte(periodo) {
  if (!esAdmin) return;
  try {
    const data = await api('GET', `/api/alquileres/resumen/movimientos?periodo=${periodo}`);
    document.getElementById('rTotal').textContent    = fmt(data.total_monto);
    document.getElementById('rCantidad').textContent = data.cantidad;
    document.getElementById('rPromedio').textContent = data.cantidad > 0
      ? fmt(data.total_monto / data.cantidad) : '$0';
  } catch (e) { console.warn('Error al cargar reporte:', e); }
}

// ──────────────────────────────────────────────────────────────────────────────
// FILTROS
// ──────────────────────────────────────────────────────────────────────────────
// Filtro rápido desde los botones de leyenda
function filtroRapido(valor) {
  // Actualizar el select oculto
  document.getElementById('filterEstado').value = valor;

  // Marcar botón activo
  const ids = { '': 'legAll', 'aldia': 'legAldia', 'atraso1': 'legAtraso1', 'atraso2': 'legAtraso2', 'desocupadas': 'legDesoc' };
  Object.values(ids).forEach(id => document.getElementById(id)?.classList.remove('active'));
  const activeId = ids[valor];
  if (activeId) document.getElementById(activeId)?.classList.add('active');

  applyFilters();
}

function applyFilters() {
  const busq   = document.getElementById('searchInput').value.toLowerCase().trim();
  const estado = document.getElementById('filterEstado').value;

  propsFiltradas = propiedades.filter(p => {
    const matchBusq = !busq ||
      (p.direccion || '').toLowerCase().includes(busq) ||
      (p.inquilino || '').toLowerCase().includes(busq);

    let matchEstado = true;
    if (estado) {
      const mesesPend   = (p.pagos || []).filter(pg => pg.estado !== 'paid').length;
      const tieneAtraso1 = (p.pagos || []).some(pg => pg.estado === 'late_1' || pg.estado === 'late_2');
      const tieneAtraso2 = (p.pagos || []).some(pg => pg.estado === 'late_2');

      if      (estado === 'aldia')       matchEstado = mesesPend === 0 && p.ocupada;
      else if (estado === 'atraso1')     matchEstado = tieneAtraso1;
      else if (estado === 'atraso2')     matchEstado = tieneAtraso2;
      else if (estado === 'desocupadas') matchEstado = !p.ocupada;
    }
    return matchBusq && matchEstado;
  });

  renderTabla();
}

// ──────────────────────────────────────────────────────────────────────────────
// RENDER TABLA
// ──────────────────────────────────────────────────────────────────────────────
function renderTabla() {
  const tbody = document.getElementById('tablaBody');

  if (propsFiltradas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="16" style="padding:50px;text-align:center;color:#94a3b8;">
      <i class="fas fa-building" style="font-size:2rem;opacity:.3;display:block;margin-bottom:10px;"></i>
      No se encontraron propiedades
    </td></tr>`;
    document.getElementById('tablaFoot').innerHTML = '';
    return;
  }

  const filas = propsFiltradas.map(prop => {
    const pagos   = prop.pagos || Array(12).fill({estado:'pending', monto:0});
    const deuda   = pagos.filter(p => p.estado !== 'paid').length * (prop.alquiler_mensual || 0);
    const ocupada = prop.ocupada;
    const esDolar = prop.paga_en_dolares;

    // Calcular si algún mes es el de actualización (solo aplica en modo pesos con fecha)
    const fechaAct = prop.fecha_actualizacion ? new Date(prop.fecha_actualizacion) : null;
    const mesAct   = fechaAct ? fechaAct.getMonth() : -1;

    const celdas = pagos.map((pago, i) => {
      if (!ocupada) return `<td class="m-cell vacant">—</td>`;
      const esActualizacion = !esDolar && mesAct === i;
      const cls = `m-cell ${pago.estado}${esActualizacion ? ' update-month' : ''}${esDolar ? ' usd-cell' : ''}`;
      const icono = iconoEstado(pago.estado);
      const titulo = esDolar
        ? `${MESES[i]} — USD ${prop.monto_dolares || 0}`
        : esActualizacion
          ? `Actualización pactada`
          : `${MESES[i]} - ${estadoLabel(pago.estado)}`;
      return `<td class="${cls}" title="${titulo}"
        onclick="event.stopPropagation();clickMes('${prop.id}',${i})">${icono}</td>`;
    }).join('');

    // Badge de modalidad
    const badge = esDolar
      ? `<span class="badge-usd">USD</span>`
      : '';

    return `
    <tr onclick="abrirDetalle('${prop.id}')">
      <td class="cell-dir${ocupada ? '' : ' vacant'}">
        ${prop.direccion}${badge}
        ${ocupada ? '' : ' <em style="font-size:.7rem;opacity:.6;">(desocupada)</em>'}
      </td>
      <td class="cell-tenant">${ocupada ? (prop.inquilino || '—') : '—'}</td>
      ${celdas}
      <td class="cell-debt${deuda > 0 ? ' red' : ''}">${deuda > 0 ? fmt(deuda) : '$0'}</td>
      <td class="cell-actions">
        <button class="btn btn-secondary btn-sm btn-icon" title="Ver detalle"
          onclick="event.stopPropagation();abrirDetalle('${prop.id}')">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>`;
  }).join('');

  tbody.innerHTML = filas;
  renderFooter();
}

function renderFooter() {
  const tfoot = document.getElementById('tablaFoot');
  const meses = Array.from({length:12}, (_,i) => {
    let deuda = 0;
    propiedades.filter(p => p.ocupada).forEach(p => {
      const pago = (p.pagos || [])[i];
      if (pago && pago.estado !== 'paid') deuda += p.alquiler_mensual || 0;
    });
    return deuda;
  });

  const total  = meses.reduce((s, d) => s + d, 0);
  const celdas = meses.map(d =>
    `<td class="${d > 0 ? 'ft-debt' : 'ft-ok'}">${d > 0 ? fmtCorto(d) : '—'}</td>`
  ).join('');

  tfoot.innerHTML = `<tr>
    <td colspan="2" style="text-align:left;font-weight:700;color:#7c3aed;">Deuda por Mes</td>
    ${celdas}
    <td class="${total > 0 ? 'ft-debt' : 'ft-ok'}">${total > 0 ? fmt(total) : '—'}</td>
    <td></td>
  </tr>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// MODAL DETALLE
// ──────────────────────────────────────────────────────────────────────────────
async function abrirDetalle(propId) {
  try {
    const prop = await api('GET', `/api/alquileres/propiedades/${propId}`);
    propActual = prop;
    renderDetalle(prop);
    abrirModal('modalDetalle');
  } catch (e) {
    toast('Error al cargar propiedad: ' + e.message, 'error');
  }
}

function renderDetalle(prop) {
  document.getElementById('detalleTitulo').textContent = prop.direccion;

  const pagos     = prop.pagos || [];
  const pagados   = pagos.filter(p => p.estado === 'paid');
  const recaudado = pagados.reduce((s,p) => s + (p.monto || 0), 0);
  const mesesPend = pagos.filter(p => p.estado !== 'paid').length;
  const deuda     = mesesPend * (prop.alquiler_mensual || 0);
  const esDolar   = prop.paga_en_dolares;

  // ── Grid de datos ─────────────────────────────────────────────────────────
  let infoActualizacion = '';
  if (!esDolar) {
    const fechaAct = prop.fecha_actualizacion
      ? new Date(prop.fecha_actualizacion).toLocaleDateString('es-AR', {day:'2-digit',month:'long',year:'numeric'})
      : '—';
    infoActualizacion = `
      <div class="detail-item"><span class="detail-label">Inflación Pactada</span><span class="detail-value">${prop.indice_inflacion || 0}%</span></div>
      <div class="detail-item"><span class="detail-label">Próxima Actualización</span><span class="detail-value">${fechaAct}</span></div>
    `;
  } else {
    infoActualizacion = `
      <div class="detail-item"><span class="detail-label">Modalidad</span><span class="detail-value green">💵 Dólares</span></div>
      <div class="detail-item"><span class="detail-label">Monto USD</span><span class="detail-value green">USD ${prop.monto_dolares || 0}</span></div>
    `;
  }

  document.getElementById('detalleGrid').innerHTML = `
    <div class="detail-item"><span class="detail-label">Inquilino</span><span class="detail-value blue">${prop.inquilino || 'Sin asignar'}</span></div>
    <div class="detail-item"><span class="detail-label">Alquiler Mensual</span><span class="detail-value green">${fmt(prop.alquiler_mensual)}</span></div>
    <div class="detail-item"><span class="detail-label">Estado</span><span class="detail-value ${prop.ocupada ? 'green' : 'red'}">${prop.ocupada ? 'OCUPADA' : 'DESOCUPADA'}</span></div>
    ${infoActualizacion}
  `;

  // ── Galería de imágenes ───────────────────────────────────────────────────
  const imagenes = prop.imagenes || [];
  const galeriaSection = document.getElementById('galeriaSection');
  if (imagenes.length > 0 || esAdmin) {
    galeriaSection.style.display = 'block';
    document.getElementById('galeriaGrid').innerHTML = imagenes.map((src, idx) =>
      `<div class="galeria-item">
        <img src="${src}" onclick="abrirLightbox('${src}')" title="Ver imagen">
        ${esAdmin ? `<button class="img-del" onclick="eliminarImagen(${idx})" title="Eliminar"><i class="fas fa-times"></i></button>` : ''}
      </div>`
    ).join('');
    if (esAdmin) document.getElementById('imgAddDetalle').style.display = 'block';
  } else {
    galeriaSection.style.display = 'none';
  }

  // ── Calendario ───────────────────────────────────────────────────────────
  const fechaAct = prop.fecha_actualizacion ? new Date(prop.fecha_actualizacion) : null;
  const mesAct   = fechaAct ? fechaAct.getMonth() : -1;

  document.getElementById('calGrid').innerHTML = pagos.map((pago, i) => {
    const icono    = iconoEstado(pago.estado);
    const montoStr = pago.estado === 'paid' ? `<div class="m-amount">${fmtCorto(pago.monto || 0)}</div>` : '';
    const esAct    = !esDolar && mesAct === i;
    return `<div class="cal-month ${pago.estado}${esAct ? ' update-month' : ''}" onclick="clickMesDetalle(${i})" title="${MESES[i]}">
      <div class="m-name">${MESES_CORTO[i]}</div>
      <div class="m-status">${icono}</div>
      ${montoStr}
    </div>`;
  }).join('');

  // ── Stats ─────────────────────────────────────────────────────────────────
  document.getElementById('sPagados').textContent    = `${pagados.length} de 12`;
  document.getElementById('sRecaudado').textContent  = fmt(recaudado);
  document.getElementById('sDeuda').textContent      = fmt(deuda);
  document.getElementById('sPendientes').textContent = mesesPend;

  // ── Proyección o info USD ─────────────────────────────────────────────────
  if (esDolar) {
    document.getElementById('projBox').style.display = 'none';
    document.getElementById('usdBox').style.display  = 'block';
    document.getElementById('usdMonto').textContent  = `USD ${prop.monto_dolares || 0}`;
  } else {
    document.getElementById('projBox').style.display = 'block';
    document.getElementById('usdBox').style.display  = 'none';
    const nuevoAlquiler = (prop.alquiler_mensual || 0) * (1 + (prop.indice_inflacion || 0) / 100);
    document.getElementById('projInflacion').textContent = (prop.indice_inflacion || 0) + '%';
    document.getElementById('projMonto').textContent     = fmt(nuevoAlquiler);
  }

  // ── Metadata ──────────────────────────────────────────────────────────────
  renderMetaDetalle(prop.metadata || {});

  // ── Botones ───────────────────────────────────────────────────────────────
  document.getElementById('btnToggleOcup').textContent = prop.ocupada ? '📦 Marcar Desocupada' : '🏠 Marcar Ocupada';

  const btnElim = document.getElementById('btnEliminarProp');
  if (esAdmin) {
    btnElim.style.display = 'inline-flex';
    document.getElementById('metaAddSection').style.display = 'flex';
    document.getElementById('btnToggleMeta').style.display = 'inline-flex';
  } else {
    btnElim.style.display = 'none';
    document.getElementById('btnToggleMeta').style.display = 'none';
  }
}

function renderMetaDetalle(meta) {
  const grid = document.getElementById('metaDetalleGrid');
  const keys = Object.keys(meta);
  if (keys.length === 0) {
    grid.innerHTML = '<span style="font-size:.8rem;color:#94a3b8;grid-column:1/-1;">Sin datos adicionales registrados.</span>';
    return;
  }
  grid.innerHTML = keys.map(k =>
    `<div class="meta-item">
      <span class="meta-key">${k}</span>
      <span class="meta-val">${meta[k]}</span>
      ${esAdmin ? `<button class="meta-del" onclick="eliminarMetaCampo('${k}')" title="Eliminar"><i class="fas fa-times"></i></button>` : ''}
    </div>`
  ).join('');
}

// ──────────────────────────────────────────────────────────────────────────────
// IMÁGENES
// ──────────────────────────────────────────────────────────────────────────────
function onFilesCrear(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const promises = files.map(f => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(f);
  }));

  Promise.all(promises).then(base64s => {
    imagenesCrear.push(...base64s);
    renderImagenesCrear();
    event.target.value = ''; // reset input
  });
}

function renderImagenesCrear() {
  document.getElementById('imgPreviewCrear').innerHTML = imagenesCrear.map((src, idx) =>
    `<div class="galeria-item">
      <img src="${src}" onclick="abrirLightbox('${src}')">
      <button class="img-del" onclick="imagenesCrear.splice(${idx},1);renderImagenesCrear()"><i class="fas fa-times"></i></button>
    </div>`
  ).join('');
}

async function onFilesDetalle(event) {
  if (!propActual) return;
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const promises = files.map(f => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(f);
  }));

  const nuevas = await Promise.all(promises);
  const todasLasImagenes = [...(propActual.imagenes || []), ...nuevas];

  try {
    const res = await api('PUT', `/api/alquileres/propiedades/${propActual.id}`, { imagenes: todasLasImagenes });
    propActual = res.propiedad;
    const idx = propiedades.findIndex(p => p.id === propActual.id);
    if (idx >= 0) propiedades[idx] = propActual;
    renderDetalle(propActual);
    toast(`${nuevas.length} imagen(es) agregada(s) ✓`, 'success');
    event.target.value = '';
  } catch (e) {
    toast('Error al guardar imágenes: ' + e.message, 'error');
  }
}

async function eliminarImagen(idx) {
  if (!propActual || !esAdmin) return;
  if (!confirm('¿Eliminar esta imagen?')) return;

  const nuevas = [...(propActual.imagenes || [])];
  nuevas.splice(idx, 1);

  try {
    const res = await api('PUT', `/api/alquileres/propiedades/${propActual.id}`, { imagenes: nuevas });
    propActual = res.propiedad;
    const i = propiedades.findIndex(p => p.id === propActual.id);
    if (i >= 0) propiedades[i] = propActual;
    renderDetalle(propActual);
    toast('Imagen eliminada', 'info');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

function abrirLightbox(src) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  lb.style.display = 'flex';
}
function cerrarLightbox() {
  document.getElementById('lightbox').style.display = 'none';
}

// ──────────────────────────────────────────────────────────────────────────────
// MODAL PAGO
// ──────────────────────────────────────────────────────────────────────────────
function abrirModalPago(propId, mes, direccion, alquilerBase) {
  pagoContexto = { propId, mes };
  const prop  = propiedades.find(p => p.id === propId) || {};
  const esDolar = prop.paga_en_dolares;

  document.getElementById('pagoPropiedad').textContent = direccion;
  document.getElementById('pagoMes').textContent       = MESES[mes];

  if (esDolar) {
    document.getElementById('pagoInfoBase').style.display = 'none';
    document.getElementById('pagoInfoUSD').style.display  = 'block';
    document.getElementById('pagoUSD').textContent = `USD ${prop.monto_dolares || 0}`;
    document.getElementById('pagoMonto').value = alquilerBase || '';
  } else {
    document.getElementById('pagoInfoBase').style.display = 'block';
    document.getElementById('pagoInfoUSD').style.display  = 'none';
    document.getElementById('pagoHabitual').textContent = fmt(alquilerBase || 0);
    document.getElementById('pagoMonto').value = alquilerBase || '';
  }

  abrirModal('modalPago');
}

async function confirmarPago() {
  if (!pagoContexto) return;
  const monto = parseFloat(document.getElementById('pagoMonto').value);
  if (!monto || monto <= 0) { toast('Ingresá un monto válido', 'error'); return; }

  try {
    const res = await api('POST', `/api/alquileres/propiedades/${pagoContexto.propId}/pago`, {
      mes: pagoContexto.mes, monto
    });
    toast(`Pago de ${MESES[pagoContexto.mes]} registrado ✓`, 'success');
    cerrarModal('modalPago');

    const idx = propiedades.findIndex(p => p.id === pagoContexto.propId);
    if (idx >= 0) propiedades[idx] = res.propiedad;

    if (propActual && propActual.id === pagoContexto.propId) {
      propActual = res.propiedad;
      renderDetalle(propActual);
    }

    pagoContexto = null;
    applyFilters();
    loadResumen(document.getElementById('filterAnio').value);
  } catch (e) {
    toast('Error al registrar pago: ' + e.message, 'error');
  }
}

async function deshacerPago(propId, mes) {
  try {
    const res = await api('DELETE', `/api/alquileres/propiedades/${propId}/pago/${mes}`);
    toast(`Pago de ${MESES[mes]} revertido`, 'info');

    const idx = propiedades.findIndex(p => p.id === propId);
    if (idx >= 0) propiedades[idx] = res.propiedad;

    if (propActual && propActual.id === propId) {
      propActual = res.propiedad;
      renderDetalle(propActual);
    }

    applyFilters();
    loadResumen(document.getElementById('filterAnio').value);
  } catch (e) {
    toast('Error al revertir pago: ' + e.message, 'error');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// TOGGLE MODALIDAD (PESOS / DÓLARES)
// ──────────────────────────────────────────────────────────────────────────────
function onModalidadChange() {
  const esDolar = document.querySelector('input[name="cModalidad"]:checked').value === 'dolares';
  document.getElementById('seccionPesos').style.display   = esDolar ? 'none' : 'grid';
  document.getElementById('seccionDolares').style.display = esDolar ? 'grid' : 'none';
}

// ──────────────────────────────────────────────────────────────────────────────
// CREAR PROPIEDAD
// ──────────────────────────────────────────────────────────────────────────────
function abrirModalCrear() {
  metaCrearData  = {};
  imagenesCrear  = [];
  document.getElementById('metaFieldsCrear').innerHTML  = '';
  document.getElementById('imgPreviewCrear').innerHTML  = '';
  document.getElementById('metaKeyCrear').value = '';
  document.getElementById('metaValCrear').value = '';
  ['cDireccion','cInquilino','cAlquiler','cInflacion',
   'cMontoDolares','cAlquilerDolares'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('cFechaActualizacion').value = '';
  // reset modalidad
  document.querySelector('input[name="cModalidad"][value="pesos"]').checked = true;
  onModalidadChange();
  abrirModal('modalCrear');
}

function addMetaFieldCrear() {
  const k = document.getElementById('metaKeyCrear').value.trim();
  const v = document.getElementById('metaValCrear').value.trim();
  if (!k || !v) { toast('Completá clave y valor', 'error'); return; }
  metaCrearData[k] = v;
  document.getElementById('metaKeyCrear').value = '';
  document.getElementById('metaValCrear').value = '';
  renderMetaCrear();
}

function renderMetaCrear() {
  document.getElementById('metaFieldsCrear').innerHTML = Object.keys(metaCrearData).map(k =>
    `<div class="meta-item" style="margin-bottom:4px;">
      <span class="meta-key">${k}</span>
      <span class="meta-val">${metaCrearData[k]}</span>
      <button class="meta-del" onclick="delete metaCrearData['${k}'];renderMetaCrear()"><i class="fas fa-times"></i></button>
    </div>`
  ).join('');
}

async function crearPropiedad() {
  const direccion = document.getElementById('cDireccion').value.trim();
  if (!direccion) { toast('La dirección es obligatoria', 'error'); return; }

  const esDolar = document.querySelector('input[name="cModalidad"]:checked').value === 'dolares';

  let alquiler, body;

  if (esDolar) {
    const montoDolares  = parseFloat(document.getElementById('cMontoDolares').value);
    const alquilerPesos = parseFloat(document.getElementById('cAlquilerDolares').value);
    if (!montoDolares || montoDolares <= 0) { toast('El monto en USD es obligatorio', 'error'); return; }
    alquiler = alquilerPesos || 0;
    body = {
      direccion,
      inquilino: document.getElementById('cInquilino').value.trim(),
      alquiler_mensual: alquiler,
      paga_en_dolares: true,
      monto_dolares: montoDolares,
      ocupada: document.getElementById('cOcupada').value === 'true',
      imagenes: imagenesCrear,
      metadata: metaCrearData,
    };
  } else {
    alquiler = parseFloat(document.getElementById('cAlquiler').value);
    if (!alquiler || alquiler <= 0) { toast('El alquiler mensual debe ser mayor a 0', 'error'); return; }

    const fechaStr = document.getElementById('cFechaActualizacion').value;
    const frecRaw  = parseInt(document.getElementById('cFrecuencia')?.value || '0', 10);
    const frecuencia = frecRaw >= 3 ? frecRaw : (frecRaw > 0 ? 3 : 0);
    body = {
      direccion,
      inquilino: document.getElementById('cInquilino').value.trim(),
      alquiler_mensual: alquiler,
      indice_inflacion: parseFloat(document.getElementById('cInflacion').value) || 0,
      fecha_actualizacion: fechaStr ? new Date(fechaStr).toISOString() : null,
      frecuencia_actualizacion: frecuencia,
      paga_en_dolares: false,
      ocupada: document.getElementById('cOcupada').value === 'true',
      imagenes: imagenesCrear,
      metadata: metaCrearData,
    };
  }

  try {
    await api('POST', '/api/alquileres/propiedades', body);
    toast('Propiedad creada exitosamente ✓', 'success');
    cerrarModal('modalCrear');
    await loadPropiedades();
  } catch (e) {
    toast('Error al crear: ' + e.message, 'error');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CLICK EN MES (tabla principal y detalle)
// ──────────────────────────────────────────────────────────────────────────────
function clickMesDetalle(mes) {
  if (!propActual) return;
  const pago = (propActual.pagos || [])[mes];
  if (!pago) return;

  if (pago.estado === 'paid') {
    if (esAdmin && confirm(`¿Revertir el pago de ${MESES[mes]}?`)) deshacerPago(propActual.id, mes);
  } else {
    abrirModalPago(propActual.id, mes, propActual.direccion, propActual.alquiler_mensual);
  }
}

function clickMes(propId, mes) {
  const prop = propiedades.find(p => p.id === propId);
  if (!prop || !prop.ocupada) return;
  const pago = (prop.pagos || [])[mes];
  if (!pago) return;

  if (pago.estado === 'paid') {
    if (esAdmin && confirm(`¿Revertir el pago de ${MESES[mes]} de ${prop.direccion}?`)) deshacerPago(propId, mes);
  } else {
    abrirModalPago(propId, mes, prop.direccion, prop.alquiler_mensual);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ACCIONES EN DETALLE
// ──────────────────────────────────────────────────────────────────────────────
async function toggleOcupacion() {
  if (!propActual) return;
  try {
    const res = await api('PUT', `/api/alquileres/propiedades/${propActual.id}`, { ocupada: !propActual.ocupada });
    propActual = res.propiedad;
    const idx = propiedades.findIndex(p => p.id === propActual.id);
    if (idx >= 0) propiedades[idx] = propActual;
    renderDetalle(propActual);
    applyFilters();
    toast(`Propiedad marcada como ${propActual.ocupada ? 'ocupada' : 'desocupada'}`, 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarPropiedad() {
  if (!propActual) return;
  if (!confirm(`¿Eliminar permanentemente "${propActual.direccion}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api('DELETE', `/api/alquileres/propiedades/${propActual.id}`);
    toast('Propiedad eliminada', 'info');
    cerrarModal('modalDetalle');
    propActual = null;
    await loadPropiedades();
  } catch (e) { toast('Error al eliminar: ' + e.message, 'error'); }
}

async function addMetaDetalle() {
  if (!propActual) return;
  const k = document.getElementById('metaKeyDetalle').value.trim();
  const v = document.getElementById('metaValDetalle').value.trim();
  if (!k || !v) { toast('Completá clave y valor', 'error'); return; }
  try {
    const res = await api('PUT', `/api/alquileres/propiedades/${propActual.id}`, { metadata: { [k]: v } });
    propActual = res.propiedad;
    const idx = propiedades.findIndex(p => p.id === propActual.id);
    if (idx >= 0) propiedades[idx] = propActual;
    renderMetaDetalle(propActual.metadata || {});
    document.getElementById('metaKeyDetalle').value = '';
    document.getElementById('metaValDetalle').value = '';
    toast('Campo agregado ✓', 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function eliminarMetaCampo(campo) {
  if (!propActual || !esAdmin) return;
  if (!confirm(`¿Eliminar el campo "${campo}"?`)) return;
  try {
    const res = await api('DELETE', `/api/alquileres/propiedades/${propActual.id}/metadata/${campo}`);
    propActual = res.propiedad;
    const idx = propiedades.findIndex(p => p.id === propActual.id);
    if (idx >= 0) propiedades[idx] = propActual;
    renderMetaDetalle(propActual.metadata || {});
    toast(`Campo "${campo}" eliminado`, 'info');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function toggleMetaAdd() {
  const sec = document.getElementById('metaAddSection');
  sec.style.display = sec.style.display === 'none' ? 'flex' : 'none';
}

// ──────────────────────────────────────────────────────────────────────────────
// MODALES (helpers)
// ──────────────────────────────────────────────────────────────────────────────
function abrirModal(id)  { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    cerrarLightbox();
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3500);
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('es-AR', {style:'currency', currency:'ARS', minimumFractionDigits:0}).format(n || 0);
}
function fmtCorto(n) {
  if (n >= 1_000_000) return '$' + (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + (n/1_000).toFixed(0) + 'k';
  return fmt(n);
}
function iconoEstado(estado) {
  if (estado === 'paid')   return '✓';
  if (estado === 'late_1') return '!';
  if (estado === 'late_2') return '!!';
  return '–';
}
function estadoLabel(estado) {
  if (estado === 'paid')    return 'Pagado';
  if (estado === 'pending') return 'Pendiente';
  if (estado === 'late_1')  return 'Atrasado (1 mes)';
  if (estado === 'late_2')  return 'Atrasado (2+ meses)';
  return estado;
}

// ──────────────────────────────────────────────────────────────────────────────
// API helper
// ──────────────────────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  if (res.status === 401) { window.location.href = '/'; return; }
  if (res.status === 403) { throw new Error('No tenés permisos para esta acción'); }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`);
  return data;
}

// ──────────────────────────────────────────────────────────────────────────────
// SISTEMA DE NOTIFICACIÓN DE ACTUALIZACIÓN DE ALQUILER
// ──────────────────────────────────────────────────────────────────────────────

let actPendientes = [];   // lista de PropiedadActualizacion
let actIndice     = 0;    // cuál se está mostrando ahora

async function checkActualizacionesPendientes() {
  try {
    const data = await api('GET', '/api/alquileres/actualizaciones-pendientes');
    actPendientes = data.pendientes || [];
    if (actPendientes.length > 0) {
      actIndice = 0;
      actMostrar(0);
    }
  } catch (e) {
    console.warn('[ACT] No se pudieron cargar actualizaciones pendientes:', e.message);
  }
}

function actMostrar(idx) {
  if (idx >= actPendientes.length) { actCerrar(); return; }

  const item = actPendientes[idx];
  const prop = item.propiedad;
  const infl = item.inflacion || {};
  const total = actPendientes.length;

  // Counter
  document.getElementById('actCounter').textContent = `${idx + 1} de ${total}`;

  // Datos de la propiedad
  document.getElementById('actDireccion').textContent = prop.direccion || 'Sin dirección';
  document.getElementById('actInquilino').textContent = prop.inquilino
    ? `👤 Inquilino: ${prop.inquilino}` : '🏠 Sin inquilino registrado';
  const frec = prop.frecuencia_actualizacion || '?';
  document.getElementById('actFrecuencia').textContent =
    `📅 Actualización cada ${frec} mes${frec !== 1 ? 'es' : ''}`;

  // Fuente
  document.getElementById('actFuente').textContent = infl.fuente || 'INDEC vía ArgentinaDatos';

  // Tabla IPC
  const meses  = infl.meses || [];
  const tbody  = document.getElementById('actTablaCuerpo');
  const sinDatos = document.getElementById('actSinDatos');
  const tablaWrap = document.getElementById('actTablaWrap');

  if (meses.length === 0) {
    tablaWrap.style.display = 'none';
    sinDatos.style.display  = 'block';
    document.getElementById('actAcumulado').textContent = 'N/D';
  } else {
    tablaWrap.style.display = '';
    sinDatos.style.display  = 'none';
    tbody.innerHTML = meses.map(m =>
      `<tr><td>${m.periodo}</td><td class="act-td-pct">${m.pct.toFixed(2)}%</td></tr>`
    ).join('');
    const acum = (infl.acumulado_pct || 0).toFixed(2);
    document.getElementById('actAcumulado').textContent = `${acum}%`;
  }

  // Montos
  const fmt = v => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:2 }).format(v);
  document.getElementById('actMontoActual').textContent       = fmt(item.monto_actual);
  document.getElementById('actMontoRecomendado').textContent  = fmt(item.monto_recomendado);
  const pctLabel = infl.acumulado_pct ? `(+${infl.acumulado_pct.toFixed(2)}%)` : '';
  document.getElementById('actPctLabel').textContent = pctLabel;

  // Pre-completar el input con el monto recomendado
  document.getElementById('actMontoInput').value = item.monto_recomendado.toFixed(2);
  document.getElementById('actNotasInput').value = '';

  // Resetear sección posponer
  document.getElementById('actPosponerSection').style.display = 'none';
  document.getElementById('actPosponerFecha').value = '';
  document.getElementById('actBtnPosponer').classList.remove('active');

  // Botón "Siguiente" solo si hay más
  document.getElementById('actBtnSiguiente').style.display = (total > 1 && idx < total - 1) ? '' : 'none';

  // Mostrar overlay
  document.getElementById('actOverlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function actCerrar() {
  document.getElementById('actOverlay').style.display = 'none';
  document.body.style.overflow = '';
  actPendientes = [];
}

function actSiguiente() {
  actIndice++;
  actMostrar(actIndice);
}

function actTogglePosponer() {
  const sec = document.getElementById('actPosponerSection');
  const btn = document.getElementById('actBtnPosponer');
  const abierto = sec.style.display !== 'none';
  if (abierto) {
    // Si ya estaba abierto y hay fecha seleccionada, ejecutar el posponer
    const fecha = document.getElementById('actPosponerFecha').value;
    if (fecha) {
      actEjecutarPosponer();
      return;
    }
    // Si no hay fecha, solo cerrar la sección
    sec.style.display = 'none';
    btn.classList.remove('active');
    btn.innerHTML = '<i class="fas fa-clock"></i> Posponer';
  } else {
    sec.style.display = 'block';
    btn.classList.add('active');
    btn.innerHTML = '<i class="fas fa-check"></i> Confirmar fecha';
    // Sugerir fecha por defecto: 15 días desde hoy
    const d = new Date();
    d.setDate(d.getDate() + 15);
    document.getElementById('actPosponerFecha').value = d.toISOString().split('T')[0];
  }
}

async function actEjecutarPosponer() {
  const item  = actPendientes[actIndice];
  const fecha = document.getElementById('actPosponerFecha').value;
  if (!fecha) { toast('Seleccioná una fecha para posponer', 'error'); return; }

  try {
    await api('POST', `/api/alquileres/propiedades/${item.propiedad.id}/posponer`, {
      posponer_hasta: new Date(fecha).toISOString()
    });
    toast(`⏰ Actualización pospuesta hasta ${new Date(fecha).toLocaleDateString('es-AR')}`, 'info');
    // Remover de la lista y continuar
    actPendientes.splice(actIndice, 1);
    if (actPendientes.length === 0) { actCerrar(); }
    else { actMostrar(Math.min(actIndice, actPendientes.length - 1)); }
  } catch (e) {
    toast('Error al posponer: ' + e.message, 'error');
  }
}

async function actConfirmar() {
  const item   = actPendientes[actIndice];
  const monto  = parseFloat(document.getElementById('actMontoInput').value);
  const notas  = document.getElementById('actNotasInput').value.trim();

  if (!monto || monto <= 0) {
    toast('Ingresá un monto válido', 'error');
    return;
  }

  const btn = document.getElementById('actBtnActualizar');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  try {
    await api('PUT', `/api/alquileres/propiedades/${item.propiedad.id}/actualizar-monto`, {
      nuevo_monto: monto,
      notas: notas || undefined,
    });

    const fmt = v => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:2 }).format(v);
    toast(`✅ Monto actualizado a ${fmt(monto)}`, 'success');

    // Recargar tabla principal para reflejar el nuevo monto
    await loadPropiedades();

    // Remover de la lista y continuar con el siguiente
    actPendientes.splice(actIndice, 1);
    if (actPendientes.length === 0) { actCerrar(); }
    else { actMostrar(Math.min(actIndice, actPendientes.length - 1)); }
  } catch (e) {
    toast('Error al actualizar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Actualizar monto';
  }
}
