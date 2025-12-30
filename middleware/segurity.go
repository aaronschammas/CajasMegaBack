package middleware

import (
	"caja-fuerte/config"
	"caja-fuerte/utils"
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	mgin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
	csrf "github.com/utrack/gin-csrf"
	"go.uber.org/zap"
)

// RateLimitMiddleware implementa rate limiting global
func RateLimitMiddleware() gin.HandlerFunc {
	// 100 requests por minuto por IP
	rate := limiter.Rate{
		Period: 1 * time.Minute,
		Limit:  100,
	}

	store := memory.NewStore()
	instance := limiter.New(store, rate)

	middleware := mgin.NewMiddleware(instance)

	return func(c *gin.Context) {
		middleware(c)
	}
}

// LoginRateLimitMiddleware implementa rate limiting específico para login
func LoginRateLimitMiddleware() gin.HandlerFunc {
	// 5 intentos por minuto por IP
	rate := limiter.Rate{
		Period: 1 * time.Minute,
		Limit:  5,
	}

	store := memory.NewStore()
	instance := limiter.New(store, rate)

	middleware := mgin.NewMiddleware(instance)

	return func(c *gin.Context) {
		middleware(c)

		// Si excede el límite
		if c.IsAborted() {
			utils.LogSecurityEvent("rate_limit_exceeded", map[string]interface{}{
				"ip":   c.ClientIP(),
				"path": c.Request.URL.Path,
			})

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Demasiados intentos de login. Intenta en 1 minuto.",
			})
		}
	}
}

// CSRFMiddleware implementa protección contra CSRF
func CSRFMiddleware(secret string) gin.HandlerFunc {
	return csrf.Middleware(csrf.Options{
		Secret: secret,
		ErrorFunc: func(c *gin.Context) {
			utils.LogSecurityEvent("csrf_token_invalid", map[string]interface{}{
				"ip":   c.ClientIP(),
				"path": c.Request.URL.Path,
			})

			c.JSON(http.StatusForbidden, gin.H{
				"error": "Token CSRF inválido o ausente",
			})
			c.Abort()
		},
	})
}

// SecurityHeadersMiddleware añade headers de seguridad
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevenir ataques XSS
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")

		// Política de seguridad de contenido
		csp := "default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; " +
			"style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
			"font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
			"img-src 'self' data:; " +
			"connect-src 'self'"

		c.Writer.Header().Set("Content-Security-Policy", csp)

		// Política de referrer
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// HSTS (solo en producción)
		if config.AppConfig.IsProduction() {
			c.Writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		// Deshabilitar cache para rutas sensibles
		if isSensitivePath(c.Request.URL.Path) {
			c.Writer.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
			c.Writer.Header().Set("Pragma", "no-cache")
			c.Writer.Header().Set("Expires", "0")
		}

		c.Next()
	}
}

// ForceHTTPS redirige HTTP a HTTPS en producción
func ForceHTTPS() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !config.AppConfig.IsProduction() {
			c.Next()
			return
		}

		// Verificar si la petición viene por HTTPS
		scheme := c.Request.Header.Get("X-Forwarded-Proto")
		if scheme == "" {
			scheme = c.Request.URL.Scheme
		}

		if scheme == "http" {
			target := "https://" + c.Request.Host + c.Request.URL.Path
			if len(c.Request.URL.RawQuery) > 0 {
				target += "?" + c.Request.URL.RawQuery
			}

			utils.Logger.Info("HTTP request redirected to HTTPS",
				zap.String("original_url", c.Request.URL.String()),
				zap.String("target_url", target),
			)

			c.Redirect(http.StatusPermanentRedirect, target)
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequestLoggerMiddleware registra todos los requests de forma segura
func RequestLoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method
		ip := c.ClientIP()

		// Procesar request
		c.Next()

		// Calcular duración
		duration := time.Since(start).Milliseconds()
		statusCode := c.Writer.Status()

		// Loggear (sin datos sensibles)
		utils.LogAPIAccess(method, path, ip, statusCode, duration)

		// Loggear errores adicionales si existen
		if len(c.Errors) > 0 {
			for _, e := range c.Errors {
				utils.Logger.Error("Request error",
					zap.String("method", method),
					zap.String("path", path),
					zap.String("error", e.Error()),
				)
			}
		}
	}
}

// RequestSizeLimitMiddleware limita el tamaño de los requests (previene DoS)
func RequestSizeLimitMiddleware(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSize)
		c.Next()
	}
}

// IPWhitelistMiddleware permite solo IPs específicas (para rutas administrativas)
func IPWhitelistMiddleware(allowedIPs []string) gin.HandlerFunc {
	allowedIPMap := make(map[string]bool)
	for _, ip := range allowedIPs {
		allowedIPMap[ip] = true
	}

	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		if !allowedIPMap[clientIP] {
			utils.LogSecurityEvent("unauthorized_ip_access", map[string]interface{}{
				"ip":   clientIP,
				"path": c.Request.URL.Path,
			})

			c.JSON(http.StatusForbidden, gin.H{
				"error": "Acceso denegado desde esta IP",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// isSensitivePath determina si una ruta es sensible (no debe cachearse)
func isSensitivePath(path string) bool {
	sensitivePaths := []string{
		"/api/login",
		"/api/me",
		"/arco/",
		"/movimientos",
		"/ingresos",
		"/egresos",
		"/api/arco-estado",
		"/api/saldo-ultimo-arco",
	}

	for _, sp := range sensitivePaths {
		if len(path) >= len(sp) && path[:len(sp)] == sp {
			return true
		}
	}

	return false
}

// TimeoutMiddleware añade timeout a los requests
func TimeoutMiddleware(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Crear context con timeout
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()

		// Reemplazar el context del request
		c.Request = c.Request.WithContext(ctx)

		// Canal para saber si el request terminó
		done := make(chan struct{})

		go func() {
			c.Next()
			close(done)
		}()

		select {
		case <-done:
			// Request completado a tiempo
			return
		case <-ctx.Done():
			// Timeout excedido
			utils.Logger.Warn("Request timeout exceeded",
				zap.String("path", c.Request.URL.Path),
				zap.Duration("timeout", timeout),
			)

			c.JSON(http.StatusRequestTimeout, gin.H{
				"error": "Request timeout",
			})
			c.Abort()
		}
	}
}
