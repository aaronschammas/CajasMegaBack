// ============================================
// GESTIÓN DE ROLES - JAVASCRIPT
// ============================================

let roles = []
let usuarios = []

// Cargar datos al iniciar
document.addEventListener("DOMContentLoaded", () => {
  cargarRoles()
  cargarUsuarios()
})

// Cargar roles desde la API
async function cargarRoles() {
  try {
    const res = await fetch("/api/admin/roles", {
      credentials: "include",
    })
    if (!res.ok) throw new Error("Error al cargar roles")

    roles = await res.json()
    renderRoles()
  } catch (error) {
    console.error("Error:", error)
    alert("Error al cargar los roles")
  }
}

// Cargar usuarios para contar cuántos tienen cada rol
async function cargarUsuarios() {
  try {
    const res = await fetch("/api/admin/usuarios", {
      credentials: "include",
    })
    if (!res.ok) throw new Error("Error al cargar usuarios")

    usuarios = await res.json()
    renderRoles()
  } catch (error) {
    console.error("Error:", error)
  }
}

// Renderizar tabla de roles
function renderRoles() {
  const tbody = document.getElementById("rolesTableBody")

  if (roles.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center;">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No hay roles registrados</p>
                    </div>
                </td>
            </tr>`
    return
  }

  tbody.innerHTML = roles
    .map((r) => {
      const userCount = usuarios.filter((u) => u.role_id === r.role_id).length
      return `
            <tr>
                <td>${r.role_id}</td>
                <td>
                    <strong><i class="fas fa-shield-alt"></i> ${r.role_name}</strong>
                </td>
                <td>
                    <span class="badge badge-primary">
                        ${userCount} usuario${userCount !== 1 ? "s" : ""}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary" onclick="editarRol(${r.role_id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger" onclick="eliminarRol(${r.role_id}, ${userCount})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
    })
    .join("")
}

// Abrir modal para nuevo rol
document.getElementById("btnNuevoRol").addEventListener("click", () => {
  document.getElementById("modalTitle").textContent = "Nuevo Rol"
  document.getElementById("rolForm").reset()
  document.getElementById("rolId").value = ""
  document.getElementById("rolModal").style.display = "flex"
})

// Editar rol
function editarRol(id) {
  const rol = roles.find((r) => r.role_id === id)
  if (!rol) return

  document.getElementById("modalTitle").textContent = "Editar Rol"
  document.getElementById("rolId").value = rol.role_id
  document.getElementById("roleName").value = rol.role_name
  document.getElementById("rolModal").style.display = "flex"
}

// Guardar rol (crear o actualizar)
document.getElementById("btnGuardarRol").addEventListener("click", async () => {
  const id = document.getElementById("rolId").value
  const data = {
    role_name: document.getElementById("roleName").value,
  }

  if (!data.role_name.trim()) {
    alert("El nombre del rol es requerido")
    return
  }

  try {
    const url = id ? `/api/admin/roles/${id}` : "/api/admin/roles"
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

    alert(id ? "Rol actualizado" : "Rol creado")
    cerrarModal()
    cargarRoles()
  } catch (error) {
    console.error("Error:", error)
    alert(error.message)
  }
})

// Eliminar rol
async function eliminarRol(id, userCount) {
  if (userCount > 0) {
    alert("No se puede eliminar este rol porque tiene usuarios asignados")
    return
  }

  if (!confirm("¿Estás seguro de eliminar este rol?")) return

  try {
    const res = await fetch(`/api/admin/roles/${id}`, {
      method: "DELETE",
      credentials: "include",
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || "Error al eliminar")
    }

    alert("Rol eliminado")
    cargarRoles()
  } catch (error) {
    console.error("Error:", error)
    alert(error.message)
  }
}

// Cerrar modal
function cerrarModal() {
  document.getElementById("rolModal").style.display = "none"
}

// Cerrar modal al hacer clic fuera
document.getElementById("rolModal").addEventListener("click", (e) => {
  if (e.target.id === "rolModal") {
    cerrarModal()
  }
})
