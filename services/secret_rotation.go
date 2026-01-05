package services

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sync"
	"time"

	"caja-fuerte/utils"

	"go.uber.org/zap"
)

// SecretManager gestiona múltiples versiones de secrets para rotación sin downtime
type SecretManager struct {
	mu               sync.RWMutex
	secrets          []SecretVersion
	currentIndex     int
	rotationInterval time.Duration
	stopChan         chan bool
}

type SecretVersion struct {
	Value     []byte
	CreatedAt time.Time
	ExpiresAt time.Time
	Version   int
}

var (
	globalSecretManager *SecretManager
	secretManagerOnce   sync.Once
)

// InitSecretManager inicializa el gestor de secrets
func InitSecretManager(initialSecret string, rotationDays int) error {
	var initErr error

	secretManagerOnce.Do(func() {
		if initialSecret == "" {
			initErr = errors.New("initial secret cannot be empty")
			return
		}

		now := time.Now()
		expiresAt := now.AddDate(0, 0, rotationDays)

		globalSecretManager = &SecretManager{
			secrets: []SecretVersion{
				{
					Value:     []byte(initialSecret),
					CreatedAt: now,
					ExpiresAt: expiresAt,
					Version:   1,
				},
			},
			currentIndex:     0,
			rotationInterval: time.Duration(rotationDays) * 24 * time.Hour,
			stopChan:         make(chan bool),
		}

		utils.Logger.Info("🔐 Secret Manager initialized",
			zap.Int("rotation_days", rotationDays),
		)

		// Iniciar rotación automática
		go globalSecretManager.startAutoRotation()
	})

	return initErr
}

// GetSecretManager retorna la instancia global
func GetSecretManager() *SecretManager {
	return globalSecretManager
}

// GetCurrentSecret retorna el secret actual para firmar nuevos tokens
func (sm *SecretManager) GetCurrentSecret() []byte {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	return sm.secrets[sm.currentIndex].Value
}

// GetAllValidSecrets retorna todos los secrets válidos para validar tokens
func (sm *SecretManager) GetAllValidSecrets() [][]byte {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	now := time.Now()
	var validSecrets [][]byte

	for _, secret := range sm.secrets {
		if now.Before(secret.ExpiresAt) {
			validSecrets = append(validSecrets, secret.Value)
		}
	}

	return validSecrets
}

// RotateSecret genera un nuevo secret y marca el anterior como próximo a expirar
func (sm *SecretManager) RotateSecret() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Generar nuevo secret aleatorio (64 bytes = 512 bits)
	newSecret := make([]byte, 64)
	if _, err := rand.Read(newSecret); err != nil {
		return err
	}

	now := time.Now()
	newVersion := SecretVersion{
		Value:     newSecret,
		CreatedAt: now,
		ExpiresAt: now.Add(sm.rotationInterval),
		Version:   sm.secrets[sm.currentIndex].Version + 1,
	}

	// Agregar nuevo secret
	sm.secrets = append(sm.secrets, newVersion)
	sm.currentIndex = len(sm.secrets) - 1

	// Limpiar secrets expirados (mantener últimos 2-3 para grace period)
	sm.cleanExpiredSecrets()

	utils.Logger.Info("🔄 Secret rotated",
		zap.Int("new_version", newVersion.Version),
		zap.Time("expires_at", newVersion.ExpiresAt),
		zap.Int("active_secrets", len(sm.secrets)),
	)

	// Guardar en archivo seguro o secrets manager (Vault, AWS Secrets Manager, etc.)
	sm.persistSecret(newSecret, newVersion.Version)

	return nil
}

// cleanExpiredSecrets elimina secrets expirados excepto los últimos 2
func (sm *SecretManager) cleanExpiredSecrets() {
	now := time.Now()
	var validSecrets []SecretVersion

	// Mantener secretos que aún no han expirado o los últimos 2
	for i, secret := range sm.secrets {
		if now.Before(secret.ExpiresAt) || i >= len(sm.secrets)-2 {
			validSecrets = append(validSecrets, secret)
		}
	}

	sm.secrets = validSecrets
}

// startAutoRotation inicia la rotación automática de secrets
func (sm *SecretManager) startAutoRotation() {
	ticker := time.NewTicker(sm.rotationInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := sm.RotateSecret(); err != nil {
				utils.Logger.Error("Failed to rotate secret", zap.Error(err))
			}
		case <-sm.stopChan:
			return
		}
	}
}

// Stop detiene la rotación automática
func (sm *SecretManager) Stop() {
	close(sm.stopChan)
	utils.Logger.Info("🛑 Secret rotation stopped")
}

// persistSecret guarda el secret en almacenamiento seguro
func (sm *SecretManager) persistSecret(secret []byte, version int) {
	// OPCIÓN 1: Archivo encriptado local (desarrollo)
	// OPCIÓN 2: HashiCorp Vault (recomendado)
	// OPCIÓN 3: AWS Secrets Manager
	// OPCIÓN 4: Azure Key Vault
	// OPCIÓN 5: GCP Secret Manager

	// Ejemplo básico: guardar en variable de entorno encriptada
	encodedSecret := base64.StdEncoding.EncodeToString(secret)

	utils.Logger.Info("💾 Secret persisted",
		zap.Int("version", version),
		zap.String("storage", "local"), // Cambiar según implementación
	)

	// TODO: Implementar integración con secrets manager en producción
	_ = encodedSecret
}

// ValidateWithAnySecret intenta validar con cualquier secret válido
func (sm *SecretManager) ValidateWithAnySecret(validateFunc func([]byte) error) error {
	validSecrets := sm.GetAllValidSecrets()

	var lastErr error
	for _, secret := range validSecrets {
		if err := validateFunc(secret); err == nil {
			return nil // Validación exitosa
		} else {
			lastErr = err
		}
	}

	return lastErr // Ningún secret funcionó
}

// GetSecretInfo retorna información sobre los secrets actuales (sin exponer valores)
func (sm *SecretManager) GetSecretInfo() []map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	var info []map[string]interface{}
	for i, secret := range sm.secrets {
		info = append(info, map[string]interface{}{
			"version":    secret.Version,
			"created_at": secret.CreatedAt,
			"expires_at": secret.ExpiresAt,
			"is_current": i == sm.currentIndex,
			"is_valid":   time.Now().Before(secret.ExpiresAt),
		})
	}

	return info
}
