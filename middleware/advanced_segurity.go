package middleware

import (
	"caja-fuerte/config"
	"caja-fuerte/utils"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	"github.com/ulule/limiter/v3/drivers/store/memory"
	"go.uber.org/zap"
)

// RateLimitConfig configura límites personalizados por endpoint
type RateLimitConfig struct {
	Requests int
	Window   time.Duration
}

var (
	// Límites por tipo de endpoint
	endpointLimits = map[string]RateLimitConfig{
		"login":       {Requests: 5, Window: 1 * time.Minute},   // 5 intentos por minuto
		"register":    {Requests: 3, Window: 1 * time.Hour},     // 3 registros por hora
		"api_general": {Requests: 100, Window: 1 * time.Minute}, // 100 req/min API general
		"api_admin":   {Requests: 50, Window: 1 * time.Minute},  // 50 req/min admin
		"api_reports": {Requests: 20, Window: 1 * time.Minute},  // 20 req/min reportes
		"file_upload": {Requests: 10, Window: 1 * time.Minute},  // 10 uploads/min
	}

	limiters     = make(map[string]*limiter.Limiter)
	limitersLock sync.RWMutex
)

// InitRateLimiters inicializa los rate limiters para cada endpoint
func InitRateLimiters() {
	limitersLock.Lock()
	defer limitersLock.Unlock()

	store := memory.NewStore()

	for name, cfg := range endpointLimits {
		rate := limiter.Rate{
			Period: cfg.Window,
			Limit:  int64(cfg.Requests),
		}
		limiters[name] = limiter.New(store, rate)
	}

	utils.Logger.Info("🚦 Rate limiters initialized",
		zap.Int("total_limiters", len(limiters)),
	)
}

// RateLimitByEndpoint aplica rate limiting según el tipo de endpoint
func RateLimitByEndpoint(endpointType string) gin.HandlerFunc {
	limitersLock.RLock()
	lim, exists := limiters[endpointType]
	limitersLock.RUnlock()

	if !exists {
		// Fallback a límite general
		lim = limiters["api_general"]
	}

	return func(c *gin.Context) {
		ctx := c.Request.Context()
		ip := c.ClientIP()

		// Aplicar límite
		context, err := lim.Get(ctx, ip)
		if err != nil {
			utils.Logger.Error("Rate limiter error", zap.Error(err))
			c.Next()
			return
		}

		// Headers informativos
		c.Header("X-RateLimit-Limit", string(rune(context.Limit)))
		c.Header("X-RateLimit-Remaining", string(rune(context.Remaining)))
		c.Header("X-RateLimit-Reset", string(rune(context.Reset)))

		if context.Reached {
			utils.LogSecurityEvent("rate_limit_exceeded", map[string]interface{}{
				"ip":       ip,
				"endpoint": endpointType,
				"path":     c.Request.URL.Path,
			})

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Límite de peticiones excedido. Intenta más tarde.",
				"retry_after": context.Reset,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// SmartCORSMiddleware con whitelist dinámica y validación estricta
func SmartCORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	allowedOrigins := make(map[string]bool)
	for _, origin := range cfg.AllowedOrigins {
		allowedOrigins[origin] = true
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Si no hay Origin header, permitir (same-origin)
		if origin == "" {
			c.Next()
			return
		}

		// Validar si el origin está permitido
		if !allowedOrigins[origin] && !allowedOrigins["*"] {
			utils.LogSecurityEvent("cors_origin_rejected", map[string]interface{}{
				"origin": origin,
				"ip":     c.ClientIP(),
				"path":   c.Request.URL.Path,
			})

			c.JSON(http.StatusForbidden, gin.H{
				"error": "Origin no autorizado",
			})
			c.Abort()
			return
		}

		// Configurar headers CORS
		if allowedOrigins["*"] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Max-Age", "3600")

		// Manejar preflight requests
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// IPWhitelistDynamic permite whitelist dinámica con cache
type IPWhitelistManager struct {
	mu          sync.RWMutex
	allowedIPs  map[string]bool
	lastUpdated time.Time
	updateFunc  func() ([]string, error) // Función para obtener IPs desde BD/config
}

var ipWhitelistManager *IPWhitelistManager

// InitIPWhitelist inicializa la whitelist dinámica
func InitIPWhitelist(updateFunc func() ([]string, error)) {
	ipWhitelistManager = &IPWhitelistManager{
		allowedIPs:  make(map[string]bool),
		updateFunc:  updateFunc,
		lastUpdated: time.Now(),
	}

	// Actualizar IPs
	ipWhitelistManager.Refresh()

	// Actualizar cada 5 minutos
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			ipWhitelistManager.Refresh()
		}
	}()
}

// Refresh actualiza la lista de IPs permitidas
func (m *IPWhitelistManager) Refresh() error {
	ips, err := m.updateFunc()
	if err != nil {
		utils.Logger.Error("Failed to update IP whitelist", zap.Error(err))
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.allowedIPs = make(map[string]bool)
	for _, ip := range ips {
		m.allowedIPs[ip] = true
	}
	m.lastUpdated = time.Now()

	utils.Logger.Info("✅ IP whitelist updated",
		zap.Int("total_ips", len(m.allowedIPs)),
	)

	return nil
}

// IsAllowed verifica si una IP está permitida
func (m *IPWhitelistManager) IsAllowed(ip string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.allowedIPs[ip]
}

// DynamicIPWhitelistMiddleware middleware con whitelist dinámica
func DynamicIPWhitelistMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		if ipWhitelistManager == nil || ipWhitelistManager.IsAllowed(clientIP) {
			c.Next()
			return
		}

		utils.LogSecurityEvent("ip_blocked", map[string]interface{}{
			"ip":   clientIP,
			"path": c.Request.URL.Path,
		})

		c.JSON(http.StatusForbidden, gin.H{
			"error": "Acceso denegado desde esta IP",
		})
		c.Abort()
	}
}

// GetRateLimitStats retorna estadísticas de rate limiting
func GetRateLimitStats() map[string]interface{} {
	stats := make(map[string]interface{})

	limitersLock.RLock()
	defer limitersLock.RUnlock()

	for name, cfg := range endpointLimits {
		stats[name] = map[string]interface{}{
			"requests":       cfg.Requests,
			"window_seconds": cfg.Window.Seconds(),
		}
	}

	return stats
}
