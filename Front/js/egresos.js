const agregarBtn = document.getElementById('agregarBtn');
const movimientosPendientes = document.getElementById('movimientosPendientes');
const movimientosAgregados = document.getElementById('movimientosAgregados');

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

  // Solo para pila pendiente (donde se permite eliminar)
  const deleteBtn = div.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', () => {
    div.remove();
  });

  return div;
}


// --- PILA DE MOVIMIENTOS Y ENVÍO AL BACKEND ---
let pilaMovimientos = [];

function obtenerUsuarioActual() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function mapMovimientoForm() {
  const movimiento = document.getElementById('movimiento').value;
  const monto = parseFloat(document.getElementById('monto').value);
  const turno = document.getElementById('turno').value;
  const realizadoPor = document.getElementById('realizadoPor').value;
  const detalle = document.getElementById('detalle').value;
  const usuario = obtenerUsuarioActual();
  return {
    movement_type: 'Egreso',
    amount: monto,
    shift: turno,
    concept_id: 2, // TODO: Mapear correctamente según selección
    details: detalle,
    created_by: usuario ? usuario.user_id : 1 // fallback
  };
}

// Sobrescribe el evento de agregarBtn para pila y renderizado
agregarBtn.addEventListener('click', () => {
  const fechaActual = new Date().toLocaleDateString();
  const movimiento = document.getElementById('movimiento').value;
  const monto = document.getElementById('monto').value;
  const turno = document.getElementById('turno').value;
  const realizadoPor = document.getElementById('realizadoPor').value;

  if (!monto || !movimiento || !turno || !realizadoPor) {
    alert('Por favor completa todos los campos');
    return;
  }

  const mov = mapMovimientoForm();
  pilaMovimientos.push(mov);

  const nuevoMovimiento = crearMovimiento(fechaActual, monto, movimiento, turno, realizadoPor);
  movimientosPendientes.appendChild(nuevoMovimiento);

  document.getElementById('monto').value = '';
  document.getElementById('detalle').value = '';
});

// Enviar a la DB
const enviarBtn = document.querySelector('.enviar-db');
enviarBtn.addEventListener('click', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No autenticado');
    return;
  }
  if (pilaMovimientos.length === 0) {
    alert('No hay movimientos para enviar');
    return;
  }
  try {
    const res = await fetch('/api/movements/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ movements: pilaMovimientos })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Movimientos enviados correctamente');
      pilaMovimientos = [];
      movimientosPendientes.innerHTML = '';
      // Opcional: recargar movimientos agregados desde la DB
    } else {
      alert(data.error || 'Error al enviar movimientos');
    }
  } catch (err) {
    alert('Error de red o servidor');
  }
});

// --- CONTROL DE ARCO ---
async function consultarEstadoArco(turno) {
  const token = localStorage.getItem('token');
  if (!token) return { abierto: false, msg: 'No autenticado' };
  try {
    const res = await fetch(`/arco/estado?turno=${turno}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
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
  const token = localStorage.getItem('token');
  if (!token) return { ok: false, msg: 'No autenticado' };
  try {
    const res = await fetch('/arco/abrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
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

function setArcoUI(abierto, msg) {
  const estadoBox = document.getElementById('arcoEstadoBox');
  const abrirBtn = document.getElementById('abrirArcoBtn');
  const agregarBtn = document.getElementById('agregarBtn');
  const enviarBtn = document.querySelector('.enviar-db');
  if (abierto) {
    estadoBox.style.display = 'none';
    abrirBtn.style.display = 'none';
    agregarBtn.disabled = false;
    if (enviarBtn) enviarBtn.disabled = false;
  } else {
    estadoBox.textContent = msg || 'Debe abrir el arco para operar.';
    estadoBox.style.display = 'block';
    abrirBtn.style.display = 'inline-block';
    agregarBtn.disabled = true;
    if (enviarBtn) enviarBtn.disabled = true;
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const turnoSelect = document.getElementById('turno');
  let turno = turnoSelect ? turnoSelect.value : 'M';
  async function checkArco() {
    const estado = await consultarEstadoArco(turno);
    setArcoUI(estado.abierto, estado.msg);
  }
  await checkArco();
  if (turnoSelect) {
    turnoSelect.addEventListener('change', async function() {
      turno = turnoSelect.value;
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

// Datos de ejemplo ya agregados (sin eliminar)
const datosEjemplo = [
  { fecha: '01/05/2025', monto: 200, movimiento: 'Compra', turno: 'M', realizadoPor: 'Admin' },
  { fecha: '02/05/2025', monto: 150, movimiento: 'Servicio', turno: 'T', realizadoPor: 'Cajero 1' }
];

datosEjemplo.forEach(data => {
  const div = document.createElement('div');
  div.classList.add('movimiento-list');
  div.innerHTML = `
    <p><strong>${data.fecha}</strong> - $${data.monto} - ${data.movimiento} - Turno: ${data.turno} - Por: ${data.realizadoPor}</p>
    <div class="action-buttons">
      <button class="edit-btn">Editar/Ver</button>
    </div>
  `;
  movimientosAgregados.appendChild(div);
});
