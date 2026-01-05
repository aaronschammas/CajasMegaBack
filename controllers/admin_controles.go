package controllers

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type AdminController struct{}

func NewAdminController() *AdminController {
	return &AdminController{}
}

// ================= GESTIÓN DE CONCEPTOS =================

// GET /admin/conceptos - Muestra la página de gestión de conceptos
func (c *AdminController) ConceptosPage(ctx *gin.Context) {
	content, err := os.ReadFile("./Front/admin_conceptos.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la página")
		return
	}
	ctx.Data(http.StatusOK, "text/html; charset=utf-8", content)
}

// GET /api/admin/conceptos - Lista todos los conceptos
func (c *AdminController) GetConceptos(ctx *gin.Context) {
	var conceptos []models.ConceptType
	if err := database.DB.Preload("Creator").Find(&conceptos).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener conceptos"})
		return
	}
	ctx.JSON(http.StatusOK, conceptos)
}

// POST /api/admin/conceptos - Crea un nuevo concepto
func (c *AdminController) CreateConcepto(ctx *gin.Context) {
	var req struct {
		ConceptName             string `json:"concept_name" binding:"required"`
		MovementTypeAssociation string `json:"movement_type_association" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	// Validar que movement_type_association sea válido
	validTypes := []string{"Ingreso", "Egreso", "RetiroCaja", "Ambos"}
	valid := false
	for _, t := range validTypes {
		if req.MovementTypeAssociation == t {
			valid = true
			break
		}
	}
	if !valid {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Tipo de movimiento inválido"})
		return
	}

	userID := ctx.GetUint("user_id")
	concepto := models.ConceptType{
		ConceptName:             req.ConceptName,
		MovementTypeAssociation: req.MovementTypeAssociation,
		IsActive:                true,
		CreatedBy:               &userID,
	}

	if err := database.DB.Create(&concepto).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear concepto"})
		return
	}

	database.DB.Preload("Creator").First(&concepto, concepto.ConceptID)
	ctx.JSON(http.StatusCreated, concepto)
}

// PUT /api/admin/conceptos/:id - Actualiza un concepto
func (c *AdminController) UpdateConcepto(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	var req struct {
		ConceptName             string `json:"concept_name"`
		MovementTypeAssociation string `json:"movement_type_association"`
		IsActive                *bool  `json:"is_active"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	var concepto models.ConceptType
	if err := database.DB.First(&concepto, id).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Concepto no encontrado"})
		return
	}

	// Actualizar campos
	if req.ConceptName != "" {
		concepto.ConceptName = req.ConceptName
	}
	if req.MovementTypeAssociation != "" {
		concepto.MovementTypeAssociation = req.MovementTypeAssociation
	}
	if req.IsActive != nil {
		concepto.IsActive = *req.IsActive
	}

	if err := database.DB.Save(&concepto).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar concepto"})
		return
	}

	database.DB.Preload("Creator").First(&concepto, concepto.ConceptID)
	ctx.JSON(http.StatusOK, concepto)
}

// DELETE /api/admin/conceptos/:id - Elimina un concepto
func (c *AdminController) DeleteConcepto(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	if err := database.DB.Delete(&models.ConceptType{}, id).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar concepto"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Concepto eliminado"})
}

// ================= GESTIÓN DE ROLES =================

// GET /admin/roles - Muestra la página de gestión de roles
func (c *AdminController) RolesPage(ctx *gin.Context) {
	content, err := os.ReadFile("./Front/admin_roles.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la página")
		return
	}
	ctx.Data(http.StatusOK, "text/html; charset=utf-8", content)
}

// GET /api/admin/roles - Lista todos los roles
func (c *AdminController) GetRoles(ctx *gin.Context) {
	var roles []models.Role
	if err := database.DB.Find(&roles).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener roles"})
		return
	}
	ctx.JSON(http.StatusOK, roles)
}

// POST /api/admin/roles - Crea un nuevo rol
func (c *AdminController) CreateRole(ctx *gin.Context) {
	var req struct {
		RoleName string `json:"role_name" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	role := models.Role{
		RoleName: req.RoleName,
	}

	if err := database.DB.Create(&role).Error; err != nil {
		if strings.Contains(err.Error(), "Duplicate") {
			ctx.JSON(http.StatusConflict, gin.H{"error": "El rol ya existe"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear rol"})
		return
	}

	ctx.JSON(http.StatusCreated, role)
}

// PUT /api/admin/roles/:id - Actualiza un rol
func (c *AdminController) UpdateRole(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	var req struct {
		RoleName string `json:"role_name" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	var role models.Role
	if err := database.DB.First(&role, id).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Rol no encontrado"})
		return
	}

	role.RoleName = req.RoleName

	if err := database.DB.Save(&role).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar rol"})
		return
	}

	ctx.JSON(http.StatusOK, role)
}

// DELETE /api/admin/roles/:id - Elimina un rol
func (c *AdminController) DeleteRole(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	// Verificar que no haya usuarios con este rol
	var userCount int64
	database.DB.Model(&models.User{}).Where("role_id = ?", id).Count(&userCount)
	if userCount > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "No se puede eliminar el rol porque hay usuarios asignados"})
		return
	}

	if err := database.DB.Delete(&models.Role{}, id).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar rol"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Rol eliminado"})
}

// ================= GESTIÓN DE USUARIOS =================

// GET /admin/usuarios - Muestra la página de gestión de usuarios
func (c *AdminController) UsuariosPage(ctx *gin.Context) {
	content, err := os.ReadFile("./Front/admin_usuarios.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la página")
		return
	}
	ctx.Data(http.StatusOK, "text/html; charset=utf-8", content)
}

// GET /api/admin/usuarios - Lista todos los usuarios
func (c *AdminController) GetUsuarios(ctx *gin.Context) {
	var usuarios []models.User
	if err := database.DB.Preload("Role").Find(&usuarios).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener usuarios"})
		return
	}

	// Omitir password_hash en la respuesta
	type UserResponse struct {
		UserID   uint        `json:"user_id"`
		Email    string      `json:"email"`
		FullName string      `json:"full_name"`
		RoleID   uint        `json:"role_id"`
		IsActive bool        `json:"is_active"`
		Role     models.Role `json:"role"`
	}

	var response []UserResponse
	for _, u := range usuarios {
		response = append(response, UserResponse{
			UserID:   u.UserID,
			Email:    u.Email,
			FullName: u.FullName,
			RoleID:   u.RoleID,
			IsActive: u.IsActive,
			Role:     u.Role,
		})
	}

	ctx.JSON(http.StatusOK, response)
}

// PUT /api/admin/usuarios/:id - Actualiza un usuario
func (c *AdminController) UpdateUsuario(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	var req struct {
		FullName string `json:"full_name"`
		RoleID   *uint  `json:"role_id"`
		IsActive *bool  `json:"is_active"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	var usuario models.User
	if err := database.DB.First(&usuario, id).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		return
	}

	if req.FullName != "" {
		usuario.FullName = req.FullName
	}
	if req.RoleID != nil {
		usuario.RoleID = *req.RoleID
	}
	if req.IsActive != nil {
		usuario.IsActive = *req.IsActive
	}

	if err := database.DB.Save(&usuario).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar usuario"})
		return
	}

	database.DB.Preload("Role").First(&usuario, usuario.UserID)
	ctx.JSON(http.StatusOK, usuario)
}

// POST /api/admin/usuarios/:id/reset-password - Resetea la contraseña de un usuario
func (c *AdminController) ResetPasswordUsuario(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	var req struct {
		NewPassword string `json:"new_password" binding:"required,min=8"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "La contraseña debe tener al menos 8 caracteres"})
		return
	}

	var usuario models.User
	if err := database.DB.First(&usuario, id).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al procesar contraseña"})
		return
	}

	usuario.PasswordHash = string(hashedPassword)
	if err := database.DB.Save(&usuario).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar contraseña"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Contraseña actualizada correctamente"})
}
