package main

import (
	"log"
	"os"

	"github.com/clairencelie/audit-dashboard/backend/internal/config"
	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/internal/drive"
	"github.com/clairencelie/audit-dashboard/backend/internal/router"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := config.Load()

	database.Connect(cfg.DatabaseURL)
	database.Migrate()

	if err := drive.Init(); err != nil {
		log.Printf("Warning: Google Drive integration disabled: %v", err)
	} else {
		log.Println("Google Drive integration enabled")
	}

	if os.Getenv("APP_ENV") == "development" || os.Getenv("SEED_DB") == "true" {
		database.Seed()
	}

	r := router.Setup()

	log.Printf("Starting server on port %s", cfg.AppPort)
	if err := r.Run(":" + cfg.AppPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
