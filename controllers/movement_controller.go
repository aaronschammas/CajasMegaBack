package controllers

import (
	"caja-fuerte/models"   //
	"caja-fuerte/services" //
	"encoding/json"        //
	"fmt"                  //
	"net/http"             //
	"os"
	"strconv" //
	"strings"
	"time"

	"github.com/gin-gonic/gin" //
)

type MovementController struct { //
	movementService *services.MovementService //
}

func NewMovementController() *MovementController { //
	return &MovementController{ //
		movementService: services.NewMovementService(), //
	}
}

func (c *MovementController) CreateBatch(ctx *gin.Context) { //
	var req models.BatchMovementRequest //

	// Permitir recibir tanto JSON (API) como formulario (desde HTML)
	if ctx.ContentType() == "application/json" {
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	} else {
		// Recibe desde formulario: el campo 'movimientos' es un string JSON
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

	if err := c.movementService.CreateBatchMovements(req.Movements); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"message": "Movimientos creados exitosamente"})
}

func (c *MovementController) GetMovements(ctx *gin.Context) { //
	// Obtener parámetros de consulta
	filters := make(map[string]interface{}) //

	if date := ctx.Query("date"); date != "" { //
		filters["date"] = date //
	}
	if userID := ctx.Query("user_id"); userID != "" { //
		if id, err := strconv.Atoi(userID); err == nil { //
			filters["user_id"] = id //
		}
	}
	if shift := ctx.Query("shift"); shift != "" { //
		filters["shift"] = shift //
	}
	if conceptID := ctx.Query("concept_id"); conceptID != "" { //
		if id, err := strconv.Atoi(conceptID); err == nil { //
			filters["concept_id"] = id //
		}
	}

	// Paginación
	limit := 20                           //
	offset := 0                           //
	if l := ctx.Query("limit"); l != "" { //
		if parsed, err := strconv.Atoi(l); err == nil { //
			limit = parsed //
		}
	}
	if o := ctx.Query("offset"); o != "" { //
		if parsed, err := strconv.Atoi(o); err == nil { //
			offset = parsed //
		}
	}

	movements, total, err := c.movementService.GetMovements(filters, limit, offset) //
	if err != nil {                                                                 //
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}) //
		return                                                                //
	}

	ctx.JSON(http.StatusOK, gin.H{ //
		"movements": movements, //
		"total":     total,     //
		"limit":     limit,     //
		"offset":    offset,    //
	})
}

func (c *MovementController) GetLastMovements(ctx *gin.Context) { //
	limit := 15                           //
	if l := ctx.Query("limit"); l != "" { //
		if parsed, err := strconv.Atoi(l); err == nil { //
			limit = parsed //
		}
	}

	movements, err := c.movementService.GetLastMovements(limit) //
	if err != nil {                                             //
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}) //
		return                                                                //
	}

	ctx.JSON(http.StatusOK, gin.H{"movements": movements}) //
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

// GET /ingresos (HTML)
func (c *MovementController) IngresosPage(ctx *gin.Context) {
	userEmail := ctx.GetString("email")
	var userID uint64
	if v, exists := ctx.Get("user_id"); exists {
		switch val := v.(type) {
		case float64:
			userID = uint64(val)
		case int:
			userID = uint64(val)
		case int64:
			userID = uint64(val)
		case uint:
			userID = uint64(val)
		case uint64:
			userID = val
		case string:
			parsed, err := strconv.ParseUint(val, 10, 64)
			if err == nil {
				userID = parsed
			}
		}
	}
	createdByLabel := userEmail
	concepts, err := conceptService.GetActiveConcepts()
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener conceptos")
		return
	}
	// Filtros por defecto: mes actual y tipo 'Ingreso'
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, 0)
	filters := map[string]interface{}{
		"movement_type": "Ingreso",
		"date_gte":      startOfMonth,
		"date_lt":       endOfMonth,
	}
	movements, _, err := c.movementService.GetMovementsWithFilters(filters)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener movimientos")
		return
	}
	// Renderizar movimientos en HTML
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
	content, err := os.ReadFile("./Front/ingresos.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la página")
		return
	}
	options := ""
	for _, concept := range concepts {
		if concept.MovementTypeAssociation == "Ingreso" || concept.MovementTypeAssociation == "Ambos" {
			options += fmt.Sprintf("<option value=\"%d\">%s (%s)</option>", concept.ConceptID, concept.ConceptName, concept.MovementTypeAssociation)
		}
	}
	html := strings.ReplaceAll(string(content), "{{USUARIO_ACTUAL}}", userEmail)
	html = strings.ReplaceAll(html, "{{CONCEPT_OPTIONS}}", options)
	html = strings.ReplaceAll(html, "{{CREATED_BY}}", fmt.Sprintf("%d", userID))
	html = strings.ReplaceAll(html, "{{CREATED_BY_LABEL}}", createdByLabel)
	html = strings.ReplaceAll(html, "{{MOVIMIENTOS_DB}}", movsHTML)
	// Agregar formulario de filtros (botón y modal)
	filtrosHTML := `<button id='btnFiltros' class='btn'>Filtros</button>
	<div id='modalFiltros' style='display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.3);z-index:1000;'>
	  <div style='background:#fff;padding:20px;margin:100px auto;width:400px;position:relative;'>
	    <h3>Filtros avanzados</h3>
	    <form method='GET' action='/ingresos'>
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
	</script>`
	html = strings.Replace(html, "{{FILTROS_HTML}}", filtrosHTML, 1)
	ctx.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}
