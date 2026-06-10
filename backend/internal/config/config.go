package config

import (
	"os"
)

type Config struct {
	AppEnv              string
	AppPort             string
	DatabaseURL         string
	JWTSecret           string
	RefreshTokenSecret  string
	FrontendURL         string
	GeminiAPIKey        string
}

func Load() *Config {
	return &Config{
		AppEnv:             getEnv("APP_ENV", "development"),
		AppPort:            getEnv("APP_PORT", "8080"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://audit_user:audit_pass@localhost:5432/audit_db?sslmode=disable"),
		JWTSecret:          getEnv("JWT_SECRET", "secret"),
		RefreshTokenSecret: getEnv("REFRESH_TOKEN_SECRET", "refresh-secret"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:5173"),
		GeminiAPIKey:       getEnv("GEMINI_API_KEY", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
