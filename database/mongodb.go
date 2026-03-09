package database

import (
	"caja-fuerte/utils"
	"context"
	"fmt"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

var MongoDB *mongo.Database
var MongoClient *mongo.Client

const CollectionPropiedades = "propiedades"

// InitMongoDB inicializa la conexión a MongoDB
func InitMongoDB() {
	uri := os.Getenv("MONGODB_URI")
	if uri == "" {
		uri = "mongodb://localhost:27017"
	}

	dbName := os.Getenv("MONGODB_DB")
	if dbName == "" {
		dbName = "megacajas_alquileres"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOpts := options.Client().
		ApplyURI(uri).
		SetConnectTimeout(10 * time.Second).
		SetServerSelectionTimeout(10 * time.Second)

	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		utils.Logger.Fatal("Error al conectar con MongoDB", zap.Error(err))
	}

	if err := client.Ping(ctx, nil); err != nil {
		utils.Logger.Fatal("Error al hacer ping a MongoDB", zap.Error(err))
	}

	MongoClient = client
	MongoDB = client.Database(dbName)

	utils.Logger.Info("MongoDB conectado correctamente",
		zap.String("uri", uri),
		zap.String("database", dbName),
	)

	createMongoIndexes()

	fmt.Println("MongoDB inicializado correctamente")
}

// createMongoIndexes crea los índices necesarios para búsquedas eficientes
func createMongoIndexes() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	coll := MongoDB.Collection(CollectionPropiedades)

	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "direccion", Value: "text"}, {Key: "inquilino", Value: "text"}},
			Options: options.Index().SetName("idx_busqueda_texto"),
		},
		{
			Keys:    bson.D{{Key: "ocupada", Value: 1}},
			Options: options.Index().SetName("idx_ocupada"),
		},
		{
			Keys:    bson.D{{Key: "anio", Value: 1}},
			Options: options.Index().SetName("idx_anio"),
		},
		{
			Keys:    bson.D{{Key: "created_by", Value: 1}},
			Options: options.Index().SetName("idx_created_by"),
		},
	}

	_, err := coll.Indexes().CreateMany(ctx, indexes)
	if err != nil {
		utils.Logger.Warn("Error al crear índices de MongoDB (pueden ya existir)", zap.Error(err))
	} else {
		utils.Logger.Info("Índices de MongoDB creados/verificados")
	}
}

// CloseMongoDB cierra la conexión a MongoDB de forma segura
func CloseMongoDB() {
	if MongoClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := MongoClient.Disconnect(ctx); err != nil {
			utils.Logger.Warn("Error al cerrar conexión MongoDB", zap.Error(err))
		} else {
			utils.Logger.Info("Conexión MongoDB cerrada correctamente")
		}
	}
}

// HealthCheckMongo verifica el estado de la conexión a MongoDB
func HealthCheckMongo() error {
	if MongoClient == nil {
		return fmt.Errorf("MongoDB no inicializado")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return MongoClient.Ping(ctx, nil)
}
