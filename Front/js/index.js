document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = loginForm.querySelector('.login-btn');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Limpiar mensaje de error previo
        hideError();
        
        // Deshabilitar botón mientras se procesa
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span>Iniciando sesión...</span><i class="fas fa-spinner fa-spin"></i>';
        
        // Obtener datos del formulario
        const formData = new FormData(loginForm);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Login exitoso - redirigir
                window.location.href = data.redirect_to || '/movimientos';
            } else {
                // Mostrar error
                showError(data.error || 'Error al iniciar sesión');
                
                // Restaurar botón
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<span>Iniciar Sesión</span><i class="fas fa-arrow-right"></i>';
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Error de conexión. Por favor, intenta de nuevo.');
            
            // Restaurar botón
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<span>Iniciar Sesión</span><i class="fas fa-arrow-right"></i>';
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Hacer scroll suave al mensaje de error
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideError() {
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
    }
});
