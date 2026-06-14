package router

import (
	"os"
	"time"

	"github.com/clairencelie/audit-dashboard/backend/internal/ai"
	"github.com/clairencelie/audit-dashboard/backend/internal/approvals"
	"github.com/clairencelie/audit-dashboard/backend/internal/documents"
	"github.com/clairencelie/audit-dashboard/backend/internal/auth"
	"github.com/clairencelie/audit-dashboard/backend/internal/auditprograms"
	"github.com/clairencelie/audit-dashboard/backend/internal/auditprojects"
	"github.com/clairencelie/audit-dashboard/backend/internal/checklists"
	"github.com/clairencelie/audit-dashboard/backend/internal/dashboard"
	"github.com/clairencelie/audit-dashboard/backend/internal/middleware"
	"github.com/clairencelie/audit-dashboard/backend/internal/users"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup() *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{getEnv("FRONTEND_URL", "http://localhost:5173")},
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
	}

	return r
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
