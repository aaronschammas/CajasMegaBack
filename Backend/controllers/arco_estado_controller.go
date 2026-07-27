package controllers

import (
	"caja-fuerte/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ArcoEstadoHandler devuelve el estado del arco del usuario autenticado.
// Si is_global=true y el rol es Administrador General, devuelve el saldo consolidado de todas las cajas.
// En cualquier otro caso devuelve la caja personal del usuario.
func ArcoEstadoHandler(c *gin.Context) {
	userID := c.GetUint("user_id")
	role := c.GetString("role")

	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	isGlobalStr := c.Query("is_global")
	isGlobal := isGlobalStr == "true" || isGlobalStr == "1"

	// Solo Admin General puede consultar caja global
	if isGlobal && role != "Administrador General" {
		c.JSON(http.StatusForbidden, gin.H{"error": "No tiene permisos para ver la caja global"})
		return
	}

	arcoService := services.NewArcoService()

	if isGlobal {
		saldo, err := arcoService.GetSaldoArcoUsuario(userID, true)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"arco_abierto": false,
				"arco":         nil,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"arco_abierto": saldo.Activo,
			"arco": gin.H{
				"id":             0,
				"created_by":     0,
				"owner_id":       0,
				"is_global":      true,
				"fecha_apertura": saldo.FechaApertura,
				"fecha_cierre":   saldo.FechaCierre,
				"turno":          "M",
				"activo":         saldo.Activo,
				"saldo_inicial":  saldo.SaldoInicial,
				"saldo_final":    saldo.SaldoTotal,
				"usuario": gin.H{
					"user_id":   0,
					"full_name": "Caja Global",
					"email":     "",
				},
			},
		})
		return
	}

	arco, err := arcoService.GetArcoActivoUsuario(userID)

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"arco_abierto": false,
			"arco":         nil,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"arco_abierto": true,
		"arco":         arco,
	})
}
