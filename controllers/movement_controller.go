package controllers

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
	"caja-fuerte/services"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type MovementController struct {
	movementService *services.MovementService
}

func NewMovementController() *MovementController {
	return &MovementController{
		movementService: services.NewMovementService(),
	}
}

// GET /api/movimientos/arco/:arco_id
func (c *MovementController) GetMovementsByArcoID(ctx *gin.Context) {
	arcoIDStr := ctx.Param("arco_id")
	arcoID, err := strconv.ParseUint(arcoIDStr, 10, 64)
	if err != nil || arcoID == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "arco_id inválido"})
		return
	}
	movements, err := c.movementService.GetMovementsByArcoID(uint(arcoID))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"movements": movements})
}

// DELETE /api/movimientos/:movement_id
func (c *MovementController) DeleteMovement(ctx *gin.Context) {
	idStr := ctx.Param("movement_id")
	id64, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || id64 == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "movement_id inválido"})
		return
	}
	userID := ctx.GetUint("user_id")
	if userID == 0 {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return
	}
	if err := c.movementService.SoftDeleteMovement(uint(id64), userID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Movimiento eliminado"})
}

func (c *MovementController) CreateBatch(ctx *gin.Context) {
	var req models.BatchMovementRequest

	if ctx.ContentType() == "application/json" {
		raw, err := ctx.GetRawData()
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "No se pudo leer el cuerpo de la petición"})
			return
		}
		if err := json.Unmarshal(raw, &req); err != nil || len(req.Movements) == 0 {
			var single models.MovementRequest
			if err2 := json.Unmarshal(raw, &single); err2 != nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload inválido: " + err.Error()})
				return
			}
			req.Movements = []models.MovementRequest{single}
		}
	} else {
		movimientosStr := ctx.PostForm("movimientos")
		fmt.Println("[DEBUG] movimientosStr recibido:", movimientosStr)
		if movimientosStr == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "No se recibieron movimientos"})
			return
		}
		if err := json.Unmarshal([]byte(movimientosStr), &req.Movements); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Error al parsear movimientos: " + err.Error()})
			return
		}
		fmt.Printf("[DEBUG] Movements parseados: %+v\n", req.Movements)
		if len(req.Movements) == 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "No se enviaron movimientos para guardar"})
			return
		}
	}

	userID := ctx.GetUint("user_id")
	for i := range req.Movements {
		if req.Movements[i].CreatedBy == 0 {
			req.Movements[i].CreatedBy = userID
		}
	}

	if err := c.movementService.CreateBatchMovements(req.Movements); err != nil {
		if errors.Is(err, services.ErrNoOpenArco) {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "No hay un arco abierto para este turno. Debe abrir el arco antes de crear movimientos."})
			return
		}
		if errors.Is(err, services.ErrValidation) {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, services.ErrFKConstraint) {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Error de integridad referencial: " + err.Error()})
			return
		}
		if errors.Is(err, services.ErrCreateMovement) {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear movimiento: " + err.Error()})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"message": "Movimientos creados exitosamente"})
}

func (c *MovementController) GetMovements(ctx *gin.Context) {
	filters := make(map[string]interface{})

	if date := ctx.Query("date"); date != "" {
		filters["date"] = date
	}
	if userID := ctx.Query("user_id"); userID != "" {
		if id, err := strconv.Atoi(userID); err == nil {
			filters["user_id"] = id
		}
	}
	if shift := ctx.Query("shift"); shift != "" {
		filters["shift"] = shift
	}
	if conceptID := ctx.Query("concept_id"); conceptID != "" {
		if id, err := strconv.Atoi(conceptID); err == nil {
			filters["concept_id"] = id
		}
	}

	limit := 20
	offset := 0
	if l := ctx.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	if o := ctx.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil {
			offset = parsed
		}
	}

	movements, total, err := c.movementService.GetMovements(filters, limit, offset)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"movements": movements,
		"total":     total,
		"limit":     limit,
		"offset":    offset,
	})
}

func (c *MovementController) GetLastMovements(ctx *gin.Context) {
	limit := 15
	if l := ctx.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	movements, err := c.movementService.GetLastMovements(limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"movements": movements})
}

// GET /movimientos (HTML)
func (c *MovementController) MovementPage(ctx *gin.Context) {
	userEmail := ctx.GetString("email")
	content, err := os.ReadFile("./Front/movimiento.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la página")
		return
	}
	html := strings.ReplaceAll(string(content), "{{USUARIO_ACTUAL}}", userEmail)
	ctx.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}

// =====================================================================
// View models para las páginas HTML (Punto 10 - Refactorización)
// =====================================================================

// MovimientosPageData contiene los datos para las páginas de ingresos y egresos.
type MovimientosPageData struct {
	UsuarioActual  string
	ConceptOptions template.HTML
	CreatedBy      uint
	CreatedByLabel string
	MovimientosDB  template.HTML
	FiltrosHTML    template.HTML
}

// MovimientoView es el view model de un movimiento individual para la página de historial.
type MovimientoView struct {
	TipoClass      string
	TipoIcon       string
	Signo          string
	MovementType   string
	MontoStr       string
	ConceptoNombre string
	FechaStr       string
	CreatorName    string
	Details        string
}

// ArcoView es el view model de un arco con sus movimientos para la página de historial.
type ArcoView struct {
	ID               uint
	TurnoLabel       string
	FechaAperturaStr string
	OwnerName        string
	EstadoClass      string
	EstadoLabel      string
	SaldoInicialStr  string
	TotalIngresosStr string
	TotalEgresosStr  string
	TotalRetirosStr  string
	SaldoArcoStr     string
	Movimientos      []MovimientoView
}

// HistorialPageData contiene los datos para la página de historial de movimientos.
type HistorialPageData struct {
	UsuarioActual string
	Arcos         []ArcoView
}

// =====================================================================
// Función auxiliar para formatear moneda
// =====================================================================

func formatCurrency(amount float64) string {
	return fmt.Sprintf("$%.2f", amount)
}

// =====================================================================
// Función auxiliar para construir el HTML de filtros (reutilizada por ingresos y egresos)
// =====================================================================

func buildFiltrosHTML() template.HTML {
	return template.HTML(`<button id='btnFiltros' class='btn'>Filtros</button>
	<div id='modalFiltros' style='display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.3);z-index:1000;'>
	  <div style='background:#fff;padding:20px;margin:100px auto;width:400px;position:relative;'>
		<h3>Filtros avanzados</h3>
		<form method='GET'>
		  <label>Fecha desde: <input type='date' name='fecha_desde'></label><br>
		  <label>Fecha hasta: <input type='date' name='fecha_hasta'></label><br>
		  <label>Usuario: <input type='text' name='usuario'></label><br>
		  <label>Turno: <select name='turno'><option value=''>Todos</option><option value='M'>Mañana</option><option value='T'>Tarde</option></select></label><br>
		  <label>Concepto: <input type='text' name='concepto'></label><br>
		  <label>Tipo: <select name='tipo'><option value=''>Todos</option><option value='Ingreso'>Ingreso</option><option value='Egreso'>Egreso</option></select></label><br>
		  <button type='submit' class='btn'>Aplicar</button>
		  <button type='button' id='cerrarModal' class='btn'>Cerrar</button>
		</form>
	  </div>
	</div>
	<script>
	  document.getElementById('btnFiltros').onclick = function(){document.getElementById('modalFiltros').style.display='block';}
	  document.getElementById('cerrarModal').onclick = function(){document.getElementById('modalFiltros').style.display='none';}
	</script>`)
}

// =====================================================================
// Páginas HTML
// =====================================================================

// GET /ingresos (HTML)
func (c *MovementController) IngresosPage(ctx *gin.Context) {
	userEmail := ctx.GetString("email")
	userID := ctx.GetUint("user_id")

	concepts, err := conceptService.GetActiveConcepts()
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener conceptos")
		return
	}

	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, 0)

	arcoService := services.NewArcoService()
	arcoAbierto, err := arcoService.UltimoArcoAbiertoOCerrado()
	var arcoID uint
	if err == nil && arcoAbierto {
		ultimo, errUlt := arcoService.GetLastArco()
		if errUlt == nil && ultimo.Activo {
			arcoID = ultimo.ID
		}
	}

	filters := map[string]interface{}{
		"movement_type": "Ingreso",
		"date_gte":      startOfMonth,
		"date_lt":       endOfMonth,
	}
	if arcoID != 0 {
		filters["arco_id"] = arcoID
	}
	movements, _, err := c.movementService.GetMovementsWithFilters(filters)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener movimientos")
		return
	}

	// Construir opciones de concepto
	options := ""
	for _, concept := range concepts {
		if concept.MovementTypeAssociation == "Ingreso" || concept.MovementTypeAssociation == "Ambos" {
			options += fmt.Sprintf(`<option value="%d">%s (%s)</option>`, concept.ConceptID, concept.ConceptName, concept.MovementTypeAssociation)
		}
	}

	// Construir listado de movimientos del arco actual
	movsHTML := ""
	for _, m := range movements {
		movsHTML += fmt.Sprintf(
			`<div class='movimiento-list'><span><b>%d</b> - %s - $%.2f - %s - %s - %s</span></div>`,
			m.MovementID,
			m.MovementDate.Format("2006-01-02"),
			m.Amount,
			m.Creator.FullName,
			m.Shift,
			m.MovementType,
		)
	}

	data := MovimientosPageData{
		UsuarioActual:  userEmail,
		ConceptOptions: template.HTML(options),
		CreatedBy:      userID,
		CreatedByLabel: userEmail,
		MovimientosDB:  template.HTML(movsHTML),
		FiltrosHTML:    buildFiltrosHTML(),
	}

	tmpl, err := template.ParseFiles("./Front/ingresos.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la página")
		return
	}

	ctx.Status(http.StatusOK)
	ctx.Header("Content-Type", "text/html; charset=utf-8")
	tmpl.Execute(ctx.Writer, data)
}

// GET /egresos (HTML)
func (c *MovementController) EgresosPage(ctx *gin.Context) {
	userEmail := ctx.GetString("email")
	userID := ctx.GetUint("user_id")

	concepts, err := conceptService.GetActiveConcepts()
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener conceptos")
		return
	}

	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, 0)

	arcoService := services.NewArcoService()
	arcoAbierto, err := arcoService.UltimoArcoAbiertoOCerrado()
	var arcoID uint
	if err == nil && arcoAbierto {
		ultimo, errUlt := arcoService.GetLastArco()
		if errUlt == nil && ultimo.Activo {
			arcoID = ultimo.ID
		}
	}

	filters := map[string]interface{}{
		"movement_type": "Egreso",
		"date_gte":      startOfMonth,
		"date_lt":       endOfMonth,
	}
	if arcoID != 0 {
		filters["arco_id"] = arcoID
	}
	movements, _, err := c.movementService.GetMovementsWithFilters(filters)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener movimientos")
		return
	}

	// Construir opciones de concepto
	options := ""
	for _, concept := range concepts {
		if concept.MovementTypeAssociation == "Egreso" || concept.MovementTypeAssociation == "Ambos" {
			options += fmt.Sprintf(`<option value="%d">%s (%s)</option>`, concept.ConceptID, concept.ConceptName, concept.MovementTypeAssociation)
		}
	}

	// Construir listado de movimientos del arco actual
	movsHTML := ""
	for _, m := range movements {
		movsHTML += fmt.Sprintf(
			`<div class='movimiento-list'><span><b>%d</b> - %s - $%.2f - %s - %s - %s</span></div>`,
			m.MovementID,
			m.MovementDate.Format("2006-01-02"),
			m.Amount,
			m.Creator.FullName,
			m.Shift,
			m.MovementType,
		)
	}

	data := MovimientosPageData{
		UsuarioActual:  userEmail,
		ConceptOptions: template.HTML(options),
		CreatedBy:      userID,
		CreatedByLabel: userEmail,
		MovimientosDB:  template.HTML(movsHTML),
		FiltrosHTML:    buildFiltrosHTML(),
	}

	tmpl, err := template.ParseFiles("./Front/egresos.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la página")
		return
	}

	ctx.Status(http.StatusOK)
	ctx.Header("Content-Type", "text/html; charset=utf-8")
	tmpl.Execute(ctx.Writer, data)
}

// GET /historial-movimientos
func (c *MovementController) HistorialMovimientosPage(ctx *gin.Context) {
	userEmail := ctx.GetString("email")
	log.Println("[HISTORIAL] Iniciando carga de historial de movimientos")

	var arcos []models.Arco
	if err := database.DB.Preload("Usuario").
		Preload("Movimientos", "deleted_at IS NULL").
		Preload("Movimientos.Concept").
		Preload("Movimientos.Creator").
		Order("fecha_apertura DESC").
		Find(&arcos).Error; err != nil {
		log.Printf("[ERROR HISTORIAL] Error al cargar arcos: %v", err)
		ctx.String(http.StatusInternalServerError, "Error al cargar arcos: %v", err)
		return
	}

	log.Printf("[HISTORIAL] Se cargaron %d arcos", len(arcos))

	// Convertir los datos del modelo a view models para la plantilla
	arcoViews := make([]ArcoView, 0, len(arcos))
	for _, arco := range arcos {
		estadoLabel := "Abierto"
		estadoClass := "open"
		if arco.FechaCierre != nil {
			estadoLabel = "Cerrado"
			estadoClass = "closed"
		}

		turnoLabel := "Mañana"
		if arco.Turno == "T" {
			turnoLabel = "Tarde"
		}

		var totalIngresos, totalEgresos, totalRetiros float64
		for _, mov := range arco.Movimientos {
			switch mov.MovementType {
			case "Ingreso":
				totalIngresos += mov.Amount
			case "Egreso":
				totalEgresos += mov.Amount
			case "RetiroCaja":
				totalRetiros += mov.Amount
			}
		}
		saldoArco := arco.SaldoInicial + totalIngresos - totalEgresos - totalRetiros

		movViews := make([]MovimientoView, 0, len(arco.Movimientos))
		for _, mov := range arco.Movimientos {
			tipoClass := "ingreso"
			tipoIcon := "fa-plus-circle"
			signo := "+"
			if mov.MovementType == "Egreso" {
				tipoClass = "egreso"
				tipoIcon = "fa-minus-circle"
				signo = "-"
			} else if mov.MovementType == "RetiroCaja" {
				tipoClass = "retiro"
				tipoIcon = "fa-hand-holding-usd"
				signo = "-"
			}

			conceptoNombre := "Sin concepto"
			if mov.Concept.ConceptName != "" {
				conceptoNombre = mov.Concept.ConceptName
			}

			movViews = append(movViews, MovimientoView{
				TipoClass:      tipoClass,
				TipoIcon:       tipoIcon,
				Signo:          signo,
				MovementType:   mov.MovementType,
				MontoStr:       formatCurrency(mov.Amount),
				ConceptoNombre: conceptoNombre,
				FechaStr:       mov.MovementDate.Format("02/01/2006 15:04"),
				CreatorName:    mov.Creator.FullName,
				Details:        mov.Details,
			})
		}

		arcoViews = append(arcoViews, ArcoView{
			ID:               arco.ID,
			TurnoLabel:       turnoLabel,
			FechaAperturaStr: arco.FechaApertura.Format("02/01/2006"),
			OwnerName:        arco.Usuario.FullName,
			EstadoClass:      estadoClass,
			EstadoLabel:      estadoLabel,
			SaldoInicialStr:  formatCurrency(arco.SaldoInicial),
			TotalIngresosStr: formatCurrency(totalIngresos),
			TotalEgresosStr:  formatCurrency(totalEgresos),
			TotalRetirosStr:  formatCurrency(totalRetiros),
			SaldoArcoStr:     formatCurrency(saldoArco),
			Movimientos:      movViews,
		})
	}

	data := HistorialPageData{
		UsuarioActual: userEmail,
		Arcos:         arcoViews,
	}

	tmpl, err := template.ParseFiles("./Front/historial_movimientos.html")
	if err != nil {
		log.Printf("[ERROR HISTORIAL] Error al cargar plantilla HTML: %v", err)
		ctx.String(http.StatusInternalServerError, "Error al cargar la página: %v", err)
		return
	}

	ctx.Status(http.StatusOK)
	ctx.Header("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.Execute(ctx.Writer, data); err != nil {
		log.Printf("[ERROR HISTORIAL] Error al renderizar: %v", err)
	}
	log.Println("[HISTORIAL] Página generada exitosamente")
}

// POST /abrir-caja (desde movimientos.html)
func (c *MovementController) AbrirCaja(ctx *gin.Context) {
	userID := ctx.GetUint("user_id")
	turno := ctx.PostForm("turno")
	if turno != "M" && turno != "T" {
		ctx.String(http.StatusBadRequest, "Turno inválido")
		return
	}
	arcoService := services.NewArcoService()
	_, err := arcoService.AbrirArco(userID, turno, false)
	if err != nil {
		ctx.String(http.StatusBadRequest, "Error al abrir caja: %s", err.Error())
		return
	}
	ctx.Redirect(http.StatusSeeOther, "/movimientos")
}
