// Estado de la aplicación
let arqueoAbierto = false
let arcoIDActual = null
let saldoActual = 0
let saldoInicial = 0
let totalIngresos = 0
let totalEgresos = 0
let datosArcoActual = null

// NUEVO: Estado de tipo de caja (para Administrador General)
let tipoCajaActual = 'personal'
let isAdminGeneral = false

// Estado del conteo de billetes (cierre)
let billCounts = { 20000: 0, 10000: 0, 2000: 0, 1000: 0, resto: 0 }

// Estado del conteo de billetes para retiro
let retiroBillCounts = { 20000: 0, 10000: 0, 2000: 0, 1000: 0, resto: 0 }

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

function getCajaParams() {
  const params = new URLSearchParams()
  if (isAdminGeneral && tipoCajaActual === 'global') params.append('is_global', 'true')
  return params.toString()
}

function getCajaBody() {
  return (isAdminGeneral && tipoCajaActual === 'global') ? '&is_global=true' : ''
}

function updateCajaLabel() {
  const estadoSubtitle = document.getElementById('estado-subtitle')
  if (isAdminGeneral) {
    const tipo = tipoCajaActual === 'global' ? '🌐 Caja Global' : '🏠 Caja Personal'
    const originalText = estadoSubtitle.textContent.split(' - ')[0]
    estadoSubtitle.textContent = `${originalText} - ${tipo}`
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(amount)
}

function formatNumber(number) {
  return new Intl.NumberFormat("es-AR").format(number)
}

function updateUI() {
  saldoEl.textContent = formatCurrency(saldoActual)
  const detalleSaldos = document.getElementById("detalle-saldos")
  if (detalleSaldos) {
    detalleSaldos.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:flex-end;align-items:center;">
      <span style="color:#6366f1;font-weight:600;">Inicial: <b>${formatCurrency(saldoInicial)}</b></span>
      <span style="color:#10b981;"> Ingresos: <b>${formatCurrency(totalIngresos)}</b></span>
      <span style="color:#ef4444;">Egresos: <b>${formatCurrency(totalEgresos)}</b></span>
      <span style="color:#6b7280;font-size:0.9em;">| Total = Inicial + Ingresos - Egresos</span>
    </div>`
  }
  
  // Actualizar badge de tipo de caja (solo para Admin)
  if (isAdminGeneral) {
    const badge = document.getElementById('tipo-caja-badge')
    const icon = document.getElementById('tipo-caja-icon')
    const text = document.getElementById('tipo-caja-text')
    
    if (badge && icon && text) {
      badge.style.display = 'flex'
      badge.style.gap = '6px'
      badge.style.alignItems = 'center'
      
      if (tipoCajaActual === 'global') {
        badge.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
        badge.style.boxShadow = '0 2px 4px rgba(245,158,11,0.3)'
        icon.className = 'fas fa-globe'
        text.textContent = 'Caja Global'
      } else {
        badge.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
        badge.style.boxShadow = '0 2px 4px rgba(59,130,246,0.3)'
        icon.className = 'fas fa-home'
        text.textContent = 'Caja Personal'
      }
    }
  }
  
  saldoEl.classList.remove("positive", "negative")
  saldoIndicator.classList.remove("positive", "negative")
  if (saldoActual >= 0) {
    saldoEl.classList.add("positive")
    saldoIndicator.classList.add("positive")
  } else {
    saldoEl.classList.add("negative")
    saldoIndicator.classList.add("negative")
  }
  if (arqueoAbierto) {
    toggle.classList.add("open")
    estadoText.textContent = "Arqueo abierto"
    estadoSubtitle.textContent = "Presiona para cerrar el arqueo actual"
  } else {
    toggle.classList.remove("open")
    estadoText.textContent = "Arqueo cerrado"
    estadoSubtitle.textContent = "Presiona para abrir un nuevo arqueo"
  }
  updateCajaLabel()
}

function updateBillCalculation() {
  let totalCounted = 0
  const parts = []
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
      const totalElement = document.getElementById(`total-${denomination}`)
      if (totalElement) totalElement.textContent = formatCurrency(value)
    }
  })
  const totalRestoElement = document.getElementById("total-resto")
  if (totalRestoElement) totalRestoElement.textContent = formatCurrency(billCounts.resto)
  const formula = parts.join(" + ") + ` = ${formatCurrency(totalCounted)}`
  const calculationFormula = document.getElementById("calculation-formula")
  const totalCountedAmount = document.getElementById("total-counted-amount")
  const differenceAmount = document.getElementById("difference-amount")
  const differenceText = document.getElementById("difference-text")
  if (calculationFormula) calculationFormula.textContent = formula
  if (totalCountedAmount) totalCountedAmount.textContent = formatCurrency(totalCounted)
  const difference = totalCounted - saldoActual
  if (differenceAmount) {
    differenceAmount.textContent = formatCurrency(difference)
    differenceAmount.classList.remove("positive", "negative", "neutral")
    if (difference > 0) differenceAmount.classList.add("positive")
    else if (difference < 0) differenceAmount.classList.add("negative")
    else differenceAmount.classList.add("neutral")
  }
  if (differenceText) {
    differenceText.textContent = `${formatCurrency(totalCounted)} - ${formatCurrency(saldoActual)} = ${formatCurrency(difference)}`
  }
}

function updateRetiroBillCalculation() {
  let totalRetiro = 0
  Object.keys(retiroBillCounts).forEach((denomination) => {
    const count = retiroBillCounts[denomination]
    const value = denomination === "resto" ? count : Number.parseInt(denomination) * count
    totalRetiro += value
    const totalElement = document.getElementById(`retiro-total-${denomination}`)
    if (totalElement) totalElement.textContent = formatCurrency(value)
  })
  const retiroTotalAmount = document.getElementById("retiro-total-amount")
  if (retiroTotalAmount) retiroTotalAmount.textContent = formatCurrency(totalRetiro)
  return totalRetiro
}

function showModal() {
  billCounts = { 20000: 0, 10000: 0, 2000: 0, 1000: 0, resto: 0 }
  document.querySelectorAll(".bill-quantity").forEach((input) => {
    if (!input.id.startsWith('retiro-')) input.value = input.id === "bill-resto" ? "0.00" : "0"
  })
  modalSaldoValue.textContent = formatCurrency(saldoActual)
  updateBillCalculation()
  modal.classList.add("show")
  document.body.style.overflow = "hidden"
}

function hideModal() {
  modal.classList.remove("show")
  document.body.style.overflow = ""
}

function showNotification(message, type = "success") {
  console.log(`${type.toUpperCase()}: ${message}`)
  const notification = document.createElement('div')
  notification.style.cssText = `position:fixed;top:20px;right:20px;padding:15px 20px;background:${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};color:white;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);z-index:10000;font-weight:500;max-width:400px;`
  notification.textContent = message
  document.body.appendChild(notification)
  setTimeout(() => notification.remove(), 3000)
}

function recargarDatosCaja() {
  const tipoCaja = tipoCajaActual === 'global' ? 'GLOBAL' : 'PERSONAL'
  console.log(`[RECARGA] Iniciando recarga de datos para caja ${tipoCaja}`)
  
  const params = getCajaParams()
  const url = params ? `/api/arco-estado?${params}` : '/api/arco-estado'
  console.log(`[RECARGA] Consultando estado del arco: ${url}`)
  
  fetch(url, { credentials: "include" }).then((res) => res.json()).then((data) => {
    console.log(`[RECARGA] Estado del arco recibido:`, data)
    if (typeof data.arco_abierto === "boolean") {
      arqueoAbierto = data.arco_abierto
      if (data.arco && typeof data.arco.id !== "undefined") {
        arcoIDActual = data.arco.id
        datosArcoActual = data.arco
        if (typeof data.arco.saldo_inicial === "number") saldoInicial = data.arco.saldo_inicial
        console.log(`[RECARGA] Arco ID: ${arcoIDActual}, Saldo Inicial: ${saldoInicial}`)
      }
      updateUI()
    }
  }).catch((err) => console.error('[ERROR] No se pudo obtener estado del arco:', err))
  
  const saldoParams = getCajaParams()
  const saldoUrl = saldoParams ? `/api/saldo-ultimo-arco?${saldoParams}` : '/api/saldo-ultimo-arco'
  console.log(`[RECARGA] Consultando saldo: ${saldoUrl}`)
  
  fetch(saldoUrl, { credentials: "include" }).then((res) => res.json()).then((data) => {
    console.log(`[RECARGA] Saldo recibido:`, data)
    saldoInicial = typeof data.saldo_inicial === "number" ? data.saldo_inicial : 0
    saldoActual = typeof data.saldo_total === "number" ? data.saldo_total : saldoInicial
    totalIngresos = typeof data.total_ingresos === "number" ? data.total_ingresos : 0
    totalEgresos = typeof data.total_egresos === "number" ? data.total_egresos : 0
    console.log(`[RECARGA] Saldo actualizado - Inicial: ${formatCurrency(saldoInicial)}, Total: ${formatCurrency(saldoActual)}, Ingresos: ${formatCurrency(totalIngresos)}, Egresos: ${formatCurrency(totalEgresos)}`)
    updateUI()
  }).catch((err) => {
    console.error('[ERROR] No se pudo obtener el saldo:', err)
    saldoActual = 0
    saldoInicial = 0
    updateUI()
  })
}

function mostrarResumenCierre(arcoData, totalContado, retiroMonto, diferencia) {
  const resumenModal = document.getElementById('resumen-cierre-modal')
  const resumenContent = document.getElementById('resumen-cierre-content')
  const fechaCierre = arcoData.fecha_cierre ? new Date(arcoData.fecha_cierre) : new Date()
  const fechaApertura = arcoData.fecha_apertura ? new Date(arcoData.fecha_apertura) : new Date()
  const contenidoHTML = `
    <div class="tirilla-header">
      <h2 style="margin:0 0 10px 0;">MEGAADMIN</h2>
      <p style="margin:0;font-size:0.9em;">Cierre de Caja</p>
      <p style="margin:5px 0 0 0;font-size:0.85em;">${fechaCierre.toLocaleString('es-AR')}</p>
    </div>
    <div style="margin:15px 0;">
      <div class="tirilla-row"><span>Usuario:</span><span><strong>${arcoData.usuario ? arcoData.usuario.full_name : 'N/A'}</strong></span></div>
      <div class="tirilla-row"><span>Turno:</span><span><strong>${arcoData.turno === 'M' ? 'Mañana' : 'Tarde'}</strong></span></div>
      <div class="tirilla-row"><span>Apertura:</span><span>${fechaApertura.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span></div>
      <div class="tirilla-row"><span>Cierre:</span><span>${fechaCierre.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span></div>
    </div>
    <div style="margin:15px 0;">
      <div class="tirilla-row"><span>Saldo Inicial:</span><span>${formatCurrency(arcoData.saldo_inicial || 0)}</span></div>
      <div class="tirilla-row" style="color:#10b981;"><span>+ Ingresos:</span><span>${formatCurrency(totalIngresos)}</span></div>
      <div class="tirilla-row" style="color:#ef4444;"><span>- Egresos:</span><span>${formatCurrency(totalEgresos)}</span></div>
      ${retiroMonto > 0 ? `<div class="tirilla-row" style="color:#f59e0b;"><span>- Retiro:</span><span>${formatCurrency(retiroMonto)}</span></div>` : ''}
      <div class="tirilla-row total"><span>SALDO FINAL:</span><span>${formatCurrency(arcoData.saldo_final || 0)}</span></div>
    </div>
    ${totalContado > 0 ? `<div style="margin:15px 0;padding-top:10px;border-top:2px dashed #000;">
      <div class="tirilla-row"><span>Total Contado:</span><span><strong>${formatCurrency(totalContado)}</strong></span></div>
      <div class="tirilla-row" style="color:${diferencia === 0 ? '#10b981' : diferencia > 0 ? '#f59e0b' : '#ef4444'};"><span>Diferencia:</span><span><strong>${formatCurrency(diferencia)}</strong></span></div>
    </div>` : ''}
    <div class="tirilla-footer">
      <p style="margin:5px 0;">Gracias por usar MegaAdmin</p>
      <p style="margin:5px 0;font-size:0.8em;">Sistema de Gestión de Caja</p>
    </div>`
  resumenContent.innerHTML = contenidoHTML
  resumenModal.style.display = 'flex'
  document.body.style.overflow = 'hidden'
}

document.addEventListener("DOMContentLoaded", () => {
  toggle.addEventListener("click", () => {
    if (arqueoAbierto) {
      showModal()
    } else {
      const bodyParams = `turno=M${getCajaBody()}`
      const tipoCaja = tipoCajaActual === 'global' ? 'Caja Global' : 'Caja Personal'
      fetch("/arco/abrir-avanzado", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: bodyParams, credentials: "include" })
        .then((res) => res.json()).then((data) => {
          arqueoAbierto = true
          arcoIDActual = data.id || null
          datosArcoActual = data
          saldoInicial = data.saldo_inicial || 0
          saldoActual = saldoInicial
          totalIngresos = 0
          totalEgresos = 0
          updateUI()
          showNotification(`✅ ${tipoCaja} abierta correctamente. Saldo inicial: ${formatCurrency(saldoInicial)}`)
        }).catch(() => showNotification(`❌ Error al abrir ${tipoCaja}`, "error"))
    }
  })

  modalCancel.addEventListener("click", hideModal)

  modalConfirm.addEventListener("click", () => {
    if (!arcoIDActual) {
      showNotification("No se puede cerrar el arco: ID desconocido", "error")
      hideModal()
      return
    }
    let totalCounted = 0
    Object.keys(billCounts).forEach((denomination) => {
      const count = billCounts[denomination]
      const value = denomination === "resto" ? count : Number.parseInt(denomination) * count
      totalCounted += value
    })
    const difference = totalCounted - saldoActual
    if (Math.abs(difference) > 0.01) {
      const confirmar = confirm(
        `⚠️ ATENCIÓN: Hay una diferencia de ${formatCurrency(Math.abs(difference))} ${difference > 0 ? 'de más' : 'de menos'}.\n\n` +
        `Total contado: ${formatCurrency(totalCounted)}\nSaldo del sistema: ${formatCurrency(saldoActual)}\n\n` +
        `¿Está seguro que desea cerrar el arqueo con esta diferencia?`
      )
      if (!confirmar) return
    }
    hideModal()
    showRetiroModal(totalCounted)
  })

  const retiroModal = document.getElementById("retiro-modal")
  const retiroCancel = document.getElementById("retiro-cancel")
  const retiroConfirm = document.getElementById("retiro-confirm")
  let totalContadoCierre = 0

  function showRetiroModal(totalContado) {
    totalContadoCierre = totalContado
    retiroBillCounts = { 20000: 0, 10000: 0, 2000: 0, 1000: 0, resto: 0 }
    document.querySelectorAll(".bill-quantity").forEach((input) => {
      if (input.id.startsWith('retiro-')) input.value = input.id === "retiro-bill-resto" ? "0.00" : "0"
    })
    updateRetiroBillCalculation()
    if (retiroModal) {
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
  
  if (retiroCancel) retiroCancel.addEventListener("click", () => procesarCierreArco(0, totalContadoCierre))
  if (retiroConfirm) retiroConfirm.addEventListener("click", () => procesarCierreArco(updateRetiroBillCalculation(), totalContadoCierre))
  
  function procesarCierreArco(retiroMonto, totalContado) {
    hideRetiroModal()
    fetch('/arco/cerrar', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'include',
      body: `arco_id=${arcoIDActual}&retiro_amount=${retiroMonto}&total_contado=${totalContado}`
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showNotification(body.error || 'Error al cerrar el arqueo', 'error')
        return
      }
      arqueoAbierto = false
      const arcoData = body.arco || datosArcoActual
      const diferencia = body.diferencia || 0
      mostrarResumenCierre(arcoData, totalContado, retiroMonto, diferencia)
      arcoIDActual = null
      datosArcoActual = null
      recargarDatosCaja()
    }).catch(() => showNotification('Error al cerrar el arqueo', 'error'))
  }

  const resumenCerrar = document.getElementById('resumen-cerrar')
  const resumenImprimir = document.getElementById('resumen-imprimir')
  if (resumenCerrar) {
    resumenCerrar.addEventListener('click', () => {
      document.getElementById('resumen-cierre-modal').style.display = 'none'
      document.body.style.overflow = ''
      showNotification('✅ Arqueo cerrado correctamente', 'success')
    })
  }
  if (resumenImprimir) resumenImprimir.addEventListener('click', () => window.print())

  modal.addEventListener("click", (e) => { if (e.target === modal) hideModal() })

  fetch('/api/me', { credentials: 'include' }).then(res => res.json()).then(data => {
    if (data.role === 'Administrador General') {
      isAdminGeneral = true
      // Mostrar selector de tipo de caja
      const cajaSelector = document.getElementById('caja-selector')
      if (cajaSelector) cajaSelector.style.display = 'block'
      // Mostrar botón de Alquileres en el navbar (solo Admin General)
      const navAlquileres = document.getElementById('nav-alquileres-item')
      if (navAlquileres) navAlquileres.style.display = 'list-item'
      
      // Event listener para cambio de tipo de caja
      const tipoCajaSelect = document.getElementById('tipo-caja-select')
      const cajaInfo = document.getElementById('caja-info')
      const cajaInfoText = document.getElementById('caja-info-text')
      
      if (tipoCajaSelect) {
        tipoCajaSelect.addEventListener('change', (e) => {
          tipoCajaActual = e.target.value
          console.log(`[CAJA] Cambiando a caja ${tipoCajaActual}`)
          
          // Mostrar información según el tipo de caja
          if (cajaInfo && cajaInfoText) {
            cajaInfo.style.display = 'block'
            if (tipoCajaActual === 'global') {
              cajaInfoText.textContent = 'Estás viendo la Caja Global. Los movimientos aquí afectan a todos los usuarios. Tus movimientos personales se replican automáticamente aquí.'
              cajaInfo.style.background = '#fef3c7'
              cajaInfo.style.borderLeftColor = '#f59e0b'
              cajaInfoText.style.color = '#78350f'
            } else {
              cajaInfoText.textContent = 'Estás viendo tu Caja Personal. Los movimientos que registres aquí también se agregarán automáticamente a la Caja Global.'
              cajaInfo.style.background = '#e0f2fe'
              cajaInfo.style.borderLeftColor = '#0284c7'
              cajaInfoText.style.color = '#0c4a6e'
            }
          }
          
          // Re-animar el badge del saldo
          const badge = document.getElementById('tipo-caja-badge')
          if (badge) {
            badge.style.animation = 'none'
            setTimeout(() => {
              badge.style.animation = 'badgePulse 0.5s ease'
            }, 10)
          }
          
          const mensaje = tipoCajaActual === 'global' ? '🌐 Caja Global (Todos)' : '🏠 Mi Caja Personal'
          showNotification(`Cambiando a ${mensaje}...`, 'info')
          
          // Recargar datos de la nueva caja
          console.log('[CAJA] Recargando datos del saldo...')
          recargarDatosCaja()
        })
      }
    }
  }).catch(err => console.error('[ERROR] No se pudo obtener info del usuario:', err))

  document.querySelectorAll(".counter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const denomination = button.dataset.denomination
      const tipoModal = button.dataset.type || 'cierre'
      const isPlus = button.classList.contains("plus")
      const inputId = tipoModal === 'retiro' ? `retiro-bill-${denomination}` : `bill-${denomination}`
      const input = document.getElementById(inputId)
      if (!input) return
      let currentValue = Number.parseInt(input.value) || 0
      if (isPlus) currentValue++
      else currentValue = Math.max(0, currentValue - 1)
      input.value = currentValue
      if (tipoModal === 'retiro') {
        retiroBillCounts[denomination] = currentValue
        updateRetiroBillCalculation()
      } else {
        billCounts[denomination] = currentValue
        updateBillCalculation()
      }
    })
  })

  document.querySelectorAll(".bill-quantity").forEach((input) => {
    input.addEventListener("input", () => {
      const denomination = input.dataset.denomination
      const isRetiro = input.id.startsWith('retiro-')
      let value = Number.parseFloat(input.value) || 0
      if (denomination === "1") {
        value = Math.max(0, value)
        if (isRetiro) {
          retiroBillCounts.resto = value
          updateRetiroBillCalculation()
        } else {
          billCounts.resto = value
          updateBillCalculation()
        }
      } else {
        value = Math.max(0, Number.parseInt(value))
        input.value = value
        if (isRetiro) {
          retiroBillCounts[denomination] = value
          updateRetiroBillCalculation()
        } else {
          billCounts[denomination] = value
          updateBillCalculation()
        }
      }
    })
  })

  const params = getCajaParams()
  const url = params ? `/api/arco-estado?${params}` : '/api/arco-estado'
  fetch(url, { credentials: "include" }).then((res) => res.json()).then((data) => {
    console.log("[ARCO-ESTADO] Respuesta del servidor:", data)
    if (typeof data.arco_abierto === "boolean") {
      arqueoAbierto = data.arco_abierto
      if (data.arco && typeof data.arco.id !== "undefined") {
        arcoIDActual = data.arco.id
        datosArcoActual = data.arco
        if (typeof data.arco.saldo_inicial === "number") {
          saldoInicial = data.arco.saldo_inicial
          console.log("[ARCO] Saldo inicial del arco actual:", saldoInicial)
        }
      }
      updateUI()
    }
  }).catch((err) => console.error('[ERROR] No se pudo obtener estado del arco:', err))

  const usuarioActual = document.getElementById("usuario-actual")
  if (usuarioActual && usuarioActual.textContent.includes("{{USUARIO_ACTUAL}}")) {
    usuarioActual.parentElement.style.display = "none"
  }

  const saldoParams = getCajaParams()
  const saldoUrl = saldoParams ? `/api/saldo-ultimo-arco?${saldoParams}` : '/api/saldo-ultimo-arco'
  fetch(saldoUrl, { credentials: "include" }).then((res) => res.json()).then((data) => {
    console.log("[DEBUG] Datos recibidos del backend:", data)
    saldoInicial = typeof data.saldo_inicial === "number" ? data.saldo_inicial : 0
    console.log("[SALDO] Saldo inicial:", saldoInicial)
    saldoActual = typeof data.saldo_total === "number" ? data.saldo_total : saldoInicial
    console.log("[SALDO] Saldo total (incluye inicial):", saldoActual)
    totalIngresos = typeof data.total_ingresos === "number" ? data.total_ingresos : 0
    totalEgresos = typeof data.total_egresos === "number" ? data.total_egresos : 0
    console.log("[SALDO] Resumen:", { inicial: saldoInicial, ingresos: totalIngresos, egresos: totalEgresos, total: saldoActual })
    updateUI()
  }).catch((err) => {
    console.error("[ERROR] No se pudo obtener el saldo:", err)
    saldoActual = 0
    saldoInicial = 0
    updateUI()
  })

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
    window.location.href = "/historial-movimientos"
  })

  // Variable para trackear qué vista de modal está activa
  let vistaModalActual = 'personal'
  
  // Función para cargar movimientos del modal
  function cargarMovimientosModal(tipoVista) {
    const movList = document.getElementById("movimientos-list")
    movList.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 2em; color: #3b82f6;"></i><p style="margin-top: 10px; color: #6b7280;">Cargando movimientos...</p></div>'
    
    // Si es vista global y el usuario es admin, cargar todos los movimientos de cajas globales
    if (tipoVista === 'global' && isAdminGeneral) {
      // Primero obtener el arco global activo
      const params = new URLSearchParams()
      params.append('is_global', 'true')
      
      fetch(`/api/arco-estado?${params.toString()}`, { credentials: "include" })
        .then((res) => res.json())
        .then((dataArco) => {
          if (dataArco.arco_abierto && dataArco.arco && dataArco.arco.id) {
            // Cargar movimientos del arco global
            return fetch(`/api/movimientos/arco/${dataArco.arco.id}`, { credentials: "include" })
          } else {
            throw new Error('No hay arco global abierto')
          }
        })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.movements) && data.movements.length > 0) {
            movList.innerHTML = `
              <div style="margin-bottom: 15px; padding: 12px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; border-radius: 8px;">
                <p style="margin: 0; color: #92400e; font-weight: 600;"><i class="fas fa-globe" style="margin-right: 8px;"></i>Vista de Caja Global</p>
                <p style="margin: 5px 0 0 0; color: #78350f; font-size: 0.9em;">Mostrando todos los movimientos consolidados</p>
              </div>
            ` + data.movements.map((m) => {
              const tipoClass = m.movement_type === 'Ingreso' ? 'success' : 'danger'
              const tipoIcon = m.movement_type === 'Ingreso' ? 'arrow-up' : 'arrow-down'
              const conceptName = m.concept ? m.concept.concept_name : `Concepto ${m.concept_id}`
              return `
                <div class='movimiento-item' style='border-bottom:1px solid #e5e7eb; padding:15px 0; display: flex; align-items: center; gap: 15px;'>
                  <div style='width: 40px; height: 40px; border-radius: 50%; background: ${tipoClass === 'success' ? '#d1fae5' : '#fee2e2'}; display: flex; align-items: center; justify-content: center;'>
                    <i class="fas fa-${tipoIcon}" style="color: ${tipoClass === 'success' ? '#059669' : '#dc2626'};"></i>
                  </div>
                  <div style='flex: 1;'>
                    <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;'>
                      <strong style='color: #1f2937; font-size: 1.05em;'>${m.movement_type}</strong>
                      <span style='font-weight: 700; font-size: 1.1em; color: ${tipoClass === 'success' ? '#059669' : '#dc2626'};'>${m.amount.toFixed(2)}</span>
                    </div>
                    <div style='font-size: 0.9em; color: #6b7280;'>
                      <span><i class="fas fa-tag" style="margin-right: 5px;"></i>${conceptName}</span>
                      ${m.details ? ` • ${m.details}` : ''}
                    </div>
                    <div style='font-size: 0.85em; color: #9ca3af; margin-top: 3px;'>
                      <i class="fas fa-clock" style="margin-right: 5px;"></i>${new Date(m.movement_date).toLocaleString('es-AR')}
                      ${m.creator ? ` • <i class="fas fa-user" style="margin-left: 8px; margin-right: 5px;"></i>${m.creator.full_name}` : ''}
                    </div>
                  </div>
                </div>
              `
            }).join("")
          } else {
            movList.innerHTML = `
              <div style="text-align:center; padding: 60px 20px;">
                <i class="fas fa-inbox" style="font-size: 3em; color: #d1d5db; margin-bottom: 15px;"></i>
                <p style="color: #6b7280; font-size: 1.1em; margin: 0;">No hay movimientos en la caja global</p>
              </div>
            `
          }
        })
        .catch((error) => {
          console.error('[ERROR] Error al cargar movimientos globales:', error)
          movList.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
              <i class="fas fa-exclamation-triangle" style="font-size: 3em; color: #f59e0b; margin-bottom: 15px;"></i>
              <p style="color: #92400e; font-size: 1.1em; margin: 0;">No hay caja global abierta</p>
              <p style="color: #78350f; font-size: 0.9em; margin-top: 10px;">Abre la caja global primero para ver los movimientos</p>
            </div>
          `
        })
    } else {
      // Vista personal - cargar del arco actual
      if (!arcoIDActual) {
        movList.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-exclamation-circle" style="font-size: 2em; color: #f59e0b;"></i><p style="margin-top: 10px; color: #92400e;">No hay arqueo abierto</p></div>'
        return
      }
      
      fetch(`/api/movimientos/arco/${arcoIDActual}`, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.movements) && data.movements.length > 0) {
            movList.innerHTML = `
              <div style="margin-bottom: 15px; padding: 12px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-left: 4px solid #3b82f6; border-radius: 8px;">
                <p style="margin: 0; color: #1e40af; font-weight: 600;"><i class="fas fa-home" style="margin-right: 8px;"></i>Vista de Mi Caja Personal</p>
                <p style="margin: 5px 0 0 0; color: #1e3a8a; font-size: 0.9em;">Mostrando tus movimientos personales</p>
              </div>
            ` + data.movements.map((m) => {
              const tipoClass = m.movement_type === 'Ingreso' ? 'success' : 'danger'
              const tipoIcon = m.movement_type === 'Ingreso' ? 'arrow-up' : 'arrow-down'
              const conceptName = m.concept ? m.concept.concept_name : `Concepto ${m.concept_id}`
              return `
                <div class='movimiento-item' style='border-bottom:1px solid #e5e7eb; padding:15px 0; display: flex; align-items: center; gap: 15px;'>
                  <div style='width: 40px; height: 40px; border-radius: 50%; background: ${tipoClass === 'success' ? '#d1fae5' : '#fee2e2'}; display: flex; align-items: center; justify-content: center;'>
                    <i class="fas fa-${tipoIcon}" style="color: ${tipoClass === 'success' ? '#059669' : '#dc2626'};"></i>
                  </div>
                  <div style='flex: 1;'>
                    <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;'>
                      <strong style='color: #1f2937; font-size: 1.05em;'>${m.movement_type}</strong>
                      <span style='font-weight: 700; font-size: 1.1em; color: ${tipoClass === 'success' ? '#059669' : '#dc2626'};'>${m.amount.toFixed(2)}</span>
                    </div>
                    <div style='font-size: 0.9em; color: #6b7280;'>
                      <span><i class="fas fa-tag" style="margin-right: 5px;"></i>${conceptName}</span>
                      ${m.details ? ` • ${m.details}` : ''}
                    </div>
                    <div style='font-size: 0.85em; color: #9ca3af; margin-top: 3px;'>
                      <i class="fas fa-clock" style="margin-right: 5px;"></i>${new Date(m.movement_date).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              `
            }).join("")
          } else {
            movList.innerHTML = `
              <div style="text-align:center; padding: 60px 20px;">
                <i class="fas fa-inbox" style="font-size: 3em; color: #d1d5db; margin-bottom: 15px;"></i>
                <p style="color: #6b7280; font-size: 1.1em; margin: 0;">No hay movimientos en este arco</p>
              </div>
            `
          }
        })
        .catch(() => {
          movList.innerHTML = `
            <div style="text-align:center; padding: 40px;">
              <i class="fas fa-exclamation-triangle" style="font-size: 2em; color: #ef4444;"></i>
              <p style="margin-top: 10px; color: #dc2626;">Error al cargar movimientos</p>
            </div>
          `
        })
    }
  }
  
  saldoDetailBtn.addEventListener("click", () => {
    const modalMov = document.getElementById("modal-movimientos")
    const tabsContainer = document.getElementById("modal-tabs-container")
    
    // Si es Admin General, mostrar tabs
    if (isAdminGeneral && tabsContainer) {
      tabsContainer.style.display = 'block'
      
      // Configurar event listeners para los tabs si no están ya configurados
      const tabPersonal = document.getElementById('tab-personal')
      const tabGlobal = document.getElementById('tab-global')
      
      if (tabPersonal && !tabPersonal.hasAttribute('data-listener')) {
        tabPersonal.setAttribute('data-listener', 'true')
        tabPersonal.addEventListener('click', () => {
          vistaModalActual = 'personal'
          // Actualizar estilos de tabs
          tabPersonal.style.background = 'white'
          tabPersonal.style.fontWeight = '600'
          tabPersonal.style.color = '#3b82f6'
          tabPersonal.style.borderBottomColor = '#3b82f6'
          tabGlobal.style.background = 'transparent'
          tabGlobal.style.fontWeight = '500'
          tabGlobal.style.color = '#6b7280'
          tabGlobal.style.borderBottomColor = 'transparent'
          // Cargar movimientos
          cargarMovimientosModal('personal')
        })
      }
      
      if (tabGlobal && !tabGlobal.hasAttribute('data-listener')) {
        tabGlobal.setAttribute('data-listener', 'true')
        tabGlobal.addEventListener('click', () => {
          vistaModalActual = 'global'
          // Actualizar estilos de tabs
          tabGlobal.style.background = 'white'
          tabGlobal.style.fontWeight = '600'
          tabGlobal.style.color = '#3b82f6'
          tabGlobal.style.borderBottomColor = '#3b82f6'
          tabPersonal.style.background = 'transparent'
          tabPersonal.style.fontWeight = '500'
          tabPersonal.style.color = '#6b7280'
          tabPersonal.style.borderBottomColor = 'transparent'
          // Cargar movimientos
          cargarMovimientosModal('global')
        })
      }
      
      // Resetear al tab personal
      vistaModalActual = 'personal'
      if (tabPersonal) {
        tabPersonal.style.background = 'white'
        tabPersonal.style.fontWeight = '600'
        tabPersonal.style.color = '#3b82f6'
        tabPersonal.style.borderBottomColor = '#3b82f6'
      }
      if (tabGlobal) {
        tabGlobal.style.background = 'transparent'
        tabGlobal.style.fontWeight = '500'
        tabGlobal.style.color = '#6b7280'
        tabGlobal.style.borderBottomColor = 'transparent'
      }
    } else if (tabsContainer) {
      tabsContainer.style.display = 'none'
    }
    
    modalMov.style.display = "block"
    document.body.style.overflow = "hidden"
    
    // Cargar movimientos según la vista actual
    cargarMovimientosModal(vistaModalActual)
  })

  document.getElementById("modal-movimientos-cerrar").addEventListener("click", () => {
    document.getElementById("modal-movimientos").style.display = "none"
    document.body.style.overflow = ""
  })

  ;[btnIngresos, btnEgresos].forEach((btn) => {
    btn.addEventListener("mouseenter", () => btn.style.transform = "translateY(-2px) scale(1.02)")
    btn.addEventListener("mouseleave", () => btn.style.transform = "translateY(0) scale(1)")
  })

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) hideModal()
  })

  const logoutBtn = document.getElementById("logout-btn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (!confirm("¿Estás seguro de que deseas cerrar sesión?")) return
      try {
        const response = await fetch("/logout", { method: "POST", credentials: "include" })
        const data = await response.json()
        if (data.success) {
          showNotification(data.message || "Sesión cerrada exitosamente", "success")
          setTimeout(() => window.location.href = data.redirect_to || "/", 500)
        } else {
          showNotification("Error al cerrar sesión", "error")
        }
      } catch (error) {
        console.error("Error al cerrar sesión:", error)
        showNotification("Error de conexión al cerrar sesión", "error")
      }
    })
  }
})
