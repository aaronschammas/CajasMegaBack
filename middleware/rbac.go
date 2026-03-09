package middleware

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
	"caja-fuerte/utils"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Permission representa un permiso específico
type Permission string

const (
	// Permisos de alquileres
	PermViewAlquileres     Permission = "alquileres:view"
	PermManageAlquileres   Permission = "alquileres:manage"
	PermRegistrarPago      Permission = "alquileres:pago:registrar"
	PermViewAlquilerReport Permission = "alquileres:report"

	// Permisos de movimientos
	PermCreateMovement  Permission = "movement:create"
	PermReadMovement    Permission = "movement:read"
	PermReadOwnMovement Permission = "movement:read:own" // NUEVO: Solo sus movimientos
	PermReadAllMovement Permission = "movement:read:all" // NUEVO: Todos los movimientos
	PermUpdateMovement  Permission = "movement:update"
	PermDeleteMovement  Permission = "movement:delete"

	// Permisos de arco
	PermOpenArco       Permission = "arco:open"
	PermCloseArco      Permission = "arco:close"
	PermReadArco       Permission = "arco:read"
	PermOpenOwnArco    Permission = "arco:open:own"    // NUEVO: Solo su arco
	PermOpenGlobalArco Permission = "arco:open:global" // NUEVO: Arco global
	PermViewGlobalCaja Permission = "arco:view:global" // NUEVO: Ver caja global

	// Permisos administrativos
	PermManageUsers    Permission = "admin:users"
	PermManageRoles    Permission = "admin:roles"
	PermManageConcepts Permission = "admin:concepts"
	PermViewReports    Permission = "admin:reports"
	PermViewOwnReports Permission = "admin:reports:own" // NUEVO: Solo sus reportes
	PermViewAllReports Permission = "admin:reports:all" // NUEVO: Todos los reportes
	PermManageBackups  Permission = "admin:backups"
	PermManageSecrets  Permission = "admin:secrets"

	// Permisos de sistema
	PermViewLogs    Permission = "system:logs"
	PermViewMetrics Permission = "system:metrics"
)

// RolePermissions mapea roles a sus permisos
var rolePermissionsMap = map[string][]Permission{
	"Gestor de Alquileres": {
		PermViewAlquileres,
		PermManageAlquileres, // Puede crear y editar propiedades
		PermRegistrarPago,
	},
	"Usuario": {
		PermCreateMovement,
		PermReadOwnMovement, // SOLO sus movimientos
		PermOpenOwnArco,     // SOLO su arco
		PermCloseArco,
		PermReadArco,
	},
	"Supervisor": {
		PermCreateMovement,
		PermReadOwnMovement,  // SOLO sus movimientos
		PermUpdateMovement,
		PermDeleteMovement,
		PermOpenOwnArco,      // SOLO su arco
		PermCloseArco,
		PermReadArco,
		PermManageConcepts,   // Puede crear conceptos
		PermViewOwnReports,   // SOLO sus reportes
	},
	"Administrador General": {
		// PERMISOS TOTALES - Puede hacer TODO
		PermViewAlquileres,
		PermManageAlquileres,
		PermRegistrarPago,
		PermViewAlquilerReport,
		PermCreateMovement,
		PermReadMovement,
		PermReadOwnMovement,
		PermReadAllMovement,  // Ver TODOS los movimientos
		PermUpdateMovement,
		PermDeleteMovement,
		PermOpenArco,
		PermOpenOwnArco,      // Su arco personal
		PermOpenGlobalArco,   // Arco global
		PermCloseArco,
		PermReadArco,
		PermViewGlobalCaja,   // Ver caja global
		PermManageUsers,      // Crear/editar/eliminar usuarios
		PermManageRoles,      // Crear/editar/eliminar roles
		PermManageConcepts,   // Crear/editar/eliminar conceptos
		PermViewReports,
		PermViewOwnReports,
		PermViewAllReports,   // Ver TODOS los reportes
		PermManageBackups,
		PermManageSecrets,
		PermViewLogs,
		PermViewMetrics,
	},
}

// RBACManager gestiona permisos y roles con cache
type RBACManager struct {
	mu            sync.RWMutex
	roleCache     map[uint]string // userID -> roleName
	lastCacheTime map[uint]int64  // userID -> timestamp
	cacheTTL      int64           // segundos
}

var rbacManager *RBACManager

// InitRBAC inicializa el sistema RBAC
func InitRBAC() {
	rbacManager = &RBACManager{
		roleCache:     make(map[uint]string),
		lastCacheTime: make(map[uint]int64),
		cacheTTL:      300, // 5 minutos
	}

	utils.Logger.Info("🔐 RBAC initialized",
		zap.Int("total_roles", len(rolePermissionsMap)),
	)
}

// RequirePermission middleware que verifica permisos específicos
func RequirePermission(requiredPermissions ...Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		if userID == 0 {
			utils.LogSecurityEventAdvanced("rbac_no_user", "high", map[string]interface{}{
				"path": c.Request.URL.Path,
				"ip":   c.ClientIP(),
			})

			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Usuario no autenticado",
			})
			c.Abort()
			return
		}

		// Obtener rol del usuario (con cache)
		roleName, err := rbacManager.getUserRole(userID)
		if err != nil {
			utils.Logger.Error("Error getting user role",
				zap.Uint("user_id", userID),
				zap.Error(err),
			)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error verificando permisos",
			})
			c.Abort()
			return
		}

		// Verificar permisos
		hasPermission := false
		userPermissions := rolePermissionsMap[roleName]

		for _, required := range requiredPermissions {
			for _, userPerm := range userPermissions {
				if userPerm == required {
					hasPermission = true
					break
				}
			}
			if hasPermission {
				break
			}
		}

		if !hasPermission {
			utils.LogSecurityEventAdvanced("rbac_permission_denied", "medium", map[string]interface{}{
				"user_id":              userID,
				"role":                 roleName,
				"required_permissions": requiredPermissions,
				"path":                 c.Request.URL.Path,
				"ip":                   c.ClientIP(),
			})

			c.JSON(http.StatusForbidden, gin.H{
				"error": "No tienes permisos para realizar esta acción",
			})
			c.Abort()
			return
		}

		// Agregar permisos al contexto para uso posterior
		c.Set("permissions", userPermissions)
		c.Set("role", roleName)

		c.Next()
	}
}

// RequireRole middleware que verifica roles específicos
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		if userID == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Usuario no autenticado",
			})
			c.Abort()
			return
		}

		roleName, err := rbacManager.getUserRole(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error verificando rol",
			})
			c.Abort()
			return
		}

		// Verificar si el rol está permitido
		allowed := false
		for _, allowedRole := range allowedRoles {
			if roleName == allowedRole {
				allowed = true
				break
			}
		}

		if !allowed {
			utils.LogSecurityEventAdvanced("rbac_role_denied", "medium", map[string]interface{}{
				"user_id":       userID,
				"role":          roleName,
				"allowed_roles": allowedRoles,
				"path":          c.Request.URL.Path,
			})

			c.JSON(http.StatusForbidden, gin.H{
				"error": "No tienes el rol necesario para esta acción",
			})
			c.Abort()
			return
		}

		c.Set("role", roleName)
		c.Next()
	}
}

// getUserRole obtiene el rol del usuario con cache
func (m *RBACManager) getUserRole(userID uint) (string, error) {
	m.mu.RLock()
	now := time.Now().Unix()

	// Verificar si está en cache y es válido
	if lastTime, exists := m.lastCacheTime[userID]; exists {
		if now-lastTime < m.cacheTTL {
			if roleName, cached := m.roleCache[userID]; cached {
				m.mu.RUnlock()
				return roleName, nil
			}
		}
	}
	m.mu.RUnlock()

	// Obtener de base de datos
	var user models.User
	if err := database.DB.Preload("Role").First(&user, userID).Error; err != nil {
		return "", err
	}

	roleName := user.Role.RoleName

	// Actualizar cache
	m.mu.Lock()
	m.roleCache[userID] = roleName
	m.lastCacheTime[userID] = now
	m.mu.Unlock()

	return roleName, nil
}

// InvalidateUserCache invalida el cache de un usuario
func (m *RBACManager) InvalidateUserCache(userID uint) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.roleCache, userID)
	delete(m.lastCacheTime, userID)

	utils.Logger.Debug("User role cache invalidated",
		zap.Uint("user_id", userID),
	)
}

// HasPermission verifica si un usuario tiene un permiso específico
func HasPermission(c *gin.Context, permission Permission) bool {
	perms, exists := c.Get("permissions")
	if !exists {
		return false
	}

	userPermissions, ok := perms.([]Permission)
	if !ok {
		return false
	}

	for _, p := range userPermissions {
		if p == permission {
			return true
		}
	}

	return false
}

// GetUserPermissions retorna los permisos de un usuario
func GetUserPermissions(userID uint) ([]Permission, error) {
	roleName, err := rbacManager.getUserRole(userID)
	if err != nil {
		return nil, err
	}

	return rolePermissionsMap[roleName], nil
}

// GetRolePermissions retorna los permisos de un rol
func GetRolePermissions(roleName string) []Permission {
	return rolePermissionsMap[roleName]
}

// RedirectGestorAlquileres es un middleware que redirige al gestor si intenta
// acceder a páginas HTML del dashboard principal. Solo afecta peticiones GET
// que devuelven HTML (no APIs JSON).
func RedirectGestorAlquileres() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("role")
		if role == "Gestor de Alquileres" {
			c.Redirect(http.StatusFound, "/alquileres")
			c.Abort()
			return
		}
		c.Next()
	}
}

// AuditLog registra acciones importantes con contexto de usuario y permisos
func AuditLog(c *gin.Context, action string, resourceType string, resourceID uint, details map[string]interface{}) {
	userID := c.GetUint("user_id")
	email := c.GetString("email")
	role := c.GetString("role")

	auditEntry := map[string]interface{}{
		"user_id":       userID,
		"email":         email,
		"role":          role,
		"action":        action,
		"resource_type": resourceType,
		"resource_id":   resourceID,
		"ip":            c.ClientIP(),
		"user_agent":    c.Request.UserAgent(),
		"details":       details,
		"timestamp":     time.Now(),
	}

	utils.Logger.Info("AUDIT_LOG",
		zap.Any("audit", auditEntry),
	)

}
