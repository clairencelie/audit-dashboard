package router

import (
	"os"
	"strings"
	"time"

	"github.com/clairencelie/audit-dashboard/backend/internal/ai"
	"github.com/clairencelie/audit-dashboard/backend/internal/approvals"
	"github.com/clairencelie/audit-dashboard/backend/internal/auth"
	"github.com/clairencelie/audit-dashboard/backend/internal/auditprograms"
	"github.com/clairencelie/audit-dashboard/backend/internal/auditprojects"
	"github.com/clairencelie/audit-dashboard/backend/internal/checklists"
	"github.com/clairencelie/audit-dashboard/backend/internal/dailyeffort"
	"github.com/clairencelie/audit-dashboard/backend/internal/dashboard"
	"github.com/clairencelie/audit-dashboard/backend/internal/datarequests"
	"github.com/clairencelie/audit-dashboard/backend/internal/documents"
	"github.com/clairencelie/audit-dashboard/backend/internal/middleware"
	"github.com/clairencelie/audit-dashboard/backend/internal/users"
	"github.com/clairencelie/audit-dashboard/backend/internal/referencedocs"
	"github.com/clairencelie/audit-dashboard/backend/internal/workingpapers"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup() *gin.Engine {
	r := gin.Default()

	frontendURLs := strings.Split(getEnv("FRONTEND_URL", "http://localhost:5173"), ",")
	for i := range frontendURLs {
		frontendURLs[i] = strings.TrimSpace(frontendURLs[i])
	}

	r.Use(cors.New(cors.Config{
		AllowOrigins:     frontendURLs,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api/v1")

	// Health check
	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Auth
	authGroup := api.Group("/auth")
	{
		authGroup.POST("/login", auth.Login)
		authGroup.POST("/refresh", auth.Refresh)
		authGroup.POST("/logout", middleware.AuthRequired(), auth.Logout)
		authGroup.GET("/me", middleware.AuthRequired(), auth.Me)
	}

	// Protected routes
	protected := api.Group("", middleware.AuthRequired())
	{
		// Users & Master Data
		protected.GET("/users", middleware.RequireRoles("admin", "div_head", "dept_head", "spv"), users.ListUsers)
		protected.POST("/users", middleware.RequireRoles("admin"), users.CreateUser)
		protected.GET("/users/:id", users.GetUser)
		protected.PUT("/users/:id", middleware.RequireRoles("admin"), users.UpdateUser)

		protected.GET("/roles", users.ListRoles)
		protected.GET("/departments", users.ListDepartments)
		protected.POST("/departments", middleware.RequireRoles("admin"), users.CreateDepartment)

		protected.GET("/auditees", users.ListAuditees)
		protected.POST("/auditees", middleware.RequireRoles("admin", "div_head", "dept_head", "spv"), users.CreateAuditee)
		protected.PUT("/auditees/:id", middleware.RequireRoles("admin", "div_head", "dept_head", "spv"), users.UpdateAuditee)

		// Audit Projects
		protected.GET("/audit-projects", auditprojects.ListProjects)
		protected.POST("/audit-projects", middleware.RequireRoles("admin", "div_head", "dept_head", "spv"), auditprojects.CreateProject)
		protected.GET("/audit-projects/:id", auditprojects.GetProject)
		protected.PUT("/audit-projects/:id", middleware.RequireRoles("admin", "div_head", "dept_head", "spv"), auditprojects.UpdateProject)
		protected.GET("/audit-projects/:id/dashboard", auditprojects.GetProjectDashboard)

		// Audit Programs — nested under /projects/:id/audit-program
		protected.GET("/projects/:id/audit-program", auditprograms.GetByProject)
		protected.POST("/projects/:id/audit-program", middleware.RequireRoles("auditor"), auditprograms.Create)
		protected.GET("/audit-programs/:id", auditprograms.Get)
		protected.PUT("/audit-programs/:id", middleware.RequireRoles("auditor"), auditprograms.Update)
		protected.POST("/audit-programs/:id/submit", middleware.RequireRoles("auditor"), auditprograms.Submit)
		protected.POST("/audit-programs/:id/approve", middleware.RequireRoles("spv", "dept_head", "div_head"), auditprograms.Approve)
		protected.POST("/audit-programs/:id/reject", middleware.RequireRoles("spv", "dept_head", "div_head"), auditprograms.Reject)

		// Checklists
		protected.GET("/audit-programs/:id/checklists", checklists.ListByProgram)
		protected.POST("/audit-programs/:id/checklists", middleware.RequireRoles("auditor"), checklists.Create)
		protected.PUT("/checklists/:id", middleware.RequireRoles("auditor"), checklists.Update)
		protected.DELETE("/checklists/:id", middleware.RequireRoles("auditor"), checklists.Delete)

		// Checklist Executions
		protected.GET("/projects/:id/checklist-executions", checklists.ListExecutions)
		protected.PUT("/checklist-executions/:id", checklists.UpdateExecution)

		// Approvals
		protected.GET("/approvals/pending", approvals.ListPending)
		protected.GET("/approvals", approvals.ListByEntity)

		// Dashboard
		protected.GET("/dashboard/auditor", middleware.RequireRoles("auditor", "admin"), dashboard.Auditor)
		protected.GET("/dashboard/spv", middleware.RequireRoles("spv", "admin"), dashboard.SPV)
		protected.GET("/dashboard/dept-head", middleware.RequireRoles("dept_head", "admin"), dashboard.DeptHead)
		protected.GET("/dashboard/div-head", middleware.RequireRoles("div_head", "admin"), dashboard.DivHead)

		// AI Assistance
		protected.POST("/ai/generate-audit-program", middleware.RequireRoles("auditor"), ai.GenerateAuditProgram)

		// Audit Documents (STP & SPA)
		protected.POST("/audit-projects/:id/documents/issue", middleware.RequireRoles("auditor"), documents.IssueDocuments)
		protected.GET("/audit-projects/:id/documents", documents.ListDocuments)

		// Daily Effort
		protected.GET("/projects/:id/daily-efforts", dailyeffort.List)
		protected.POST("/projects/:id/daily-efforts", middleware.RequireRoles("auditor", "admin"), dailyeffort.Create)
		protected.PUT("/daily-efforts/:id", middleware.RequireRoles("auditor", "admin"), dailyeffort.Update)
		protected.DELETE("/daily-efforts/:id", middleware.RequireRoles("auditor", "admin"), dailyeffort.Delete)

		// Working Papers
		protected.GET("/projects/:id/working-papers", workingpapers.List)
		protected.POST("/projects/:id/working-papers", middleware.RequireRoles("auditor", "admin"), workingpapers.Upload)
		protected.DELETE("/working-papers/:id", middleware.RequireRoles("auditor", "admin"), workingpapers.Delete)

		// Reference Documents
		protected.GET("/projects/:id/reference-docs", referencedocs.List)
		protected.POST("/projects/:id/reference-docs", middleware.RequireRoles("auditor", "admin"), referencedocs.Upload)
		protected.DELETE("/reference-docs/:id", middleware.RequireRoles("auditor", "admin"), referencedocs.Delete)

		// Data Requests
		protected.GET("/projects/:id/data-requests", datarequests.List)
		protected.POST("/projects/:id/data-requests", middleware.RequireRoles("auditor", "admin"), datarequests.Create)
		protected.PUT("/data-requests/:id", datarequests.Update)
		protected.DELETE("/data-requests/:id", middleware.RequireRoles("auditor", "admin"), datarequests.Delete)
	}

	// Serve uploaded files
	r.Static("/api/v1/uploads", "/app/uploads")

	return r
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
