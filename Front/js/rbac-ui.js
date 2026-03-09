/**
 * ============================================
 * SISTEMA DE CONTROL DE PERMISOS - FRONTEND
 * ============================================
 * 
 * Este script gestiona la visibilidad de elementos HTML
 * basándose en los permisos del usuario autenticado.
 * 
 * Uso:
 * 1. Incluir este script en todas las páginas: <script src="/js/rbac-ui.js"></script>
 * 2. Agregar atributo data-permission a elementos que requieren permisos
 * 3. El sistema ocultará automáticamente elementos sin permiso
 */

// ============================================
// CONFIGURACIÓN DE PERMISOS
// ============================================

const PERMISSIONS = {
    // Permisos de movimientos
    CREATE_MOVEMENT: 'movement:create',
    READ_MOVEMENT: 'movement:read',
    READ_OWN_MOVEMENT: 'movement:read:own',
    READ_ALL_MOVEMENT: 'movement:read:all',
    UPDATE_MOVEMENT: 'movement:update',
    DELETE_MOVEMENT: 'movement:delete',

    // Permisos de arco (caja)
    OPEN_ARCO: 'arco:open',
    CLOSE_ARCO: 'arco:close',
    READ_ARCO: 'arco:read',
    OPEN_OWN_ARCO: 'arco:open:own',
    OPEN_GLOBAL_ARCO: 'arco:open:global',
    VIEW_GLOBAL_CAJA: 'arco:view:global',

    // Permisos administrativos
    MANAGE_USERS: 'admin:users',
    MANAGE_ROLES: 'admin:roles',
    MANAGE_CONCEPTS: 'admin:concepts',
    VIEW_REPORTS: 'admin:reports',
    VIEW_OWN_REPORTS: 'admin:reports:own',
    VIEW_ALL_REPORTS: 'admin:reports:all',
    MANAGE_BACKUPS: 'admin:backups',
    MANAGE_SECRETS: 'admin:secrets',

    // Permisos de sistema
    VIEW_LOGS: 'system:logs',
    VIEW_METRICS: 'system:metrics'
};

// ============================================
// ESTADO GLOBAL
// ============================================

let currentUser = null;
let userPermissions = [];
let userRole = '';

// ============================================
// INICIALIZACIÓN
// ============================================

/**
 * Inicializa el sistema RBAC del frontend
 */
async function initRBAC() {
    try {
        // Obtener información del usuario y permisos
        const response = await fetch('/api/me', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.warn('[RBAC] Usuario no autenticado');
            return;
        }

        const data = await response.json();
        currentUser = data.user;
        userPermissions = data.permissions || [];
        userRole = data.role || '';

        console.log('[RBAC] Usuario autenticado:', {
            user: currentUser.full_name,
            role: userRole,
            permissions: userPermissions.length
        });

        // Aplicar control de visibilidad
        applyPermissionBasedVisibility();
        
        // Agregar información del usuario al DOM si existe un contenedor
        displayUserInfo();

    } catch (error) {
        console.error('[RBAC] Error inicializando sistema de permisos:', error);
    }
}

// ============================================
// VERIFICACIÓN DE PERMISOS
// ============================================

/**
 * Verifica si el usuario tiene un permiso específico
 * @param {string} permission - Permiso a verificar
 * @returns {boolean}
 */
function hasPermission(permission) {
    return userPermissions.includes(permission);
}

/**
 * Verifica si el usuario tiene al menos uno de los permisos especificados
 * @param {string[]} permissions - Array de permisos
 * @returns {boolean}
 */
function hasAnyPermission(permissions) {
    return permissions.some(perm => userPermissions.includes(perm));
}

/**
 * Verifica si el usuario tiene todos los permisos especificados
 * @param {string[]} permissions - Array de permisos
 * @returns {boolean}
 */
function hasAllPermissions(permissions) {
    return permissions.every(perm => userPermissions.includes(perm));
}

/**
 * Verifica si el usuario tiene un rol específico
 * @param {string} role - Nombre del rol
 * @returns {boolean}
 */
function hasRole(role) {
    return userRole === role;
}

/**
 * Verifica si el usuario es Administrador General
 * @returns {boolean}
 */
function isAdmin() {
    return userRole === 'Administrador General';
}

/**
 * Verifica si el usuario es Supervisor
 * @returns {boolean}
 */
function isSupervisor() {
    return userRole === 'Supervisor';
}

/**
 * Verifica si el usuario es Usuario regular
 * @returns {boolean}
 */
function isUser() {
    return userRole === 'Usuario';
}

// ============================================
// CONTROL DE VISIBILIDAD
// ============================================

/**
 * Aplica control de visibilidad basado en permisos
 */
function applyPermissionBasedVisibility() {
    // Buscar todos los elementos con atributo data-permission
    const elements = document.querySelectorAll('[data-permission]');
    
    elements.forEach(element => {
        const requiredPermission = element.getAttribute('data-permission');
        const requireAll = element.getAttribute('data-require-all') === 'true';
        
        // Verificar si son múltiples permisos (separados por coma)
        const permissions = requiredPermission.split(',').map(p => p.trim());
        
        let hasAccess = false;
        if (permissions.length === 1) {
            hasAccess = hasPermission(permissions[0]);
        } else {
            hasAccess = requireAll 
                ? hasAllPermissions(permissions) 
                : hasAnyPermission(permissions);
        }
        
        if (!hasAccess) {
            // Ocultar elemento
            element.style.display = 'none';
            element.setAttribute('aria-hidden', 'true');
            
            // Si es un link o botón, deshabilitarlo también
            if (element.tagName === 'A' || element.tagName === 'BUTTON') {
                element.setAttribute('disabled', 'true');
                element.style.pointerEvents = 'none';
            }
            
            console.log('[RBAC] Ocultando elemento - Permiso requerido:', requiredPermission);
        }
    });

    // Buscar elementos con atributo data-role
    const roleElements = document.querySelectorAll('[data-role]');
    
    roleElements.forEach(element => {
        const requiredRole = element.getAttribute('data-role');
        const roles = requiredRole.split(',').map(r => r.trim());
        
        const hasAccess = roles.includes(userRole);
        
        if (!hasAccess) {
            element.style.display = 'none';
            element.setAttribute('aria-hidden', 'true');
            
            if (element.tagName === 'A' || element.tagName === 'BUTTON') {
                element.setAttribute('disabled', 'true');
                element.style.pointerEvents = 'none';
            }
            
            console.log('[RBAC] Ocultando elemento - Rol requerido:', requiredRole);
        }
    });

    // Buscar elementos que deben ocultarse para roles específicos
    const hideForRoleElements = document.querySelectorAll('[data-hide-for-role]');
    
    hideForRoleElements.forEach(element => {
        const hideForRole = element.getAttribute('data-hide-for-role');
        const roles = hideForRole.split(',').map(r => r.trim());
        
        if (roles.includes(userRole)) {
            element.style.display = 'none';
            element.setAttribute('aria-hidden', 'true');
        }
    });
}

/**
 * Muestra información del usuario en el header si existe el contenedor
 */
function displayUserInfo() {
    const userInfoContainer = document.getElementById('user-info-display');
    if (userInfoContainer && currentUser) {
        userInfoContainer.innerHTML = `
            <div class="user-info">
                <div class="user-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="user-details">
                    <span class="user-name">${currentUser.full_name}</span>
                    <span class="user-role">${userRole}</span>
                </div>
            </div>
        `;
    }
}

// ============================================
// UTILIDADES PARA DESARROLLO
// ============================================

/**
 * Muestra en consola los permisos del usuario actual
 */
function debugPermissions() {
    console.log('========================================');
    console.log('INFORMACIÓN DE PERMISOS DEL USUARIO');
    console.log('========================================');
    console.log('Usuario:', currentUser?.full_name);
    console.log('Email:', currentUser?.email);
    console.log('Rol:', userRole);
    console.log('Permisos:', userPermissions);
    console.log('========================================');
}

// Exponer funciones globalmente para uso en otros scripts
window.RBAC = {
    // Estado
    getCurrentUser: () => currentUser,
    getUserPermissions: () => userPermissions,
    getUserRole: () => userRole,
    
    // Verificación
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isAdmin,
    isSupervisor,
    isUser,
    
    // Utilidades
    debugPermissions,
    
    // Constantes
    PERMISSIONS
};

// ============================================
// AUTO-INICIALIZACIÓN
// ============================================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRBAC);
} else {
    initRBAC();
}

console.log('[RBAC] Sistema de control de permisos cargado');
