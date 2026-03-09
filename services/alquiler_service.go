package services

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
	"context"
	"errors"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AlquilerService maneja la lógica de negocio del módulo de alquileres.
// Las propiedades se almacenan en MongoDB; los pagos impactan en MySQL (caja).
type AlquilerService struct {
	coll *mongo.Collection
}

func NewAlquilerService() *AlquilerService {
	return &AlquilerService{
		coll: database.MongoDB.Collection(database.CollectionPropiedades),
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Propiedades
// ─────────────────────────────────────────────────────────────────────────────

// CrearPropiedad crea una nueva propiedad en MongoDB inicializando 12 meses en "pending".
func (s *AlquilerService) CrearPropiedad(req models.CrearPropiedadRequest, createdBy uint) (*models.Propiedad, error) {
	anio := time.Now().Year()

	// Inicializar 12 meses en pendiente
	pagos := make([]models.PagoMes, 12)
	for i := range pagos {
		pagos[i] = models.PagoMes{
			Mes:    i,
			Estado: models.PendienteEstado,
			Monto:  req.AlquilerMensual,
		}
	}

	meta := req.Metadata
	if meta == nil {
		meta = map[string]interface{}{}
	}

	imagenes := req.Imagenes
	if imagenes == nil {
		imagenes = []string{}
	}

	frecuencia := req.FrecuenciaActualizacion
	if frecuencia > 0 && frecuencia < 3 {
		frecuencia = 3 // mínimo 3 meses
	}

	prop := models.Propiedad{
		ID:                      primitive.NewObjectID(),
		Direccion:               req.Direccion,
		Inquilino:               req.Inquilino,
		AlquilerMensual:         req.AlquilerMensual,
		Ocupada:                 req.Ocupada,
		IndiceInflacion:         req.IndiceInflacion,
		FechaActualizacion:      req.FechaActualizacion,
		FrecuenciaActualizacion: frecuencia,
		PagaEnDolares:           req.PagaEnDolares,
		MontoDolares:            req.MontoDolares,
		Imagenes:                imagenes,
		Anio:                    anio,
		Pagos:                   pagos,
		Metadata:                meta,
		CreatedAt:               time.Now(),
		UpdatedAt:               time.Now(),
		CreatedBy:               createdBy,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := s.coll.InsertOne(ctx, prop)
	if err != nil {
		return nil, err
	}

	return &prop, nil
}

// GetPropiedades devuelve propiedades con filtros opcionales.
func (s *AlquilerService) GetPropiedades(busqueda, filtroEstado string, anio int) ([]models.Propiedad, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{}

	if anio > 0 {
		filter["anio"] = anio
	}

	// Filtro de búsqueda por texto (dirección o inquilino)
	if busqueda != "" {
		filter["$or"] = bson.A{
			bson.M{"direccion": bson.M{"$regex": busqueda, "$options": "i"}},
			bson.M{"inquilino": bson.M{"$regex": busqueda, "$options": "i"}},
		}
	}

	// Filtro por estado de pagos
	switch filtroEstado {
	case "aldia":
		// Todas las propiedades donde NINGÚN pago es diferente a "paid"
		filter["pagos"] = bson.M{"$not": bson.M{"$elemMatch": bson.M{"estado": bson.M{"$ne": "paid"}}}}
		filter["ocupada"] = true
	case "atraso1":
		filter["pagos"] = bson.M{"$elemMatch": bson.M{"estado": bson.M{"$in": bson.A{"late_1", "late_2"}}}}
	case "atraso2":
		filter["pagos"] = bson.M{"$elemMatch": bson.M{"estado": "late_2"}}
	case "desocupadas":
		filter["ocupada"] = false
	}

	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := s.coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var propiedades []models.Propiedad
	if err := cursor.All(ctx, &propiedades); err != nil {
		return nil, err
	}

	return propiedades, nil
}

// GetPropiedadByID obtiene una propiedad por su ObjectID.
func (s *AlquilerService) GetPropiedadByID(id string) (*models.Propiedad, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("ID inválido")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var prop models.Propiedad
	err = s.coll.FindOne(ctx, bson.M{"_id": objID}).Decode(&prop)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("propiedad no encontrada")
		}
		return nil, err
	}
	return &prop, nil
}

// ActualizarPropiedad actualiza los campos enviados de una propiedad.
func (s *AlquilerService) ActualizarPropiedad(id string, req models.ActualizarPropiedadRequest) (*models.Propiedad, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("ID inválido")
	}

	updates := bson.M{"updated_at": time.Now()}

	if req.Direccion != nil {
		updates["direccion"] = *req.Direccion
	}
	if req.Inquilino != nil {
		updates["inquilino"] = *req.Inquilino
	}
	if req.AlquilerMensual != nil {
		updates["alquiler_mensual"] = *req.AlquilerMensual
	}
	if req.IndiceInflacion != nil {
		updates["indice_inflacion"] = *req.IndiceInflacion
	}
	if req.FechaActualizacion != nil {
		updates["fecha_actualizacion"] = *req.FechaActualizacion
	}
	if req.Ocupada != nil {
		updates["ocupada"] = *req.Ocupada
	}
	if req.FrecuenciaActualizacion != nil {
		f := *req.FrecuenciaActualizacion
		if f > 0 && f < 3 {
			f = 3
		}
		updates["frecuencia_actualizacion"] = f
	}
	if req.PagaEnDolares != nil {
		updates["paga_en_dolares"] = *req.PagaEnDolares
	}
	if req.MontoDolares != nil {
		updates["monto_dolares"] = *req.MontoDolares
	}
	if req.Imagenes != nil {
		updates["imagenes"] = *req.Imagenes
	}
	// Metadata: merge de campos (no reemplaza todo el mapa, solo los keys enviados)
	if req.Metadata != nil {
		for k, v := range req.Metadata {
			updates["metadata."+k] = v
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated models.Propiedad
	err = s.coll.FindOneAndUpdate(ctx,
		bson.M{"_id": objID},
		bson.M{"$set": updates},
		opts,
	).Decode(&updated)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("propiedad no encontrada")
		}
		return nil, err
	}
	return &updated, nil
}

// EliminarPropiedad elimina una propiedad de MongoDB.
func (s *AlquilerService) EliminarPropiedad(id string) error {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errors.New("ID inválido")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := s.coll.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return errors.New("propiedad no encontrada")
	}
	return nil
}

// EliminarMetadataField elimina un campo específico del mapa Metadata.
func (s *AlquilerService) EliminarMetadataField(id, campo string) (*models.Propiedad, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("ID inválido")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated models.Propiedad
	err = s.coll.FindOneAndUpdate(ctx,
		bson.M{"_id": objID},
		bson.M{
			"$unset": bson.M{"metadata." + campo: ""},
			"$set":   bson.M{"updated_at": time.Now()},
		},
		opts,
	).Decode(&updated)

	if err != nil {
		return nil, err
	}
	return &updated, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagos (MongoDB + MySQL)
// ─────────────────────────────────────────────────────────────────────────────

// RegistrarPago marca un mes como pagado en MongoDB y crea un Movimiento de
// tipo "Ingreso" en la caja del Administrador General (MySQL).
func (s *AlquilerService) RegistrarPago(propID string, req models.RegistrarPagoRequest, registradoPor uint) (*models.Propiedad, error) {
	// 1. Obtener la propiedad
	prop, err := s.GetPropiedadByID(propID)
	if err != nil {
		return nil, err
	}

	if !prop.Ocupada {
		return nil, errors.New("la propiedad está desocupada, no se puede registrar un pago")
	}

	if req.Mes < 0 || req.Mes > 11 {
		return nil, errors.New("mes inválido (debe estar entre 0 y 11)")
	}

	if prop.Pagos[req.Mes].Estado == models.PagadoEstado {
		return nil, errors.New("este mes ya está marcado como pagado")
	}

	// 2. Crear el movimiento en MySQL (caja del admin)
	movID, err := s.crearMovimientoAlquiler(prop, req, registradoPor)
	if err != nil {
		log.Printf("[ALQUILER] Advertencia: no se pudo crear movimiento en caja: %v", err)
		// Continuamos - el pago se registra en Mongo aunque no haya arco abierto
	}

	// 3. Actualizar estado en MongoDB
	now := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	objID := prop.ID

	updateFields := bson.M{
		"updated_at":                   now,
		"pagos." + intToStr(req.Mes) + ".estado":     string(models.PagadoEstado),
		"pagos." + intToStr(req.Mes) + ".monto":      req.Monto,
		"pagos." + intToStr(req.Mes) + ".fecha_pago": now,
	}
	if movID != nil {
		updateFields["pagos."+intToStr(req.Mes)+".movement_id"] = *movID
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated models.Propiedad
	err = s.coll.FindOneAndUpdate(ctx,
		bson.M{"_id": objID},
		bson.M{"$set": updateFields},
		opts,
	).Decode(&updated)

	if err != nil {
		return nil, err
	}
	return &updated, nil
}

// DeshacerPago revierte el pago de un mes: actualiza MongoDB y elimina el movimiento de MySQL.
func (s *AlquilerService) DeshacerPago(propID string, mes int, userID uint) (*models.Propiedad, error) {
	prop, err := s.GetPropiedadByID(propID)
	if err != nil {
		return nil, err
	}

	if mes < 0 || mes > 11 {
		return nil, errors.New("mes inválido")
	}

	if prop.Pagos[mes].Estado != models.PagadoEstado {
		return nil, errors.New("este mes no está pagado")
	}

	// Eliminar movimiento de MySQL si existe
	movID := prop.Pagos[mes].MovementID
	if movID != nil {
		ms := NewMovementService()
		if err := ms.SoftDeleteMovement(*movID, userID); err != nil {
			log.Printf("[ALQUILER] Advertencia: no se pudo eliminar movimiento %d de MySQL: %v", *movID, err)
		}
	}

	// Actualizar MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	updateFields := bson.M{
		"updated_at": time.Now(),
		"pagos." + intToStr(mes) + ".estado":      string(models.PendienteEstado),
		"pagos." + intToStr(mes) + ".fecha_pago":  nil,
		"pagos." + intToStr(mes) + ".movement_id": nil,
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated models.Propiedad
	err = s.coll.FindOneAndUpdate(ctx,
		bson.M{"_id": prop.ID},
		bson.M{"$set": updateFields},
		opts,
	).Decode(&updated)

	if err != nil {
		return nil, err
	}
	return &updated, nil
}

// ActualizarEstadosMorosos recalcula el estado de los pagos pendientes y los
// marca como late_1 o late_2 según los meses de atraso acumulados.
// Se puede llamar periódicamente (ej: cron).
func (s *AlquilerService) ActualizarEstadosMorosos() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	mesActual := int(time.Now().Month()) - 1 // 0-based

	cursor, err := s.coll.Find(ctx, bson.M{"ocupada": true})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	var props []models.Propiedad
	if err := cursor.All(ctx, &props); err != nil {
		return err
	}

	for _, prop := range props {
		updates := bson.M{"updated_at": time.Now()}
		changed := false

		for i := 0; i < mesActual; i++ {
			pago := prop.Pagos[i]
			if pago.Estado == models.PagadoEstado {
				continue
			}

			mesesAtraso := mesActual - i
			var nuevoEstado models.EstadoPago
			switch {
			case mesesAtraso >= 2:
				nuevoEstado = models.Atraso2Estado
			case mesesAtraso == 1:
				nuevoEstado = models.Atraso1Estado
			default:
				nuevoEstado = models.PendienteEstado
			}

			if pago.Estado != nuevoEstado {
				updates["pagos."+intToStr(i)+".estado"] = string(nuevoEstado)
				changed = true
			}
		}

		if changed {
			updateCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_, _ = s.coll.UpdateOne(updateCtx, bson.M{"_id": prop.ID}, bson.M{"$set": updates})
			cancel()
		}
	}
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen / Reportes
// ─────────────────────────────────────────────────────────────────────────────

// GetResumen calcula los KPIs del módulo de alquileres.
func (s *AlquilerService) GetResumen(anio int) (*models.ResumenAlquileres, error) {
	if anio == 0 {
		anio = time.Now().Year()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := s.coll.Find(ctx, bson.M{"anio": anio})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var props []models.Propiedad
	if err := cursor.All(ctx, &props); err != nil {
		return nil, err
	}

	resumen := &models.ResumenAlquileres{
		TotalPropiedades: len(props),
	}

	propiedadesConAtraso := map[primitive.ObjectID]bool{}

	for _, p := range props {
		if p.Ocupada {
			resumen.PropiedadesOcupadas++
			resumen.IngresoAnualProyectado += p.AlquilerMensual * 12
		}

		for _, pago := range p.Pagos {
			if pago.Estado != models.PagadoEstado {
				resumen.DeudaTotal += p.AlquilerMensual
				resumen.MesesPendientesTotal++
			}
			if pago.Estado == models.Atraso1Estado || pago.Estado == models.Atraso2Estado {
				resumen.PagosAtrasados++
				propiedadesConAtraso[p.ID] = true
			}
		}
	}

	resumen.PropiedadesConAtraso = len(propiedadesConAtraso)

	if resumen.TotalPropiedades > 0 {
		resumen.TasaOcupacion = float64(resumen.PropiedadesOcupadas) / float64(resumen.TotalPropiedades) * 100
	}

	return resumen, nil
}

// GetMovimientosAlquiler devuelve los movimientos MySQL relacionados a alquileres
// filtrados por período (dia, mes, anio).
func (s *AlquilerService) GetMovimientosAlquiler(periodo string) (interface{}, error) {
	now := time.Now()
	var desde, hasta time.Time

	switch periodo {
	case "dia":
		desde = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		hasta = desde.Add(24 * time.Hour)
	case "mes":
		desde = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		hasta = desde.AddDate(0, 1, 0)
	default: // anio
		desde = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		hasta = desde.AddDate(1, 0, 0)
	}

	// Buscar concepto "Alquiler"
	alquilerConceptoID := s.getAlquilerConceptID()

	type Resultado struct {
		Movimientos interface{} `json:"movimientos"`
		TotalMonto  float64     `json:"total_monto"`
		Cantidad    int         `json:"cantidad"`
		Periodo     string      `json:"periodo"`
		Desde       time.Time   `json:"desde"`
		Hasta       time.Time   `json:"hasta"`
	}

	var movimientos []models.Movement
	query := database.DB.Preload("Creator").Preload("Concept").
		Where("movement_date >= ? AND movement_date < ?", desde, hasta).
		Where("deleted_at IS NULL")

	if alquilerConceptoID > 0 {
		query = query.Where("concept_id = ?", alquilerConceptoID)
	} else {
		query = query.Where("1=0") // no hay concepto configurado
	}

	if err := query.Find(&movimientos).Error; err != nil {
		return nil, err
	}

	var total float64
	for _, m := range movimientos {
		total += m.Amount
	}

	return Resultado{
		Movimientos: movimientos,
		TotalMonto:  total,
		Cantidad:    len(movimientos),
		Periodo:     periodo,
		Desde:       desde,
		Hasta:       hasta,
	}, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers privados
// ─────────────────────────────────────────────────────────────────────────────

// crearMovimientoAlquiler crea un movimiento de tipo Ingreso en la caja del admin.
// Devuelve el movement_id creado o nil si no se pudo crear.
func (s *AlquilerService) crearMovimientoAlquiler(prop *models.Propiedad, req models.RegistrarPagoRequest, registradoPor uint) (*uint, error) {
	// Buscar el arco activo del usuario que registra (gestor o admin)
	var arcoID uint
	var arco models.Arco

	// Primero intentar el arco activo del usuario que registra
	err := database.DB.Where("owner_id = ? AND activo = ?", registradoPor, true).First(&arco).Error
	if err != nil {
		// Si no tiene arco propio, buscar cualquier arco activo de un admin
		var adminUser models.User
		var adminRole models.Role
		if err2 := database.DB.Where("role_name = ?", "Administrador General").First(&adminRole).Error; err2 == nil {
			if err3 := database.DB.Where("role_id = ? AND is_active = ?", adminRole.RoleID, true).First(&adminUser).Error; err3 == nil {
				database.DB.Where("owner_id = ? AND activo = ?", adminUser.UserID, true).First(&arco)
			}
		}
	}

	if arco.ID == 0 {
		return nil, errors.New("no hay ningún arco activo disponible")
	}
	arcoID = arco.ID

	// Buscar o crear concepto "Alquiler"
	conceptID := s.getOrCreateAlquilerConcept(registradoPor)
	if conceptID == 0 {
		return nil, errors.New("no se pudo obtener el concepto de alquiler")
	}

	// Generar referenceID
	ms := NewMovementService()
	refID, err := ms.generateReferenceID(database.DB, registradoPor)
	if err != nil {
		return nil, err
	}

	nombreMes := []string{"Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
		"Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"}
	details := "Alquiler " + nombreMes[req.Mes] + " - " + prop.Direccion
	if prop.Inquilino != "" {
		details += " (" + prop.Inquilino + ")"
	}

	movement := models.Movement{
		ReferenceID:  refID,
		MovementType: "Ingreso",
		MovementDate: time.Now(),
		Amount:       req.Monto,
		Shift:        "M",
		ConceptID:    conceptID,
		Details:      details,
		CreatedBy:    registradoPor,
		ArcoID:       arcoID,
	}

	if err := database.DB.Create(&movement).Error; err != nil {
		return nil, err
	}

	income := models.SpecificIncome{MovementID: movement.MovementID}
	if err := database.DB.Create(&income).Error; err != nil {
		log.Printf("[ALQUILER] Advertencia: no se pudo crear SpecificIncome: %v", err)
	}

	return &movement.MovementID, nil
}

// getAlquilerConceptID busca el ID del concepto de alquiler.
func (s *AlquilerService) getAlquilerConceptID() uint {
	var concept models.ConceptType
	if err := database.DB.Where("LOWER(concept_name) LIKE ?", "%alquiler%").First(&concept).Error; err == nil {
		return concept.ConceptID
	}
	return 0
}

// getOrCreateAlquilerConcept busca o crea el concepto "Alquiler de Propiedad".
func (s *AlquilerService) getOrCreateAlquilerConcept(createdBy uint) uint {
	var concept models.ConceptType

	if err := database.DB.Where("LOWER(concept_name) LIKE ?", "%alquiler%").First(&concept).Error; err == nil {
		return concept.ConceptID
	}

	now := time.Now()
	newConcept := models.ConceptType{
		ConceptName:             "Alquiler de Propiedad",
		MovementTypeAssociation: "Ingreso",
		IsActive:                true,
		CreatedBy:               &createdBy,
		CreatedAt:               now,
	}

	if err := database.DB.Create(&newConcept).Error; err != nil {
		return 0
	}
	return newConcept.ConceptID
}

// intToStr convierte un int a string (para construir paths de bson).
func intToStr(n int) string {
	return []string{"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"}[n]
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualización de montos con IPC
// ─────────────────────────────────────────────────────────────────────────────

// GetActualizacionesPendientes devuelve las propiedades en pesos cuya fecha de
// actualización ya pasó y no están pospuestas, junto con el cálculo de IPC.
func (s *AlquilerService) GetActualizacionesPendientes() ([]models.PropiedadActualizacion, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	now := time.Now()

	// Propiedades: en pesos, ocupadas, con frecuencia ≥3 meses configurada,
	// cuya fecha de actualización ya llegó y no están pospuestas (o posponimiento expirado)
	filter := bson.M{
		"paga_en_dolares":          false,
		"ocupada":                  true,
		"frecuencia_actualizacion": bson.M{"$gte": 3},
		"fecha_actualizacion":      bson.M{"$ne": nil, "$lte": now},
		"$or": bson.A{
			bson.M{"posponer_hasta": nil},
			bson.M{"posponer_hasta": bson.M{"$exists": false}},
			bson.M{"posponer_hasta": bson.M{"$lte": now}},
		},
	}

	cursor, err := s.coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var props []models.Propiedad
	if err := cursor.All(ctx, &props); err != nil {
		return nil, err
	}

	if len(props) == 0 {
		return []models.PropiedadActualizacion{}, nil
	}

	inflSvc := NewInflacionService()
	var resultado []models.PropiedadActualizacion

	for _, prop := range props {
		if prop.FechaActualizacion == nil || prop.FrecuenciaActualizacion < 3 {
			continue
		}

		// Período: desde (fecha_actualizacion - frecuencia_meses) hasta fecha_actualizacion
		desde := prop.FechaActualizacion.AddDate(0, -prop.FrecuenciaActualizacion, 0)
		hasta := *prop.FechaActualizacion

		detalle := inflSvc.ObtenerAcumulado(desde, hasta)

		montoRec := prop.AlquilerMensual * (1.0 + detalle.AcumuladoPct/100.0)
		// Redondear a 2 decimales
		montoRec = float64(int(montoRec*100+0.5)) / 100

		resultado = append(resultado, models.PropiedadActualizacion{
			Propiedad:        prop,
			Inflacion:        detalle,
			MontoActual:      prop.AlquilerMensual,
			MontoRecomendado: montoRec,
		})
	}

	return resultado, nil
}

// ActualizarMonto actualiza el monto mensual de una propiedad y avanza la
// fecha de actualización al siguiente período.
func (s *AlquilerService) ActualizarMonto(id string, req models.ActualizarMontoRequest) (*models.Propiedad, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("ID inválido")
	}

	// Primero obtenemos la propiedad para calcular la nueva fecha si no se envió
	prop, err := s.GetPropiedadByID(id)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	updates := bson.M{
		"alquiler_mensual": req.NuevoMonto,
		"updated_at":       time.Now(),
		"posponer_hasta":   nil, // limpiar cualquier posponimiento
	}

	// Calcular la nueva fecha de actualización
	if req.NuevaFechaActualizacion != nil {
		updates["fecha_actualizacion"] = *req.NuevaFechaActualizacion
	} else if prop.FechaActualizacion != nil && prop.FrecuenciaActualizacion >= 3 {
		// Avanzar automáticamente al siguiente período
		nuevaFecha := prop.FechaActualizacion.AddDate(0, prop.FrecuenciaActualizacion, 0)
		updates["fecha_actualizacion"] = nuevaFecha
	}

	// Guardar notas en metadata si se enviaron
	if req.Notas != "" {
		updates["metadata.ultima_actualizacion_notas"] = req.Notas
		updates["metadata.ultima_actualizacion_fecha"] = time.Now().Format("02/01/2006")
		updates["metadata.monto_anterior"] = prop.AlquilerMensual
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated models.Propiedad
	err = s.coll.FindOneAndUpdate(ctx,
		bson.M{"_id": objID},
		bson.M{"$set": updates},
		opts,
	).Decode(&updated)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("propiedad no encontrada")
		}
		return nil, err
	}
	return &updated, nil
}

// PosponerActualizacion pospone la notificación de actualización hasta una fecha elegida.
func (s *AlquilerService) PosponerActualizacion(id string, hasta time.Time) (*models.Propiedad, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("ID inválido")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var updated models.Propiedad
	err = s.coll.FindOneAndUpdate(ctx,
		bson.M{"_id": objID},
		bson.M{"$set": bson.M{
			"posponer_hasta": hasta,
			"updated_at":     time.Now(),
		}},
		opts,
	).Decode(&updated)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("propiedad no encontrada")
		}
		return nil, err
	}
	return &updated, nil
}
