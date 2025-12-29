document.addEventListener("DOMContentLoaded", () => {
  /* ================================
       VARIABLES GLOBALES
    ================================= */
  let movimientosData = []
  let filteredData = []
  const XLSX = window.XLSX

  /* ================================
       INICIALIZACIÓN
    ================================= */
  function init() {
    extractTableData()
    calcularResumenDesdeTabla()
    initEventListeners()
  }

  /* ================================
       EXTRAER DATOS DE LA TABLA
    ================================= */
  function extractTableData() {
    const filas = document.querySelectorAll(".tabla-movimientos tbody tr")
    movimientosData = []

    filas.forEach((fila) => {
      const movimiento = {
        id: fila.querySelector(".col-id")?.innerText.trim() || "",
        fecha: fila.querySelector(".col-fecha")?.innerText.trim() || "",
        tipo: fila.querySelector(".col-tipo")?.innerText.trim() || "",
        concepto: fila.querySelector(".col-concepto")?.innerText.trim() || "",
        monto: parseMonto(fila.querySelector(".col-monto")?.innerText || "0"),
        usuario: fila.querySelector(".col-usuario")?.innerText.trim() || "",
        detalle: fila.querySelector(".col-detalle")?.innerText.trim() || "",
        element: fila,
      }
      movimientosData.push(movimiento)
    })

    filteredData = [...movimientosData]
  }

  /* ================================
       PARSEAR MONTO
    ================================= */
  function parseMonto(montoTexto) {
    console.log("[v0] Parseando monto:", montoTexto)
    const cleaned = montoTexto.replace("$", "").replace("+", "").replace("-", "").replace(/,/g, "").trim()
    console.log("[v0] Monto limpio:", cleaned)
    const resultado = Number.parseFloat(cleaned) || 0
    console.log("[v0] Resultado parseado:", resultado)
    return resultado
  }

  /* ================================
       CALCULAR RESUMEN FINANCIERO
    ================================= */
  function calcularResumenDesdeTabla() {
    console.log("[v0] ====== INICIANDO CÁLCULO DE RESUMEN ======")
    const filas = document.querySelectorAll(".tabla-movimientos tbody tr")
    console.log("[v0] Número de filas encontradas:", filas.length)

    if (!filas.length) {
      console.log("[v0] No hay filas, mostrando resumen vacío")
      mostrarResumenVacio()
      return
    }

    let ingresos = 0
    let egresos = 0

    filas.forEach((fila, index) => {
      console.log(`[v0] --- Procesando fila ${index + 1} ---`)

      const tipoCelda = fila.querySelector(".col-tipo")
      const montoCelda = fila.querySelector(".col-monto")

      console.log("[v0] Celda tipo elemento:", tipoCelda)
      console.log("[v0] Celda monto elemento:", montoCelda)

      const tipo = tipoCelda?.innerText.trim()
      const montoTexto = montoCelda?.innerText || "0"
      const monto = parseMonto(montoTexto)

      console.log("[v0] Tipo extraído:", tipo)
      console.log("[v0] Monto texto:", montoTexto)
      console.log("[v0] Monto parseado:", monto)

      const tipoUpper = tipo?.toUpperCase() || ""
      console.log("[v0] Tipo en mayúsculas:", tipoUpper)

      if (tipoUpper === "INGRESO") {
        console.log("[v0] ✓ Es un INGRESO, sumando:", monto)
        ingresos += monto
      } else if (tipoUpper === "EGRESO") {
        console.log("[v0] ✓ Es un EGRESO, sumando:", monto)
        egresos += monto
      } else {
        console.log("[v0] ✗ Tipo no reconocido:", tipo)
      }
    })

    const saldo = ingresos - egresos
    const totalMovimientos = filas.length

    console.log("[v0] ====== RESULTADOS FINALES ======")
    console.log("[v0] Total Ingresos:", ingresos)
    console.log("[v0] Total Egresos:", egresos)
    console.log("[v0] Saldo:", saldo)
    console.log("[v0] Total Movimientos:", totalMovimientos)
    console.log("[v0] ====================================")

    mostrarResumen(saldo, ingresos, egresos, totalMovimientos)
  }

  /* ================================
       MOSTRAR RESUMEN
    ================================= */
  function mostrarResumen(saldo, ingresos, egresos, totalMovimientos) {
    const saldoClass = saldo >= 0 ? "text-success" : "text-danger"

    const resumenHTML = `
            <div class="summary-card fade-in">
                <div class="card-icon saldo">
                    <i class="fas fa-balance-scale"></i>
                </div>
                <div class="card-content">
                    <span class="card-label">Saldo Total</span>
                    <span class="card-value ${saldoClass}">$${formatNumber(saldo)}</span>
                </div>
            </div>
            <div class="summary-card fade-in">
                <div class="card-icon ingresos">
                    <i class="fas fa-arrow-down"></i>
                </div>
                <div class="card-content">
                    <span class="card-label">Ingresos</span>
                    <span class="card-value text-success">$${formatNumber(ingresos)}</span>
                </div>
            </div>
            <div class="summary-card fade-in">
                <div class="card-icon egresos">
                    <i class="fas fa-arrow-up"></i>
                </div>
                <div class="card-content">
                    <span class="card-label">Egresos</span>
                    <span class="card-value text-danger">$${formatNumber(egresos)}</span>
                </div>
            </div>
            <div class="summary-card fade-in">
                <div class="card-icon" style="background: linear-gradient(135deg, var(--warning-color) 0%, var(--warning-dark) 100%);">
                    <i class="fas fa-list"></i>
                </div>
                <div class="card-content">
                    <span class="card-label">Movimientos</span>
                    <span class="card-value">${totalMovimientos}</span>
                </div>
            </div>
        `

    document.getElementById("conclusionesContainer").innerHTML = resumenHTML
  }

  /* ================================
       MOSTRAR RESUMEN VACÍO
    ================================= */
  function mostrarResumenVacio() {
    const resumenHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-chart-line"></i>
                <p>No hay datos para mostrar el resumen</p>
            </div>
        `
    document.getElementById("conclusionesContainer").innerHTML = resumenHTML
  }

  /* ================================
       FORMATEAR NÚMEROS
    ================================= */
  function formatNumber(num) {
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  /* ================================
       INICIALIZAR EVENT LISTENERS
    ================================= */
  function initEventListeners() {
    const exportBtn = document.getElementById("exportDropdownBtn")
    const exportMenu = document.getElementById("exportMenu")

    if (exportBtn && exportMenu) {
      exportBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        exportMenu.classList.toggle("show")
      })

      document.addEventListener("click", (e) => {
        if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
          exportMenu.classList.remove("show")
        }
      })
    }

    const searchInput = document.getElementById("searchInput")
    if (searchInput) {
      searchInput.addEventListener("input", debounce(handleSearch, 300))
    }

    const filterType = document.getElementById("filterType")
    if (filterType) {
      filterType.addEventListener("change", handleFilter)
    }

    const showFiltersBtn = document.getElementById("showFiltersBtn")
    const filtersSection = document.getElementById("filtersSection")
    const toggleFilters = document.getElementById("toggleFilters")

    if (showFiltersBtn && filtersSection) {
      showFiltersBtn.addEventListener("click", () => {
        filtersSection.style.display = "block"
        filtersSection.scrollIntoView({ behavior: "smooth" })
      })
    }

    if (toggleFilters && filtersSection) {
      toggleFilters.addEventListener("click", () => {
        filtersSection.style.display = "none"
      })
    }

    const formGraficos = document.getElementById("formGraficos")
    if (formGraficos) {
      formGraficos.addEventListener("submit", handleAdvancedFilter)
      formGraficos.addEventListener("reset", handleResetFilters)
    }

    const exportPDF = document.getElementById("exportPDF")
    if (exportPDF) {
      exportPDF.addEventListener("click", handleExportPDF)
    }

    const exportExcel = document.getElementById("exportExcel")
    if (exportExcel) {
      exportExcel.addEventListener("click", handleExportExcel)
    }
  }

  /* ================================
       BÚSQUEDA EN TIEMPO REAL
    ================================= */
  function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim()
    const filterTypeValue = document.getElementById("filterType")?.value || ""

    filteredData = movimientosData.filter((mov) => {
      const matchesSearch =
        mov.id.toLowerCase().includes(searchTerm) ||
        mov.fecha.toLowerCase().includes(searchTerm) ||
        mov.concepto.toLowerCase().includes(searchTerm) ||
        mov.usuario.toLowerCase().includes(searchTerm) ||
        mov.detalle.toLowerCase().includes(searchTerm) ||
        mov.monto.toString().includes(searchTerm)

      const matchesType = !filterTypeValue || mov.tipo === filterTypeValue

      return matchesSearch && matchesType
    })

    updateTableDisplay()
  }

  /* ================================
       FILTRO POR TIPO
    ================================= */
  function handleFilter() {
    const searchInput = document.getElementById("searchInput")
    if (searchInput && searchInput.value) {
      handleSearch({ target: searchInput })
    } else {
      const filterTypeValue = document.getElementById("filterType")?.value || ""

      filteredData = movimientosData.filter((mov) => {
        return !filterTypeValue || mov.tipo === filterTypeValue
      })

      updateTableDisplay()
    }
  }

  /* ================================
       ACTUALIZAR VISUALIZACIÓN DE TABLA
    ================================= */
  function updateTableDisplay() {
    movimientosData.forEach((mov) => {
      if (filteredData.includes(mov)) {
        mov.element.style.display = ""
      } else {
        mov.element.style.display = "none"
      }
    })

    updateResultCount()
  }

  /* ================================
       ACTUALIZAR CONTADOR DE RESULTADOS
    ================================= */
  function updateResultCount() {
    const visibleCount = filteredData.length
    const totalCount = movimientosData.length
    console.log(`Mostrando ${visibleCount} de ${totalCount} movimientos`)
  }

  /* ================================
       FILTROS AVANZADOS
    ================================= */
  async function handleAdvancedFilter(e) {
    e.preventDefault()

    const desde = document.getElementById("fecha_Desde").value
    const hasta = document.getElementById("fecha_hasta").value
    const tipoFiltro = document.getElementById("tipo").value
    const turno = document.getElementById("turno").value
    const arco_id = document.getElementById("arco_id").value
    const montoMinimo = document.getElementById("monto_Minimo").value
    const montoMaximo = document.getElementById("monto_Maximo").value
    const balanceNegativo = document.getElementById("balance_negativo").checked

    let url = `/api/graficos?fecha_Desde=${desde}&fecha_hasta=${hasta}&tipo=${tipoFiltro}`
    if (turno) url += `&turno=${turno}`
    if (arco_id) url += `&arco_id=${arco_id}`
    if (montoMinimo) url += `&monto_Minimo=${montoMinimo}`
    if (montoMaximo) url += `&monto_Maximo=${montoMaximo}`
    if (balanceNegativo) url += `&balance_negativo=1`

    try {
      showLoading("tablaContainer")

      const res = await fetch(url)

      if (!res.ok) {
        throw new Error("Error al obtener datos del servidor")
      }

      const data = await res.json()

      if (!Array.isArray(data) || data.length === 0) {
        showEmptyState("tablaContainer")
        mostrarResumenVacio()
        return
      }

      renderFilteredTable(data)
    } catch (error) {
      console.error("Error:", error)
      showError("tablaContainer", error.message)
    }
  }

  /* ================================
       RENDERIZAR TABLA FILTRADA
    ================================= */
  function renderFilteredTable(data) {
    if (!data.length) {
      showEmptyState("tablaContainer")
      return
    }

    const cols = Object.keys(data[0])
    let html = '<table class="tabla-movimientos"><thead><tr>'

    for (const col of cols) {
      html += `<th>${col}</th>`
    }
    html += "</tr></thead><tbody>"

    for (const row of data) {
      html += "<tr>"
      for (const col of cols) {
        html += `<td>${row[col] !== null && row[col] !== undefined ? row[col] : ""}</td>`
      }
      html += "</tr>"
    }
    html += "</tbody></table>"

    document.getElementById("tablaContainer").innerHTML = html
    calcularResumenDesdeTabla()
  }

  /* ================================
       RESETEAR FILTROS
    ================================= */
  function handleResetFilters() {
    document.getElementById("tablaContainer").innerHTML = ""

    const searchInput = document.getElementById("searchInput")
    const filterType = document.getElementById("filterType")

    if (searchInput) searchInput.value = ""
    if (filterType) filterType.value = ""

    filteredData = [...movimientosData]
    updateTableDisplay()
    calcularResumenDesdeTabla()
  }

  /* ================================
       EXPORTAR A PDF
    ================================= */
  function handleExportPDF() {
    try {
      const { jsPDF } = window.jspdf
      const doc = new jsPDF()

      doc.setFontSize(18)
      doc.text("Informe de Movimientos", 14, 20)

      doc.setFontSize(11)
      doc.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, 14, 30)

      const yPos = 45
      doc.setFontSize(14)
      doc.text("Resumen Financiero:", 14, yPos)

      const filas = document.querySelectorAll(".tabla-movimientos tbody tr")
      let ingresos = 0,
        egresos = 0

      filas.forEach((fila) => {
        const tipo = fila.querySelector(".col-tipo")?.innerText.trim()
        const monto = parseMonto(fila.querySelector(".col-monto")?.innerText || "0")
        if (tipo === "Ingreso") ingresos += monto
        else if (tipo === "Egreso") egresos += monto
      })

      doc.setFontSize(11)
      doc.text(`Ingresos: $${formatNumber(ingresos)}`, 14, yPos + 10)
      doc.text(`Egresos: $${formatNumber(egresos)}`, 14, yPos + 17)
      doc.text(`Saldo: $${formatNumber(ingresos - egresos)}`, 14, yPos + 24)

      doc.save("informe-movimientos.pdf")

      document.getElementById("exportMenu")?.classList.remove("show")
      showNotification("PDF exportado correctamente", "success")
    } catch (error) {
      console.error("Error al exportar PDF:", error)
      showNotification("Error al exportar PDF", "error")
    }
  }

  /* ================================
       EXPORTAR A EXCEL
    ================================= */
  function handleExportExcel() {
    try {
      const tabla = document.querySelector(".tabla-movimientos")

      if (!tabla) {
        showNotification("No hay datos para exportar", "warning")
        return
      }

      const wb = XLSX.utils.table_to_book(tabla, { sheet: "Movimientos" })
      XLSX.writeFile(wb, "informe-movimientos.xlsx")

      document.getElementById("exportMenu")?.classList.remove("show")
      showNotification("Excel exportado correctamente", "success")
    } catch (error) {
      console.error("Error al exportar Excel:", error)
      showNotification("Error al exportar Excel", "error")
    }
  }

  /* ================================
       UTILIDADES
    ================================= */
  function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  function showLoading(containerId) {
    const container = document.getElementById(containerId)
    if (container) {
      container.innerHTML = '<div class="spinner"></div>'
    }
  }

  function showEmptyState(containerId) {
    const container = document.getElementById(containerId)
    if (container) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No hay datos para mostrar</p>
                </div>
            `
    }
  }

  function showError(containerId, message) {
    const container = document.getElementById(containerId)
    if (container) {
      container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error: ${message}</p>
                </div>
            `
    }
  }

  function showNotification(message, type = "info") {
    console.log(`[${type.toUpperCase()}] ${message}`)
    alert(message)
  }

  init()
})
