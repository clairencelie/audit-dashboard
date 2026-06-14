package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(dsn string) {
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	log.Println("Database connected successfully")
}

func Migrate() {
	err := DB.AutoMigrate(
		&Role{},
		&Department{},
		&User{},
		&Auditee{},
		&AnnualAuditPlan{},
		&AuditProject{},
		&AuditProgram{},
		&AuditChecklist{},
		&ChecklistExecution{},
		&ApprovalRequest{},
		&ApprovalHistory{},
		&Notification{},
		&AuditTrail{},
		&AILog{},
		&AuditDocument{},
	)
	if err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	log.Println("Database migrated successfully")
}
