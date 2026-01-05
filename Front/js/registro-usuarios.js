// ============================================
// GESTIÓN DE USUARIOS - JAVASCRIPT
// ============================================

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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay usuarios</td></tr>'
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
            </td>
        </tr>
    `,
    )
    .join("")
}

// Editar usuario - Abrir modal
function editarUsuario(id) {
  const usuario = usuarios.find((u) => u.user_id === id)
  if (!usuario) return

  document.getElementById("usuarioId").value = usuario.user_id
  document.getElementById("userEmail").value = usuario.email
  document.getElementById("userFullName").value = usuario.full_name
  document.getElementById("userActive").checked = usuario.is_active

  const roleSelect = document.getElementById("userRole")
  roleSelect.innerHTML = roles
    .map(
      (r) => `<option value="${r.role_id}" ${r.role_id === usuario.role_id ? "selected" : ""}>${r.role_name}</option>`,
    )
    .join("")

  document.getElementById("usuarioModal").style.display = "flex"
}

// Guardar cambios del usuario
document.getElementById("btnGuardarUsuario").addEventListener("click", async () => {
  const id = document.getElementById("usuarioId").value
  const data = {
    full_name: document.getElementById("userFullName").value,
    role_id: Number.parseInt(document.getElementById("userRole").value),
    is_active: document.getElementById("userActive").checked,
  }

  try {
    const res = await fetch(`/api/admin/usuarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    })

    if (!res.ok) throw new Error("Error al actualizar")

    alert("Usuario actualizado")
    cerrarModal()
    cargarUsuarios()
  } catch (error) {
    console.error("Error:", error)
    alert("Error al actualizar usuario")
  }
})

// Resetear contraseña - Abrir modal
function resetPassword(id) {
  document.getElementById("passwordUserId").value = id
  document.getElementById("newPassword").value = ""
  document.getElementById("passwordModal").style.display = "flex"
}

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

    alert("Contraseña actualizada")
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
