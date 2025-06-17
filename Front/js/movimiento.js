// Lógica de logout y protección de acceso para movimiento.html

document.addEventListener('DOMContentLoaded', function() {
  // Proteger acceso: si no hay token, redirigir a login
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/api/login';
    return;
  }

  // Opción de logout (puedes agregar un botón en el HTML y darle id="logoutBtn")
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/api/login';
    });
  }
});
