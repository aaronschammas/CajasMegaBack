package services

import (
	"caja-fuerte/models"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"time"
)

const argentinadatosIPCURL = "https://api.argentinadatos.com/v1/finanzas/indices/inflacion"

// datoIPCRaw es la estructura que devuelve ArgentinaDatos
type datoIPCRaw struct {
	Fecha string  `json:"fecha"` // "2025-03-31" o "2025-03"
	Valor float64 `json:"valor"` // porcentaje mensual: 2.4 = 2.4%
}

// InflacionService obtiene y procesa datos de IPC del INDEC vía ArgentinaDatos
type InflacionService struct{}

func NewInflacionService() *InflacionService {
	return &InflacionService{}
}

// ObtenerAcumulado calcula la inflación acumulada del período [desde, hasta).

func (s *InflacionService) ObtenerAcumulado(desde, hasta time.Time) *models.DetalleInflacion {
	datos, err := s.fetchIPC()
	if err != nil {
		log.Printf("[INFLACION] Error al consultar ArgentinaDatos: %v", err)
		return &models.DetalleInflacion{
			Meses:         []models.MesInflacion{},
			AcumuladoPct:  0,
			Fuente:        "ArgentinaDatos (error al consultar)",
			FechaConsulta: time.Now(),
			Error:         err.Error(),
		}
	}

	mesDesde := primerDiaMes(desde)
	mesHasta := primerDiaMes(hasta)

	var meses []models.MesInflacion
	acumulado := 1.0

	for _, d := range datos {
		fecha, err := parseFechaIPC(d.Fecha)
		if err != nil {
			continue
		}
		mesF := primerDiaMes(fecha)

		// Incluir meses: desde <= mesF < hasta
		if (mesF.Equal(mesDesde) || mesF.After(mesDesde)) && mesF.Before(mesHasta) {
			meses = append(meses, models.MesInflacion{
				Periodo: formatPeriodo(fecha),
				Pct:     roundDos(d.Valor),
			})
			acumulado *= (1.0 + d.Valor/100.0)
		}
	}

	// Si no hay datos (API sin datos del período), devolver estructura vacía pero válida
	if len(meses) == 0 {
		return &models.DetalleInflacion{
			Meses:         []models.MesInflacion{},
			AcumuladoPct:  0,
			Fuente:        "INDEC vía ArgentinaDatos",
			FechaConsulta: time.Now(),
			Error:         "Sin datos para el período solicitado",
		}
	}

	return &models.DetalleInflacion{
		Meses:         meses,
		AcumuladoPct:  roundDos((acumulado - 1.0) * 100.0),
		Fuente:        "INDEC vía ArgentinaDatos",
		FechaConsulta: time.Now(),
	}
}

// fetchIPC descarga y ordena los datos mensuales de inflación
func (s *InflacionService) fetchIPC() ([]datoIPCRaw, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Get(argentinadatosIPCURL)
	if err != nil {
		return nil, fmt.Errorf("error de conexión: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ArgentinaDatos respondió con status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error leyendo respuesta: %w", err)
	}

	var datos []datoIPCRaw
	if err := json.Unmarshal(body, &datos); err != nil {
		return nil, fmt.Errorf("error parseando JSON: %w", err)
	}

	// Ordenar por fecha ascendente
	sort.Slice(datos, func(i, j int) bool {
		return datos[i].Fecha < datos[j].Fecha
	})

	return datos, nil
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func primerDiaMes(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

func parseFechaIPC(s string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02", "2006-01"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("formato de fecha no reconocido: %s", s)
}

func formatPeriodo(t time.Time) string {
	nombres := []string{"Ene", "Feb", "Mar", "Abr", "May", "Jun",
		"Jul", "Ago", "Sep", "Oct", "Nov", "Dic"}
	return fmt.Sprintf("%s %d", nombres[t.Month()-1], t.Year())
}

func roundDos(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}
