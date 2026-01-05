package services

import (
	"caja-fuerte/config"
	"caja-fuerte/utils"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"go.uber.org/zap"
)

type BackupService struct {
	backupDir     string
	retentionDays int
	schedule      string // cron format
	stopChan      chan bool
}

func NewBackupService() *BackupService {
	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "./backups"
	}

	return &BackupService{
		backupDir:     backupDir,
		retentionDays: 30,          // Mantener backups por 30 días
		schedule:      "0 2 * * *", // 2 AM diario
		stopChan:      make(chan bool),
	}
}

// Start inicia el servicio de backups automáticos
func (s *BackupService) Start() error {
	// Crear directorio de backups si no existe
	if err := os.MkdirAll(s.backupDir, 0700); err != nil {
		return fmt.Errorf("error creando directorio de backups: %w", err)
	}

	utils.Logger.Info("🔄 Backup service started",
		zap.String("backup_dir", s.backupDir),
		zap.Int("retention_days", s.retentionDays),
	)

	// Iniciar goroutine para backups programados
	go s.scheduleBackups()

	return nil
}

// Stop detiene el servicio de backups
func (s *BackupService) Stop() {
	close(s.stopChan)
	utils.Logger.Info("🛑 Backup service stopped")
}

// scheduleBackups ejecuta backups según el schedule
func (s *BackupService) scheduleBackups() {
	ticker := time.NewTicker(24 * time.Hour) // Diario
	defer ticker.Stop()

	// Ejecutar backup inmediatamente al iniciar
	s.executeBackup()

	for {
		select {
		case <-ticker.C:
			s.executeBackup()
			s.cleanOldBackups()
		case <-s.stopChan:
			return
		}
	}
}

// executeBackup realiza un backup de la base de datos
func (s *BackupService) executeBackup() {
	cfg := config.AppConfig
	timestamp := time.Now().Format("20060102_150405")
	filename := filepath.Join(s.backupDir, fmt.Sprintf("backup_%s.sql.gz", timestamp))

	utils.Logger.Info("📦 Starting database backup",
		zap.String("filename", filename),
	)

	// mysqldump con compresión gzip
	cmd := exec.Command("bash", "-c",
		fmt.Sprintf(
			"mysqldump -h%s -P%s -u%s -p%s --single-transaction --routines --triggers %s | gzip > %s",
			cfg.DBHost,
			cfg.DBPort,
			cfg.DBUser,
			cfg.DBPassword,
			cfg.DBName,
			filename,
		),
	)

	// No mostrar password en logs
	cmd.Env = append(os.Environ(), "MYSQL_PWD="+cfg.DBPassword)

	output, err := cmd.CombinedOutput()
	if err != nil {
		utils.Logger.Error("❌ Backup failed",
			zap.Error(err),
			zap.String("output", string(output)),
		)
		return
	}

	// Verificar que el archivo se creó
	fileInfo, err := os.Stat(filename)
	if err != nil {
		utils.Logger.Error("❌ Backup file not found", zap.Error(err))
		return
	}

	utils.Logger.Info("✅ Backup completed successfully",
		zap.String("filename", filename),
		zap.Int64("size_mb", fileInfo.Size()/1024/1024),
	)

	// Opcional: Subir a S3/GCS/Azure
	s.uploadToCloud(filename)
}

// cleanOldBackups elimina backups antiguos según retention policy
func (s *BackupService) cleanOldBackups() {
	cutoffDate := time.Now().AddDate(0, 0, -s.retentionDays)

	files, err := filepath.Glob(filepath.Join(s.backupDir, "backup_*.sql.gz"))
	if err != nil {
		utils.Logger.Error("Error listing backups", zap.Error(err))
		return
	}

	for _, file := range files {
		fileInfo, err := os.Stat(file)
		if err != nil {
			continue
		}

		if fileInfo.ModTime().Before(cutoffDate) {
			if err := os.Remove(file); err != nil {
				utils.Logger.Error("Error removing old backup",
					zap.String("file", file),
					zap.Error(err),
				)
			} else {
				utils.Logger.Info("🗑️ Old backup removed",
					zap.String("file", file),
				)
			}
		}
	}
}

// uploadToCloud sube el backup a almacenamiento en la nube (opcional)
func (s *BackupService) uploadToCloud(filename string) {
	// TODO: Implementar según proveedor (AWS S3, GCS, Azure Blob)
	cloudProvider := os.Getenv("CLOUD_BACKUP_PROVIDER") // "s3", "gcs", "azure"

	if cloudProvider == "" {
		return // No hay cloud backup configurado
	}

	utils.Logger.Info("☁️ Uploading backup to cloud",
		zap.String("provider", cloudProvider),
		zap.String("file", filename),
	)

	// Ejemplo para S3 (requiere AWS SDK)
	/*
		if cloudProvider == "s3" {
			bucketName := os.Getenv("S3_BACKUP_BUCKET")
			// Implementar upload a S3
		}
	*/
}

// RestoreFromBackup restaura la BD desde un backup
func (s *BackupService) RestoreFromBackup(backupFile string) error {
	cfg := config.AppConfig

	utils.Logger.Warn("⚠️ Starting database restore",
		zap.String("backup_file", backupFile),
	)

	// Descomprimir y restaurar
	cmd := exec.Command("bash", "-c",
		fmt.Sprintf(
			"gunzip < %s | mysql -h%s -P%s -u%s -p%s %s",
			backupFile,
			cfg.DBHost,
			cfg.DBPort,
			cfg.DBUser,
			cfg.DBPassword,
			cfg.DBName,
		),
	)

	cmd.Env = append(os.Environ(), "MYSQL_PWD="+cfg.DBPassword)

	output, err := cmd.CombinedOutput()
	if err != nil {
		utils.Logger.Error("❌ Restore failed",
			zap.Error(err),
			zap.String("output", string(output)),
		)
		return err
	}

	utils.Logger.Info("✅ Database restored successfully",
		zap.String("backup_file", backupFile),
	)

	return nil
}

// GetAvailableBackups lista los backups disponibles
func (s *BackupService) GetAvailableBackups() ([]BackupInfo, error) {
	files, err := filepath.Glob(filepath.Join(s.backupDir, "backup_*.sql.gz"))
	if err != nil {
		return nil, err
	}

	var backups []BackupInfo
	for _, file := range files {
		fileInfo, err := os.Stat(file)
		if err != nil {
			continue
		}

		backups = append(backups, BackupInfo{
			Filename:  filepath.Base(file),
			Path:      file,
			Size:      fileInfo.Size(),
			CreatedAt: fileInfo.ModTime(),
		})
	}

	return backups, nil
}

type BackupInfo struct {
	Filename  string
	Path      string
	Size      int64
	CreatedAt time.Time
}
