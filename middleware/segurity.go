package middleware

import (
	"caja-fuerte/utils"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	mgin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
	csrf "github.com/utrack/gin-csrf"
)

// LoginRateLimitMiddleware implementa rate limiting específico para login (5 intentos/minuto por IP)
func LoginRateLimitMiddleware() gin.HandlerFunc {
	rate := limiter.Rate{
		Period: 1 * time.Minute,
		Limit:  5,
	}

	store := memory.NewStore()
	instance := limiter.New(store, rate)
	middleware := mgin.NewMiddleware(instance)

	return func(c *gin.Context) {
		middleware(c)

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
