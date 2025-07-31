// Estado de la aplicación
let arqueoAbierto = false
let arcoIDActual = null;
let saldoActual = 0 // Se inicializa en 0, se actualizará con el valor real
let totalIngresos = 0;
let totalEgresos = 0;

// Referencias DOM
const btnIngresos = document.getElementById("btn-ingresos")
const btnEgresos = document.getElementById("btn-egresos")
const linkMovimientos = document.getElementById("link-movimientos")
const toggle = document.getElementById("toggle-arqueo")
const estadoText = document.getElementById("estado-text")
const estadoSubtitle = document.getElementById("estado-subtitle")
const saldoEl = document.getElementById("saldo")
const saldoIndicator = document.getElementById("saldo-indicator")
const modal = document.getElementById("confirmation-modal")
const modalCancel = document.getElementById("modal-cancel")
const modalConfirm = document.getElementById("modal-confirm")
const modalSaldoValue = document.getElementById("modal-saldo-value")
const saldoDetailBtn = document.getElementById("saldo-detail") // Agregada referencia DOM

// Función para formatear moneda
function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount)
}

// Función para actualizar la UI
function updateUI() {
  // Actualizar saldo
  saldoEl.textContent = formatCurrency(saldoActual)
  // Mostrar detalle de ingresos y egresos si está disponible
  const detalleSaldos = document.getElementById("detalle-saldos");
  if (detalleSaldos) {
    detalleSaldos.innerHTML =
      `<span style="color:#10b981;">Ingresos: <b>${formatCurrency(totalIngresos)}</b></span> &nbsp;|&nbsp; ` +
      `<span style="color:#ef4444;">Egresos: <b>${formatCurrency(totalEgresos)}</b></span>`;
  }

  // Aplicar clases según el saldo
  saldoEl.classList.remove("positive", "negative")
  saldoIndicator.classList.remove("positive", "negative")

  if (saldoActual >= 0) {
    saldoEl.classList.add("positive")
    saldoIndicator.classList.add("positive")
  } else {
    saldoEl.classList.add("negative")
    saldoIndicator.classList.add("negative")
  }

  // Actualizar estado del toggle
  if (arqueoAbierto) {
    toggle.classList.add("open")
    estadoText.textContent = "Arqueo abierto"
    estadoSubtitle.textContent = "Presiona para cerrar el arqueo actual"
  } else {
    toggle.classList.remove("open")
    estadoText.textContent = "Arqueo cerrado"
    estadoSubtitle.textContent = "Presiona para abrir un nuevo arqueo"
  }
}

// Función para mostrar modal
function showModal() {
  modalSaldoValue.textContent = formatCurrency(saldoActual)
  modal.classList.add("show")
  document.body.style.overflow = "hidden"
}

// Función para ocultar modal
function hideModal() {
  modal.classList.remove("show")
  document.body.style.overflow = ""
}

// Función para mostrar notificación (simulada)
function showNotification(message, type = "success") {
  // Aquí podrías implementar un sistema de notificaciones
  console.log(`${type.toUpperCase()}: ${message}`)
}

// Event Listeners
toggle.addEventListener("click", () => {
  if (arqueoAbierto) {
    // Confirmar cierre
    showModal();
  } else {
    // Abrir nuevo arqueo (POST al backend)
    fetch("/arco/abrir-avanzado", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "turno=M",
      credentials: "include"
    })
      .then(res => res.json())
      .then(data => {
        arqueoAbierto = true;
        saldoActual = 0;
        arcoIDActual = data.id || null;
        updateUI();
        showNotification("Nuevo arqueo abierto correctamente");
      })
      .catch(() => {
        showNotification("Error al abrir el arqueo", "error");
      });
  }
})

modalCancel.addEventListener("click", hideModal)

modalConfirm.addEventListener("click", () => {
  // Cerrar arco (POST al backend)
  if (!arcoIDActual) {
    showNotification("No se puede cerrar el arco: ID desconocido", "error");
    hideModal();
    return;
  }
  fetch("/arco/cerrar", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `arco_id=${arcoIDActual}`,
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      arqueoAbierto = false;
      arcoIDActual = null;
      hideModal();
      updateUI();
      showNotification("Arqueo cerrado correctamente");
    })
    .catch(() => {
      hideModal();
      showNotification("Error al cerrar el arqueo", "error");
    });
})

// Cerrar modal al hacer click fuera
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    hideModal()
  }
})

// Navegación
btnIngresos.addEventListener("click", () => {
  if (!arqueoAbierto) {
    showNotification("Debes abrir un arqueo antes de registrar movimientos", "warning")
    return
  }
  window.location.href = "/ingresos"
})

btnEgresos.addEventListener("click", () => {
  if (!arqueoAbierto) {
    showNotification("Debes abrir un arqueo antes de registrar movimientos", "warning")
    return
  }
  window.location.href = "/egresos"
})

linkMovimientos.addEventListener("click", (e) => {
  e.preventDefault()
  window.location.href = "/arqueos/ultimo/movements"
})

// Detalle del saldo (por ahora solo muestra mensaje)
saldoDetailBtn.addEventListener("click", () => {
  // Por ahora solo muestra un mensaje, en el futuro navegará al detalle
  showNotification("Función de detalle del saldo próximamente disponible", "info")
  console.log("Navegando al detalle del saldo...")
  // Futuro: window.location.href = "/saldo/detalle"
})

// Efectos de hover para los botones
;[btnIngresos, btnEgresos].forEach((btn) => {
  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "translateY(-2px) scale(1.02)"
  })

  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "translateY(0) scale(1)"
  })
})

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  // Consultar estado real del arco (toggle)
  fetch("/api/arco-estado", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (typeof data.arco_abierto === "boolean") {
        arqueoAbierto = data.arco_abierto;
        if (data.arco && typeof data.arco.id !== "undefined") {
          arcoIDActual = data.arco.id;
        }
        updateUI();
      }
    });
  // Mostrar usuario actual si está disponible en el HTML
  const usuarioActual = document.getElementById("usuario-actual")
  if (usuarioActual && usuarioActual.textContent.includes("{{USUARIO_ACTUAL}}")) {
    // Si el backend no reemplazó el placeholder, ocultar el mensaje
    usuarioActual.parentElement.style.display = "none"
  }

  // Consultar saldo real del backend
  fetch("/api/saldo-ultimo-arco", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      console.log("[DEBUG] Respuesta saldo del backend:", data);
      if (typeof data.SaldoTotal === "number") {
        saldoActual = data.SaldoTotal;
        totalIngresos = typeof data.TotalIngresos === "number" ? data.TotalIngresos : 0;
        totalEgresos = typeof data.TotalEgresos === "number" ? data.TotalEgresos : 0;
        updateUI();
      }
    })
    .catch(() => {
      // Si falla, mostrar 0
      saldoActual = 0;
      updateUI();
    });
})

// Manejo de teclas (opcional)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("show")) {
    hideModal()
  }
})
