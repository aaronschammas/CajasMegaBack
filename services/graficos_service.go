package services

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
	"time"
)

// GetMovimientosParaGraficos filtra movimientos según los parámetros para el endpoint de gráficos
func GetMovimientosParaGraficos(fechaDesde, fechaHasta, tipo, turno, montoMinimo, montoMaximo, arcoID, balanceNegativo string) ([]map[string]interface{}, error) {
	var movs []models.Movement
	query := database.DB

	if fechaDesde != "" {
		d, _ := time.Parse("2006-01-02", fechaDesde)
		query = query.Where("movement_date >= ?", d)
	}
	if fechaHasta != "" {
		h, _ := time.Parse("2006-01-02", fechaHasta)
		h = h.Add(24 * time.Hour)
		query = query.Where("movement_date < ?", h)
	}
	if turno != "" {
		query = query.Where("shift = ?", turno)
	}
	if tipo == "ingreso" {
		query = query.Where("movement_type = ?", "Ingreso")
	} else if tipo == "egreso" {
		query = query.Where("movement_type = ?", "Egreso")
	}
	if montoMinimo != "" {
		query = query.Where("amount >= ?", montoMinimo)
	}
	if montoMaximo != "" {
		query = query.Where("amount <= ?", montoMaximo)
	}
	if arcoID != "" {
		query = query.Where("arco_id = ?", arcoID)
	}
	query = query.Order("movement_date ASC")
	if err := query.Find(&movs).Error; err != nil {
		return nil, err
	}
	// Si se pide balance negativo, filtrar por arcos con balance negativo
	var out []map[string]interface{}
	arcoBalances := map[uint]float64{}
	for _, m := range movs {
		if m.MovementType == "Ingreso" {
			arcoBalances[m.ArcoID] += m.Amount
		} else if m.MovementType == "Egreso" {
			arcoBalances[m.ArcoID] -= m.Amount
		}
	}
	for _, m := range movs {
		row := map[string]interface{}{
			"Fecha":    m.MovementDate.Format("2006-01-02"),
			"Tipo":     m.MovementType,
			"Monto":    m.Amount,
			"Turno":    m.Shift,
			"Concepto": m.ConceptID,
			"Detalles": m.Details,
			"ArcoID":   m.ArcoID,
			"Balance":  arcoBalances[m.ArcoID],
		}
		if balanceNegativo == "1" {
			if arcoBalances[m.ArcoID] < 0 {
				out = append(out, row)
			}
		} else {
			out = append(out, row)
		}
	}
	return out, nil
}
