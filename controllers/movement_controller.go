package controllers

import (
	"caja-fuerte/models"   //
	"caja-fuerte/services" //
	"net/http"             //
	"strconv"              //

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
	var req models.BatchMovementRequest              //
	if err := ctx.ShouldBindJSON(&req); err != nil { //
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}) //
		return                                                       //
	}

	if err := c.movementService.CreateBatchMovements(req.Movements); err != nil { //
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}) //
		return                                                                //
	}

	ctx.JSON(http.StatusCreated, gin.H{"message": "Movimientos creados exitosamente"}) //
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
