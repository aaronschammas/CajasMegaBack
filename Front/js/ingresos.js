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

  // Función para eliminar el movimiento de la pila
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
  // Asegurarse de que el input hidden existe y tiene el valor correcto
  const createdByInput = document.getElementsByName('created_by')[0] || document.getElementById('created_by');
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

// ÚNICO listener profesional para agregar a la pila y renderizar
agregarBtn.addEventListener('click', () => {
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

  pilaMovimientos.push(mov);

  //la pila visual
  const nuevoMovimiento = crearMovimiento(
    fechaActual,
    mov.amount,
    mov.movement_type,
    mov.shift,
    mov.created_by
  );
  movimientosPendientes.appendChild(nuevoMovimiento);

  // Limpiar campos
  document.getElementById('amount').value = '';
  document.getElementById('details').value = '';
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

const datosEjemplo = [
  { fecha: '01/05/2025', monto: 500, movimiento: 'Venta', turno: 'M', realizadoPor: 'Admin' },
  { fecha: '02/05/2025', monto: 300, movimiento: 'Servicio', turno: 'T', realizadoPor: 'Cajero 1' }
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

// Al hacer submit el formulario, serializa la pila y la envía por POST
const formEnviar = document.getElementById('formEnviarMovimientos');
const inputMovimientos = document.getElementById('inputMovimientos');
if (formEnviar) {
  formEnviar.addEventListener('submit', function(e) {
    // Serializa la pila de movimientos como JSON en el input oculto
    inputMovimientos.value = JSON.stringify(pilaMovimientos);
    // El submit sigue su curso (no se hace fetch, solo se serializa)
  });
}

document.addEventListener('DOMContentLoaded', function() {
  if (window.CONCEPTS && Array.isArray(window.CONCEPTS)) {
    const conceptSelect = document.getElementById('concept_id');
    if (conceptSelect) {
      conceptSelect.innerHTML = '';
      window.CONCEPTS.forEach(function(concept) {
        const option = document.createElement('option');
        option.value = concept.concept_id;
        option.textContent = concept.concept_name + ' (' + concept.movement_type_association + ')';
        conceptSelect.appendChild(option);
      });
    }
  }
});