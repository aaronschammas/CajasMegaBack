package main

import (
	"caja-fuerte/config"
	"caja-fuerte/database"
	"caja-fuerte/routes"
	"caja-fuerte/services"
	"caja-fuerte/utils"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"
)

func main() {
	// Banner de inicio
	printBanner()

	// 1. Cargar configuración
	cfg := config.LoadConfig()
	log.Printf("Iniciando %s en modo %s", cfg.AppName, cfg.Environment)

	// 2. Inicializar logger estructurado
	if err := utils.InitLogger(cfg.Environment); err != nil {
		log.Fatal("Error inicializando logger:", err)
	}
	defer utils.Close()

	utils.Logger.Info("Logger inicializado correctamente",
		zap.String("environment", cfg.Environment),
		zap.String("log_level", cfg.LogLevel),
	)

	// 3. Inicializar servicio de autenticación
	if err := services.InitAuthService(); err != nil {
		utils.Logger.Fatal("Error inicializando AuthService", zap.Error(err))
	}
	utils.Logger.Info("AuthService inicializado correctamente")

	// 4. Inicializar base de datos
	database.InitDB()
	utils.Logger.Info("Base de datos inicializada correctamente")

	// 5. Configurar rutas con todos los middlewares de seguridad
	router := routes.SetupRoutes(cfg)

	// 6. Crear servidor HTTP con configuración segura
	server := &http.Server{
		Addr:           fmt.Sprintf(":%s", cfg.AppPort),
		Handler:        router,
		ReadTimeout:    15 * time.Second,
		WriteTimeout:   15 * time.Second,
		IdleTimeout:    60 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1 MB
	}

	// 7. Canal para manejar errores del servidor
	serverErrors := make(chan error, 1)

	// 8. Iniciar servidor en goroutine
	go func() {
		utils.Logger.Info("🌐 Servidor iniciado",
			zap.String("url", fmt.Sprintf("http://localhost:%s", cfg.AppPort)),
			zap.String("environment", cfg.Environment),
		)

		// Warnings de seguridad para producción
		if cfg.IsProduction() {
			utils.Logger.Warn("⚠️  Modo PRODUCCIÓN activado - Verificando configuración de seguridad...")

			checkList := []struct {
				check   bool
				message string
			}{
				{len(cfg.JWTSecret) >= 64, " JWT_SECRET tiene longitud adecuada (≥64)"},
				{cfg.EnableCSRF, "CSRF Protection habilitado"},
				{cfg.EnableRateLimit, " Rate Limiting habilitado"},
				{cfg.AllowedOrigins[0] != "*", "CORS configurado con orígenes específicos"},
				{cfg.DBUser != "root", "Usuario de BD no es root"},
			}

			for _, item := range checkList {
				if item.check {
					utils.Logger.Info(item.message)
				} else {
					utils.Logger.Warn("❌ " + item.message + " - FALLÓ")
				}
			}

			utils.Logger.Info("📋 Recordatorios de seguridad:")
			utils.Logger.Info("   - HTTPS gestionado por reverse proxy (Nginx)")
			utils.Logger.Info("   - Configurar firewall")
			utils.Logger.Info("   - Tener backups automáticos de BD")
			utils.Logger.Info("   - Monitorear logs y métricas")
			utils.Logger.Info("   - Rotar JWT_SECRET periódicamente")

			// ✅ PRODUCCIÓN: HTTP interno (TLS lo maneja Nginx)
			serverErrors <- server.ListenAndServe()
		} else {
			utils.Logger.Info("⚠️  Modo DESARROLLO - HTTP sin cifrado")
			serverErrors <- server.ListenAndServe()
		}
	}()

	// 9. Canal para señales del sistema operativo
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	// 10. Esperar señal de apagado o error del servidor
	select {
	case err := <-serverErrors:
		utils.Logger.Fatal("Error del servidor", zap.Error(err))

	case sig := <-shutdown:
		utils.Logger.Info("🛑 Señal de apagado recibida",
			zap.String("signal", sig.String()),
		)

		// Dar tiempo para que las conexiones actuales terminen (graceful shutdown)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		utils.Logger.Info("⏳ Cerrando conexiones activas...")

		if err := server.Shutdown(ctx); err != nil {
			utils.Logger.Warn("⚠️  Error durante el apagado graceful",
				zap.Error(err),
			)

			// Forzar cierre si el graceful shutdown falla
			if err := server.Close(); err != nil {
				utils.Logger.Fatal("❌ Error al forzar el cierre del servidor",
					zap.Error(err),
				)
			}
		}

		utils.Logger.Info("✅ Servidor detenido correctamente")
	}
}

func printBanner() {
	banner := `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██████╗ █████╗      ██╗ █████╗     ███████╗██╗   ██╗  ║
║  ██╔════╝██╔══██╗     ██║██╔══██╗    ██╔════╝╚██╗ ██╔╝  ║
║  ██║     ███████║     ██║███████║    █████╗   ╚████╔╝   ║
║  ██║     ██╔══██║██   ██║██╔══██║    ██╔══╝    ╚██╔╝    ║
║  ╚██████╗██║  ██║╚█████╔╝██║  ██║    ██║        ██║     ║
║   ╚═════╝╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝    ╚═╝        ╚═╝     ║
║                                                           ║
║            SISTEMA DE GESTIÓN DE CAJA FUERTE             ║
║                    Versión 2.0.1 - Secure                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`
	fmt.Println(banner)
}
