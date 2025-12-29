const agregarBtn = document.getElementById('agregarBtn');

// --- PILA DE MOVIMIENTOS Y ENVÍO AL BACKEND ---
let pilaMovimientos = [];

function crearMovimiento(fecha, monto, movimiento, turno, realizadoPor) {
  const div = document.createElement('div');
  div.classList.add('movimiento-list');

  div.innerHTML = `
    <p><strong>${fecha}</strong> - $${monto} - ${movimiento} - Turno: ${turno} - Por: ${realizadoPor}</p>
    <div class="action-buttons">
      <button class="edit-btn">Editar/Ver</button>
      <button class="delete-btn" title="Eliminar">×</button>
    </div>
  `;

  // Función para eliminar el movimiento de la pila
  const deleteBtn = div.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', () => {
    div.remove();
  });

  return div;
}

function renderPilaMovimientos() {
  const movimientosPendientes = document.getElementById('movimientosPendientes');
  movimientosPendientes.innerHTML = '';
  pilaMovimientos.forEach(mov => {
    const fecha = mov.fecha || new Date().toLocaleDateString();
    const nuevoMovimiento = crearMovimiento(
      fecha,
      mov.amount,
      mov.movement_type,
      mov.shift,
      mov.created_by
    );
    movimientosPendientes.appendChild(nuevoMovimiento);
  });
}

// Al cargar la página, renderiza la pila guardada
renderPilaMovimientos();

function mapMovimientoForm() {
  const createdByInput = document.getElementById('created_by');
  let createdByValue = 0;
  if (createdByInput && createdByInput.value) {
    createdByValue = parseInt(createdByInput.value, 10);
  }
  return {
    movement_type: document.getElementById('movement_type').value,
    amount: parseFloat(document.getElementById('amount').value),
    shift: document.getElementById('shift').value,
    concept_id: parseInt(document.getElementById('concept_id').value),
    details: document.getElementById('details').value,
    created_by: createdByValue
  };
}

// Variable global para el estado del arco
let ultimoEstadoArco = null;

// Función centralizada para obtener el estado del arco desde el backend, usando el turno seleccionado
async function obtenerEstadoArco() {
  const shiftSelect = document.getElementById('shift');
  const turno = shiftSelect ? shiftSelect.value : 'M';
  try {
    const res = await fetch(`/arco/estado?turno=${turno}`, { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    ultimoEstadoArco = data;
    return data;
  } catch {
    ultimoEstadoArco = null;
    return null;
  }
}

// --- Listener para agregar a la pila y renderizar
agregarBtn.addEventListener('click', async () => {
  const data = await obtenerEstadoArco();
  if (!data || !data.arco_abierto || !data.arco || !data.arco.id) {
    alert('Debe abrir el arco para agregar movimientos.');
    return;
  }
  const fechaActual = new Date().toLocaleDateString();
  const mov = mapMovimientoForm();

  // Mostrar en consola los datos que se intentan agregar
  console.log('[DEBUG] Movimiento a agregar:', mov);

  // Validación profesional de campos
  if (
    !mov.amount || isNaN(mov.amount) ||
    !mov.movement_type ||
    !mov.shift ||
    !mov.concept_id || isNaN(mov.concept_id) ||
    !mov.created_by || isNaN(mov.created_by) || mov.created_by <= 0
  ) {
    alert('Por favor completa todos los campos correctamente');
    return;
  }
  mov.arco_id = data.arco.id;
  mov.fecha = fechaActual;
  pilaMovimientos.push(mov);
  renderPilaMovimientos();
  document.getElementById('amount').value = '';
  document.getElementById('details').value = '';
});

// --- Enviar a la DB (por submit del form, serializa la pila y valida estado del arco con obtenerEstadoArco) ---
const formEnviar = document.getElementById('formEnviarMovimientos');
const inputMovimientos = document.getElementById('inputMovimientos');
if (formEnviar) {
  formEnviar.addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = await obtenerEstadoArco();
    actualizarUIEstadoArco();
    if (!data || !data.arco_abierto || !data.arco || !data.arco.id) {
      alert('No se puede enviar: el arco está cerrado o no existe.');
      return;
    }
    inputMovimientos.value = JSON.stringify(pilaMovimientos);
    // Enviar por AJAX y redirigir si éxito
    try {
      const res = await fetch(formEnviar.action, {
        method: formEnviar.method,
        body: new FormData(formEnviar),
        credentials: 'include'
      });
      if (res.ok) { //coso para dirigir si se agregan a la DB los egresos
        window.location.href = '/movimientos';
      } else {
        const result = await res.json();
        alert(result.error || 'Error al agregar movimientos');
      }
    } catch (err) {
      alert('Error de red al agregar movimientos');
    }
  });
}

// --- Botón abrir arco ---
const abrirBtn = document.getElementById('abrirArcoBtn');
if (abrirBtn) {
  abrirBtn.addEventListener('click', async function() {
    const shiftSelect = document.getElementById('shift');
    const turno = shiftSelect ? shiftSelect.value : 'M';
    const res = await fetch('/arco/abrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ turno })
    });
    if (res.ok) {
      await obtenerEstadoArco();
      actualizarUIEstadoArco();
      alert('Arco abierto correctamente');
    } else {
      const data = await res.json();
      alert(data.error || 'Error al abrir arco');
    }
  });
}

// --- Sincronización y control de estado del arco ---
// Eliminado el uso de localStorage para arco

// --- Obtención de usuario y estado de arco, y control de botones ---
async function inicializarUsuarioYArco() {
  try {
    const userRes = await fetch('/api/me', { credentials: 'include' });
    if (!userRes.ok) throw new Error('No autenticado');
    const userObj = await userRes.json();
    // Eliminado el guardado de usuarioActual en localStorage
    const createdByInput = document.getElementById('created_by');
    if (createdByInput && userObj.user_id) {
      createdByInput.value = userObj.user_id;
      createdByInput.readOnly = true;
    }
    document.getElementById('usuarioActual').textContent = userObj.full_name || userObj.email;
    // Estado del arco y botones
    await actualizarEstadoArcoYBotones();
  } catch {
    // Eliminado el borrado de usuarioActual en localStorage
    const createdByInput = document.getElementById('created_by');
    if (createdByInput) {
      createdByInput.value = '';
      createdByInput.readOnly = true;
    }
    document.getElementById('usuarioActual').textContent = 'No autenticado';
    const agregarBtn = document.getElementById('agregarBtn');
    const enviarBtn = document.querySelector('.enviar-db');
    const abrirBtn = document.getElementById('abrirArcoBtn');
    const estadoBox = document.getElementById('arcoEstadoBox');
    estadoBox.textContent = 'No autenticado';
    estadoBox.style.display = 'block';
    estadoBox.style.background = '#f9e79f';
    estadoBox.style.color = '#7d6608';
    abrirBtn.style.display = 'inline-block';
    agregarBtn.disabled = true;
    if (enviarBtn) enviarBtn.disabled = true;
  }
  document.getElementById('fechaActual').textContent = new Date().toLocaleDateString();
}

async function actualizarEstadoArcoYBotones() {
  try {
    const res = await fetch('/arco/estado', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const abierto = data.arco_abierto && data.arco && data.arco.id;
    const agregarBtn = document.getElementById('agregarBtn');
    const enviarBtn = document.querySelector('.enviar-db');
    const abrirBtn = document.getElementById('abrirArcoBtn');
    const estadoBox = document.getElementById('arcoEstadoBox');
    if (abierto) {
      estadoBox.textContent = `Arco abierto (ID: ${data.arco.id}, Turno: ${data.arco.turno || ''})`;
      estadoBox.style.display = 'block';
      estadoBox.style.background = '#d4efdf';
      estadoBox.style.color = '#145a32';
      abrirBtn.style.display = 'none';
      agregarBtn.disabled = false;
      if (enviarBtn) enviarBtn.disabled = false;
    } else {
      estadoBox.textContent = data.error || 'Debe abrir el arco para operar.';
      estadoBox.style.display = 'block';
      estadoBox.style.background = '#f9e79f';
      estadoBox.style.color = '#7d6608';
      abrirBtn.style.display = 'inline-block';
      agregarBtn.disabled = true;
      if (enviarBtn) enviarBtn.disabled = true;
    }
  } catch {
    const agregarBtn = document.getElementById('agregarBtn');
    const enviarBtn = document.querySelector('.enviar-db');
    const abrirBtn = document.getElementById('abrirArcoBtn');
    const estadoBox = document.getElementById('arcoEstadoBox');
    estadoBox.textContent = 'Error al obtener estado del arco';
    estadoBox.style.display = 'block';
    estadoBox.style.background = '#f9e79f';
    estadoBox.style.color = '#7d6608';
    abrirBtn.style.display = 'inline-block';
    agregarBtn.disabled = true;
    if (enviarBtn) enviarBtn.disabled = true;
  }
}

// --- Consultar y abrir arco ---
async function consultarEstadoArco(turno) {
  try {
    const res = await fetch(`/arco/estado?turno=${turno}`, { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/api/login';
      return { abierto: false, msg: 'No autenticado' };
    }
    if (res.ok) {
      const arco = await res.json();
      return { abierto: true, arco };
    } else {
      const data = await res.json();
      return { abierto: false, msg: data.error || 'No hay arco abierto' };
    }
  } catch (e) {
    return { abierto: false, msg: 'Error de red' };
  }
}
async function abrirArco(turno) {
  try {
    const res = await fetch('/arco/abrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ turno })
    });
    if (res.ok) {
      return { ok: true };
    } else {
      const data = await res.json();
      return { ok: false, msg: data.error || 'Error al abrir arco' };
    }
  } catch (e) {
    return { ok: false, msg: 'Error de red' };
  }
}

// --- Sincronización de estado de arco al cargar y en cambios de turno ---
document.addEventListener('DOMContentLoaded', async function() {
  await actualizarArcoDesdeBackend();
  const shiftSelect = document.getElementById('shift');
  let turno = shiftSelect ? shiftSelect.value : 'M';
  async function checkArco() {
    const estado = await consultarEstadoArco(turno);
    setArcoUI(estado.abierto, estado.msg, estado.arco && estado.arco.arco ? estado.arco.arco : estado.arco);
  }
  await checkArco();
  if (shiftSelect) {
    shiftSelect.addEventListener('change', async function() {
      turno = shiftSelect.value;
      await checkArco();
    });
  }
  document.getElementById('abrirArcoBtn').addEventListener('click', async function() {
    const res = await abrirArco(turno);
    if (res.ok) {
      await checkArco();
      alert('Arco abierto correctamente');
    } else {
      alert(res.msg);
    }
  });
});

// --- Actualizar UI de estado de arco y botones usando la variable global ---
function actualizarUIEstadoArco() {
  const agregarBtn = document.getElementById('agregarBtn');
  const enviarBtn = document.querySelector('.enviar-db');
  const abrirBtn = document.getElementById('abrirArcoBtn');
  const estadoBox = document.getElementById('arcoEstadoBox');
  if (ultimoEstadoArco && ultimoEstadoArco.arco_abierto && ultimoEstadoArco.arco && ultimoEstadoArco.arco.id) {
    estadoBox.textContent = `Arco abierto (ID: ${ultimoEstadoArco.arco.id}, Turno: ${ultimoEstadoArco.arco.turno || ''})`;
    estadoBox.style.display = 'block';
    estadoBox.style.background = '#d4efdf';
    estadoBox.style.color = '#145a32';
    abrirBtn.style.display = 'none';
    agregarBtn.disabled = false;
    if (enviarBtn) enviarBtn.disabled = false;
  } else {
    estadoBox.textContent = (ultimoEstadoArco && ultimoEstadoArco.error) || 'Debe abrir el arco para operar.';
    estadoBox.style.display = 'block';
    estadoBox.style.background = '#f9e79f';
    estadoBox.style.color = '#7d6608';
    abrirBtn.style.display = 'inline-block';
    agregarBtn.disabled = true;
    if (enviarBtn) enviarBtn.disabled = true;
  }
}

// --- Uso en inicialización y otros lugares ---
document.addEventListener('DOMContentLoaded', async function() {
  await obtenerEstadoArco();
  actualizarUIEstadoArco();
});

// Cargar movimientos del último arco y mostrarlos en la sección "Movimientos en la DB" (solo Egresos)
async function loadMovimientosUltimoArco() {
  try {
    const res = await fetch('/api/arco-estado', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const arco = data.arco
    const container = document.getElementById('movimientosAgregados');
    if (!container) return;
    if (!arco || !arco.id) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No hay movimientos registrados</p></div>';
      return;
    }
    const movRes = await fetch(`/api/movimientos/arco/${arco.id}`, { credentials: 'include' });
    if (!movRes.ok) {
      container.innerHTML = '<div style="color:red;">Error al cargar movimientos</div>';
      return;
    }
    const movData = await movRes.json();
    if (!Array.isArray(movData.movements) || movData.movements.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No hay movimientos en el último arco.</p></div>';
      return;
    }
    // Renderizar solo Egresos
    container.innerHTML = movData.movements
      .filter(m => m.movement_type === 'Egreso')
      .map(m => {
          const date = m.movement_date ? new Date(m.movement_date).toLocaleString() : '';
          return `
            <div class="movimiento-list" data-id="${m.movement_id}" style="border-bottom:1px solid #eee;padding:6px 0;position:relative;">
              <button class="delete-mov" title="Eliminar" style="position:absolute;right:8px;top:8px;border:none;background:transparent;color:#e11d48;font-size:1.1rem;cursor:pointer;">×</button>
              <b>${m.movement_type}</b> | ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(m.amount)}<br>
              <small style="color:#666">${date} — ${m.details || ''}</small>
            </div>
          `
        }).join('')
  } catch (e) {
    const container = document.getElementById('movimientosAgregados');
    if (container) container.innerHTML = '<div style="color:red;">Error al cargar movimientos</div>';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  loadMovimientosUltimoArco();
});

// Delegación para manejar eliminación de movimientos listados (egresos)
document.addEventListener('click', async function(e) {
  if (e.target && e.target.classList && e.target.classList.contains('delete-mov')) {
    const card = e.target.closest('.movimiento-list');
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;
    if (!confirm('Confirmar eliminación del movimiento?')) return;
    try {
      const res = await fetch(`/api/movimientos/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        card.remove();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar movimiento');
      }
    } catch (err) {
      alert('Error de red al eliminar movimiento');
    }
  }
});