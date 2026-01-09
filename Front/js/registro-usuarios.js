let usuarios = []
let roles = []

// Inicializar al cargar el documento
document.addEventListener("DOMContentLoaded", () => {
  cargarUsuarios()
  cargarRoles()
})

// Cargar usuarios desde la API
async function cargarUsuarios() {
  try {
    const res = await fetch("/api/admin/usuarios", { credentials: "include" })
    if (!res.ok) throw new Error("Error al cargar usuarios")
    usuarios = await res.json()
    renderUsuarios()
  } catch (error) {
    console.error("Error:", error)
    alert("Error al cargar usuarios")
  }
}

// Cargar roles desde la API
async function cargarRoles() {
  try {
    const res = await fetch("/api/admin/roles", { credentials: "include" })
    if (!res.ok) throw new Error("Error al cargar roles")
    roles = await res.json()
  } catch (error) {
    console.error("Error:", error)
  }
}

// Renderizar tabla de usuarios
function renderUsuarios() {
  const tbody = document.getElementById("usuariosTableBody")

  if (usuarios.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center;">
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No hay usuarios registrados</p>
          </div>
        </td>
      </tr>`
    return
  }

  tbody.innerHTML = usuarios
    .map(
      (u) => `
        <tr>
            <td>${u.user_id}</td>
            <td><strong>${u.email}</strong></td>
            <td>${u.full_name}</td>
            <td><span class="badge badge-primary">${u.role.role_name}</span></td>
            <td>
                <span class="badge ${u.is_active ? "badge-success" : "badge-danger"}">
                    ${u.is_active ? "Activo" : "Inactivo"}
                </span>
            </td>
            <td>
                <button class="btn btn-secondary" onclick="editarUsuario(${u.user_id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-warning" onclick="resetPassword(${u.user_id})" title="Resetear Contraseña">
                    <i class="fas fa-key"></i>
                </button>
                <button class="btn btn-danger" onclick="eliminarUsuario(${u.user_id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `,
    )
    .join("")
}

// Abrir modal para nuevo usuario
document.getElementById("btnNuevoUsuario").addEventListener("click", () => {
  document.getElementById("modalTitle").textContent = "Nuevo Usuario"
  document.getElementById("usuarioForm").reset()
  document.getElementById("usuarioId").value = ""
  document.getElementById("userEmail").disabled = false
  document.getElementById("passwordGroup").style.display = "block"

  const roleSelect = document.getElementById("userRole")
  roleSelect.innerHTML = roles
    .map((r) => `<option value="${r.role_id}">${r.role_name}</option>`)
    .join("")

  document.getElementById("userActive").checked = true
  document.getElementById("usuarioModal").style.display = "flex"
})

// Editar usuario - Abrir modal
function editarUsuario(id) {
  const usuario = usuarios.find((u) => u.user_id === id)
  if (!usuario) return

  document.getElementById("modalTitle").textContent = "Editar Usuario"
  document.getElementById("usuarioId").value = usuario.user_id
  document.getElementById("userEmail").value = usuario.email
  document.getElementById("userEmail").disabled = true
  document.getElementById("userFullName").value = usuario.full_name
  document.getElementById("userActive").checked = usuario.is_active
  document.getElementById("passwordGroup").style.display = "none"

  const roleSelect = document.getElementById("userRole")
  roleSelect.innerHTML = roles
    .map(
      (r) =>
        `<option value="${r.role_id}" ${r.role_id === usuario.role_id ? "selected" : ""}>${r.role_name}</option>`,
    )
    .join("")

  document.getElementById("usuarioModal").style.display = "flex"
}

// Guardar cambios del usuario (crear o actualizar)
document.getElementById("btnGuardarUsuario").addEventListener("click", async () => {
  const id = document.getElementById("usuarioId").value
  const isNew = !id

  let data = {
    full_name: document.getElementById("userFullName").value,
    role_id: Number.parseInt(document.getElementById("userRole").value),
    is_active: document.getElementById("userActive").checked,
  }

  if (isNew) {
    data.email = document.getElementById("userEmail").value
    data.password = document.getElementById("userPassword").value

    if (!data.email || !data.password) {
      alert("Email y contraseña son requeridos")
      return
    }

    if (data.password.length < 8) {
      alert("La contraseña debe tener al menos 8 caracteres")
      return
    }
  }

  try {
    const url = isNew ? "/api/admin/usuarios" : `/api/admin/usuarios/${id}`
    const method = isNew ? "POST" : "PUT"

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

    alert(isNew ? "Usuario creado" : "Usuario actualizado")
    cerrarModal()
    cargarUsuarios()
  } catch (error) {
    console.error("Error:", error)
    alert(error.message)
  }
})

// Eliminar usuario
async function eliminarUsuario(id) {
  if (!confirm("¿Estás seguro de eliminar este usuario?")) return

  try {
    const res = await fetch(`/api/admin/usuarios/${id}`, {
      method: "DELETE",
      credentials: "include",
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || "Error al eliminar")
    }

    alert("Usuario eliminado")
    cargarUsuarios()
  } catch (error) {
    console.error("Error:", error)
    alert(error.message)
  }
}

// Resetear contraseña - Abrir modal
function resetPassword(id) {
  document.getElementById("passwordUserId").value = id
  document.getElementById("newPassword").value = ""
  document.getElementById("showPasswordText").textContent = ""
  document.getElementById("passwordModal").style.display = "flex"
}

// Generar contraseña aleatoria
function generarPasswordAleatoria() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%"
  let password = ""
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

document.getElementById("btnGenerarPassword").addEventListener("click", () => {
  const newPassword = generarPasswordAleatoria()
  document.getElementById("newPassword").value = newPassword
  document.getElementById("showPasswordText").textContent = `Contraseña generada: ${newPassword}`
})

// Confirmar reseteo de contraseña
document.getElementById("btnResetPassword").addEventListener("click", async () => {
  const id = document.getElementById("passwordUserId").value
  const password = document.getElementById("newPassword").value

  if (password.length < 8) {
    alert("La contraseña debe tener al menos 8 caracteres")
    return
  }

  try {
    const res = await fetch(`/api/admin/usuarios/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ new_password: password }),
    })

    if (!res.ok) throw new Error("Error al resetear contraseña")

    alert(`Contraseña actualizada exitosamente. Nueva contraseña: ${password}`)
    cerrarPasswordModal()
  } catch (error) {
    console.error("Error:", error)
    alert("Error al resetear contraseña")
  }
})

// Cerrar modal de usuario
function cerrarModal() {
  document.getElementById("usuarioModal").style.display = "none"
}

// Cerrar modal de contraseña
function cerrarPasswordModal() {
  document.getElementById("passwordModal").style.display = "none"
}

// Cerrar modales al hacer clic fuera
document.getElementById("usuarioModal").addEventListener("click", (e) => {
  if (e.target.id === "usuarioModal") cerrarModal()
})

document.getElementById("passwordModal").addEventListener("click", (e) => {
  if (e.target.id === "passwordModal") cerrarPasswordModal()
})