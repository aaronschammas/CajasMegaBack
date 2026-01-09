// ============================================
// GESTIÓN DE CONCEPTOS - JAVASCRIPT
// ============================================

let conceptos = []

// Cargar datos al iniciar
document.addEventListener("DOMContentLoaded", () => {
  cargarConceptos()
})

// Cargar conceptos desde la API
async function cargarConceptos() {
  try {
    const res = await fetch("/api/admin/conceptos", {
      credentials: "include",
    })
    if (!res.ok) throw new Error("Error al cargar conceptos")

    conceptos = await res.json()
    renderConceptos()
  } catch (error) {
    console.error("Error:", error)
    alert("Error al cargar los conceptos")
  }
}

// Renderizar tabla de conceptos
function renderConceptos() {
  const tbody = document.getElementById("conceptosTableBody")

  if (conceptos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center;">
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No hay conceptos registrados</p>
          </div>
        </td>
      </tr>`
    return
  }

  tbody.innerHTML = conceptos
    .map((c) => {
      return `
        <tr>
          <td>${c.concept_id}</td>
          <td><strong><i class="fas fa-tag"></i> ${c.concept_name}</strong></td>
          <td>
            <span class="badge ${getBadgeClass(c.movement_type_association)}">
              ${getTipoLabel(c.movement_type_association)}
            </span>
          </td>
          <td>
            <span class="badge ${c.is_active ? "badge-success" : "badge-danger"}">
              ${c.is_active ? "Activo" : "Inactivo"}
            </span>
          </td>
          <td>${c.creator ? c.creator.full_name : "Sistema"}</td>
          <td>
            <button class="btn btn-secondary" onclick="editarConcepto(${c.concept_id})" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-danger" onclick="eliminarConcepto(${c.concept_id})" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `
    })
    .join("")
}

// Obtener clase de badge según tipo
function getBadgeClass(type) {
  const classes = {
    Ingreso: "badge-success",
    Egreso: "badge-danger",
    RetiroCaja: "badge-warning",
    Ambos: "badge-primary",
  }
  return classes[type] || "badge-primary"
}

// Obtener etiqueta amigable del tipo
function getTipoLabel(type) {
  const labels = {
    Ingreso: "Ingreso",
    Egreso: "Egreso",
    RetiroCaja: "Retiro de Caja",
    Ambos: "Ingreso/Egreso",
  }
  return labels[type] || type
}

// Abrir modal para nuevo concepto
document.getElementById("btnNuevoConcepto").addEventListener("click", () => {
  document.getElementById("modalTitle").textContent = "Nuevo Concepto"
  document.getElementById("conceptoForm").reset()
  document.getElementById("conceptoId").value = ""
  document.getElementById("editOnlyFields").style.display = "none"
  document.getElementById("conceptoModal").style.display = "flex"
})

// Editar concepto
function editarConcepto(id) {
  const concepto = conceptos.find((c) => c.concept_id === id)
  if (!concepto) return

  document.getElementById("modalTitle").textContent = "Editar Concepto"
  document.getElementById("conceptoId").value = concepto.concept_id
  document.getElementById("conceptName").value = concepto.concept_name
  document.getElementById("movementType").value = concepto.movement_type_association
  document.getElementById("isActive").checked = concepto.is_active
  document.getElementById("editOnlyFields").style.display = "block"
  document.getElementById("conceptoModal").style.display = "flex"
}

// Guardar concepto (crear o actualizar)
document.getElementById("btnGuardarConcepto").addEventListener("click", async () => {
  const id = document.getElementById("conceptoId").value
  const data = {
    concept_name: document.getElementById("conceptName").value.trim(),
    movement_type_association: document.getElementById("movementType").value,
  }

  // Validaciones
  if (!data.concept_name) {
    alert("El nombre del concepto es requerido")
    return
  }

  if (!data.movement_type_association) {
    alert("Debe seleccionar un tipo de movimiento")
    return
  }

  // Si es edición, incluir is_active
  if (id) {
    data.is_active = document.getElementById("isActive").checked
  }

  try {
    const url = id ? `/api/admin/conceptos/${id}` : "/api/admin/conceptos"
    const method = id ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || "Error al guardar")
    }

    alert(id ? "Concepto actualizado correctamente" : "Concepto creado correctamente")
    cerrarModal()
    cargarConceptos()
  } catch (error) {
    console.error("Error:", error)
    alert(error.message)
  }
})

// Eliminar concepto
async function eliminarConcepto(id) {
  const concepto = conceptos.find((c) => c.concept_id === id)
  if (!concepto) return

  if (
    !confirm(
      `¿Estás seguro de eliminar el concepto "${concepto.concept_name}"?\n\nEsta acción no se puede deshacer.`
    )
  ) {
    return
  }

  try {
    const res = await fetch(`/api/admin/conceptos/${id}`, {
      method: "DELETE",
      credentials: "include",
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || "Error al eliminar")
    }

    alert("Concepto eliminado correctamente")
    cargarConceptos()
  } catch (error) {
    console.error("Error:", error)
    alert(error.message)
  }
}

// Cerrar modal
function cerrarModal() {
  document.getElementById("conceptoModal").style.display = "none"
}

// Cerrar modal al hacer clic fuera
document.getElementById("conceptoModal").addEventListener("click", (e) => {
  if (e.target.id === "conceptoModal") {
    cerrarModal()
  }
})

// Manejar tecla Escape para cerrar modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrarModal()
  }
})