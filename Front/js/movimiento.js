// Estado de la aplicación
let arqueoAbierto = false
let arcoIDActual = null
let saldoActual = 0 // Se inicializa en 0, se actualizará con el valor real
let totalIngresos = 0
let totalEgresos = 0

// Estado del conteo de billetes
let billCounts = {
  20000: 0,
  10000: 0,
  2000: 0,
  1000: 0,
  resto: 0,
}

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
const saldoDetailBtn = document.getElementById("saldo-detail")

// Función para formatear moneda
function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount)
}

// Función para formatear números sin símbolo de moneda
function formatNumber(number) {
  return new Intl.NumberFormat("es-AR").format(number)
}

// Función para actualizar la UI
function updateUI() {
  // Actualizar saldo actual
  saldoEl.textContent = formatCurrency(saldoActual)
  // Actualizar saldo inicial
  const saldoInicialEl = document.getElementById("saldo-inicial")
  if (saldoInicialEl) {
    saldoInicialEl.textContent = formatCurrency(window.saldoInicial || 0)
  }
  // Mostrar detalle de ingresos y egresos si está disponible
  const detalleSaldos = document.getElementById("detalle-saldos")
  if (detalleSaldos) {
    detalleSaldos.innerHTML =
      `<span style="color:#10b981;">Ingresos: <b>${formatCurrency(totalIngresos)}</b></span> &nbsp;|&nbsp; ` +
      `<span style="color:#ef4444;">Egresos: <b>${formatCurrency(totalEgresos)}</b></span>`
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

// Función para actualizar el cálculo de billetes
function updateBillCalculation() {
  let totalCounted = 0
  let formula = ""
  const parts = []

  // Calcular totales por denominación
  Object.keys(billCounts).forEach((denomination) => {
    const count = billCounts[denomination]
    const value = denomination === "resto" ? count : Number.parseInt(denomination) * count

    if (denomination === "resto") {
      if (count > 0) {
        parts.push(`Resto $${formatNumber(count)}`)
        totalCounted += count
      }
    } else {
      const denominationFormatted = formatNumber(Number.parseInt(denomination))
      parts.push(`$${denominationFormatted} × ${count}`)
      totalCounted += value

      // Actualizar display individual
      const totalElement = document.getElementById(`total-${denomination}`)
      if (totalElement) {
        totalElement.textContent = formatCurrency(value)
      }
    }
  })

  // Actualizar total del resto
  const totalRestoElement = document.getElementById("total-resto")
  if (totalRestoElement) {
    totalRestoElement.textContent = formatCurrency(billCounts.resto)
  }

  // Crear fórmula
  formula = parts.join(" + ") + ` = ${formatCurrency(totalCounted)}`

  // Actualizar displays
  const calculationFormula = document.getElementById("calculation-formula")
  const totalCountedAmount = document.getElementById("total-counted-amount")
  const differenceAmount = document.getElementById("difference-amount")
  const differenceText = document.getElementById("difference-text")

  if (calculationFormula) calculationFormula.textContent = formula
  if (totalCountedAmount) totalCountedAmount.textContent = formatCurrency(totalCounted)

  // Calcular diferencia
  const difference = totalCounted - saldoActual
  if (differenceAmount) {
    differenceAmount.textContent = formatCurrency(difference)

    // Aplicar color según la diferencia
    differenceAmount.classList.remove("positive", "negative", "neutral")
    if (difference > 0) {
      differenceAmount.classList.add("positive")
    } else if (difference < 0) {
      differenceAmount.classList.add("negative")
    } else {
      differenceAmount.classList.add("neutral")
    }
  }

  // Actualizar texto explicativo
  if (differenceText) {
    differenceText.textContent = `${formatCurrency(totalCounted)} - ${formatCurrency(saldoActual)} = ${formatCurrency(difference)}`
  }
}

// Función para mostrar modal de calculadora de billetes
function showModal() {
  // Resetear contadores
  billCounts = { 20000: 0, 10000: 0, 2000: 0, 1000: 0, resto: 0 }

  // Resetear inputs
  document.querySelectorAll(".bill-quantity").forEach((input) => {
    input.value = input.id === "bill-resto" ? "0.00" : "0"
  })

  // Actualizar saldo del sistema en el modal (sincronizar con el saldo actual)
  modalSaldoValue.textContent = formatCurrency(saldoActual)

  // Actualizar cálculo inicial
  updateBillCalculation()

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
    // Mostrar calculadora de billetes para confirmar cierre
    showModal()
  } else {
    // Abrir nuevo arqueo (POST al backend)
    fetch("/arco/abrir-avanzado", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "turno=M",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        arqueoAbierto = true
        saldoActual = 0
        arcoIDActual = data.id || null
        updateUI()
        showNotification("Nuevo arqueo abierto correctamente")
      })
      .catch(() => {
        showNotification("Error al abrir el arqueo", "error")
      })
  }
})

modalCancel.addEventListener("click", hideModal)


// --- Lógica de cierre de arqueo y retiro de caja ---
modalConfirm.addEventListener("click", () => {
  // Cerrar arco (POST al backend)
  if (!arcoIDActual) {
    showNotification("No se puede cerrar el arco: ID desconocido", "error")
    hideModal()
    return
  }
  // Abrir modal de retiro para que el usuario confirme el monto; el POST de cierre
  // con el monto se realizará cuando confirme el retiro.
  hideModal()
  showRetiroModal()
})

// --- Modal de retiro de caja ---
const retiroModal = document.getElementById("retiro-modal")
const retiroMontoInput = document.getElementById("retiro-monto")
const retiroCancel = document.getElementById("retiro-cancel")
const retiroConfirm = document.getElementById("retiro-confirm")

function showRetiroModal() {
  if (retiroModal) {
    retiroMontoInput.value = 0
    retiroModal.style.display = "flex"
    document.body.style.overflow = "hidden"
  }
}
function hideRetiroModal() {
  if (retiroModal) {
    retiroModal.style.display = "none"
    document.body.style.overflow = ""
  }
}
if (retiroCancel) {
  retiroCancel.addEventListener("click", hideRetiroModal)
}
if (retiroConfirm) {
  retiroConfirm.addEventListener("click", () => {
    const monto = parseFloat(retiroMontoInput.value) || 0
    if (monto > 0) {
      // Enviar cierre y monto de retiro en la misma petición para que el servidor
      // cree el RetiroCaja dentro del cierre (operación atómica en el servidor).
      fetch('/arco/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
        body: `arco_id=${arcoIDActual}&retiro_amount=${monto}`,
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}))
          if (!res.ok) {
            showNotification(body.error || 'Error al cerrar el arqueo y registrar retiro', 'error')
            hideRetiroModal()
            return
          }
          // Éxito: actualizar estado local según la respuesta
          arqueoAbierto = false
          arcoIDActual = null
          showNotification('Arqueo cerrado y retiro registrado', 'success')
          hideRetiroModal()
          // Reconsultar saldo
          fetch('/api/saldo-ultimo-arco', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
              if (typeof data.saldo_total === 'number') saldoActual = data.saldo_total
              if (typeof data.total_ingresos === 'number') totalIngresos = data.total_ingresos
              if (typeof data.total_egresos === 'number') totalEgresos = data.total_egresos
              window.saldoInicial = typeof data.saldo_inicial === 'number' ? data.saldo_inicial : 0
              updateUI()
            }).catch(() => {})
        })
        .catch(() => {
          showNotification('Error al cerrar el arqueo y registrar retiro', 'error')
          hideRetiroModal()
        })
    } else {
      hideRetiroModal()
    }
  })
}

// Cerrar modal al hacer click fuera
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    hideModal()
  }
})

// Event listeners para la calculadora de billetes
document.addEventListener("DOMContentLoaded", () => {
  // Botones + y -
  document.querySelectorAll(".counter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const denomination = button.dataset.denomination
      const input = document.getElementById(`bill-${denomination}`)
      const isPlus = button.classList.contains("plus")

      let currentValue = Number.parseInt(input.value) || 0

      if (isPlus) {
        currentValue++
      } else {
        currentValue = Math.max(0, currentValue - 1)
      }

      input.value = currentValue
      billCounts[denomination] = currentValue
      updateBillCalculation()
    })
  })

  // Inputs directos
  document.querySelectorAll(".bill-quantity").forEach((input) => {
    input.addEventListener("input", () => {
      const denomination = input.dataset.denomination
      let value = Number.parseFloat(input.value) || 0

      if (denomination === "1") {
        // resto
        billCounts.resto = Math.max(0, value)
      } else {
        value = Math.max(0, Number.parseInt(value))
        input.value = value
        billCounts[denomination] = value
      }

      updateBillCalculation()
    })
  })

  // Consultar estado real del arco (toggle)
  fetch("/api/arco-estado", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (typeof data.arco_abierto === "boolean") {
        arqueoAbierto = data.arco_abierto
        if (data.arco && typeof data.arco.id !== "undefined") {
          arcoIDActual = data.arco.id
        }
        updateUI()
      }
    })

  // Mostrar usuario actual si está disponible en el HTML
  const usuarioActual = document.getElementById("usuario-actual")
  if (usuarioActual && usuarioActual.textContent.includes("{{USUARIO_ACTUAL}}")) {
    // Si el backend no reemplazó el placeholder, ocultar el mensaje
    usuarioActual.parentElement.style.display = "none"
  }

  // Consultar saldo actual y saldo inicial del backend (usando la vista)
  fetch("/api/saldo-ultimo-arco", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      // Usar saldo_total, que es el saldo actualizado de la vista
      if (typeof data.saldo_total === "number") {
        saldoActual = data.saldo_total
      } else {
        saldoActual = 0
      }
      // Asignar totales de ingresos y egresos correctamente
      if (typeof data.total_ingresos === "number") {
        totalIngresos = data.total_ingresos
      } else {
        totalIngresos = 0
      }
      if (typeof data.total_egresos === "number") {
        totalEgresos = data.total_egresos
      } else {
        totalEgresos = 0
      }
      // Mostrar saldo inicial si lo necesitas en el front
      if (typeof data.saldo_inicial === "number") {
        window.saldoInicial = data.saldo_inicial
      } else {
        window.saldoInicial = 0
      }
      updateUI()
    })
    .catch(() => {
      saldoActual = 0
      window.saldoInicial = 0
      updateUI()
    })
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

// Detalle del saldo
saldoDetailBtn.addEventListener("click", () => {
  if (!arcoIDActual) {
    showNotification("No hay un arqueo abierto para mostrar movimientos", "warning")
    return
  }
  const modalMov = document.getElementById("modal-movimientos")
  const movList = document.getElementById("movimientos-list")
  movList.innerHTML = '<div style="text-align:center;">Cargando movimientos...</div>'
  modalMov.style.display = "block"
  document.body.style.overflow = "hidden"
  fetch(`/api/movimientos/arco/${arcoIDActual}`, { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (Array.isArray(data.movements) && data.movements.length > 0) {
        movList.innerHTML = data.movements
          .map(
            (m) =>
              `<div class='movimiento-list' style='border-bottom:1px solid #eee;padding:6px 0;'>
            <b>${m.movement_type}</b> | $${m.amount.toFixed(2)} | ${m.details || ""} <br>
            <span style='font-size:0.9em;color:#888;'>${new Date(m.movement_date).toLocaleString()} | Concepto: ${m.concept_id}</span>
          </div>`,
          )
          .join("")
      } else {
        movList.innerHTML = '<div style="text-align:center;">No hay movimientos para este arco.</div>'
      }
    })
    .catch(() => {
      movList.innerHTML = '<div style="color:red;text-align:center;">Error al cargar movimientos</div>'
    })
})

// Cerrar modal de movimientos
document
  .getElementById("modal-movimientos-cerrar")
  .addEventListener("click", () => {
    document.getElementById("modal-movimientos").style.display = "none"
    document.body.style.overflow = ""
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

// Manejo de teclas (opcional)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("show")) {
    hideModal()
  }
})
