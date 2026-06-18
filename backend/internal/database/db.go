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
		&DailyEffort{},
		&ReferenceDocument{},
		&WorkingPaper{},
		&DataRequest{},
		&Finding{},
		&FindingAttachment{},
	)
	if err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	dropStaleColumns()

	log.Println("Database migrated successfully")
}

// dropStaleColumns removes columns left behind by earlier iterations of the
// Finding model (GORM AutoMigrate adds new columns but never drops old ones).
func dropStaleColumns() {
	staleFindingColumns := []string{
		"title",
		"cause_text",
		"impact_text",
		"recommendation_text",
		"auditee_response",
		"auditor_conclusion",
		"finding_classification",
	}
	for _, col := range staleFindingColumns {
		if err := DB.Exec(`ALTER TABLE findings DROP COLUMN IF EXISTS "` + col + `"`).Error; err != nil {
			log.Printf("warning: failed to drop stale column findings.%s: %v", col, err)
		}
	}
}
