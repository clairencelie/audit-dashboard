package auditprojects

import (
	"strconv"
	"time"

	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createProjectRequest struct {
	AnnualAuditPlanID string `json:"annual_audit_plan_id"`
	Title             string `json:"title" binding:"required"`
	AuditTheme        string `json:"audit_theme"`
	AuditeeID         string `json:"auditee_id" binding:"required"`
	AuditorID         string `json:"auditor_id" binding:"required"`
	SPVID             string `json:"spv_id" binding:"required"`
	Priority          string `json:"priority"`
	RiskLevel         string `json:"risk_level"`
	PlannedStartDate  string `json:"planned_start_date"`
	PlannedEndDate    string `json:"planned_end_date"`
}

func ListProjects(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	search := c.Query("search")

	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	query := database.DB.Model(&database.AuditProject{}).
		Preload("Auditee").
		Preload("Auditor.Role").
		Preload("SPV.Role").
		Preload("DeptHead.Role").
		Preload("DivHead.Role")

	// Auditor only sees their own projects
	if userRole == "auditor" {
		query = query.Where("auditor_id = ?", userID)
	} else if userRole == "spv" {
		query = query.Where("spv_id = ? OR auditor_id = ?", userID, userID)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if search != "" {
		query = query.Where("title ILIKE ?", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var projects []database.AuditProject
	query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&projects)

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	response.Paginated(c, "Projects retrieved", projects, response.PaginateMeta{
		Page: page, Limit: limit, Total: total, TotalPages: totalPages,
	})
}

func GetProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var project database.AuditProject
	err = database.DB.
		Preload("Auditee").
		Preload("Auditor.Role").
		Preload("SPV.Role").
		Preload("DeptHead.Role").
		Preload("DivHead.Role").
		Preload("AuditPrograms").
		First(&project, "id = ?", id).Error
	if err != nil {
		response.NotFound(c, "Project not found")
		return
	}

	response.OK(c, "Project retrieved", project)
}

func CreateProject(c *gin.Context) {
	var req createProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	auditeeID, err := uuid.Parse(req.AuditeeID)
	if err != nil {
		response.BadRequest(c, "Invalid auditee ID")
		return
	}
	auditorID, err := uuid.Parse(req.AuditorID)
	if err != nil {
		response.BadRequest(c, "Invalid auditor ID")
		return
	}
	spvID, err := uuid.Parse(req.SPVID)
	if err != nil {
		response.BadRequest(c, "Invalid SPV ID")
		return
	}

	project := database.AuditProject{
		Title:      req.Title,
		AuditTheme: req.AuditTheme,
		AuditeeID:  auditeeID,
		AuditorID:  auditorID,
		SPVID:      spvID,
		Priority:   "medium",
		RiskLevel:  "medium",
		Status:     "draft_audit_program",
	}

	if req.Priority != "" {
		project.Priority = req.Priority
	}
	if req.RiskLevel != "" {
		project.RiskLevel = req.RiskLevel
	}

	// Auto-assign the single active dept_head and div_head
	var deptHead database.User
	if err := database.DB.Joins("Role").Where("roles.name = ? AND users.is_active = true", "dept_head").First(&deptHead).Error; err == nil {
		project.DeptHeadID = &deptHead.ID
	}
	var divHead database.User
	if err := database.DB.Joins("Role").Where("roles.name = ? AND users.is_active = true", "div_head").First(&divHead).Error; err == nil {
		project.DivHeadID = &divHead.ID
	}

	if req.AnnualAuditPlanID != "" {
		pid, _ := uuid.Parse(req.AnnualAuditPlanID)
		project.AnnualAuditPlanID = &pid
	}
	if req.PlannedStartDate != "" {
		t, _ := time.Parse("2006-01-02", req.PlannedStartDate)
		project.PlannedStartDate = &t
	}
	if req.PlannedEndDate != "" {
		t, _ := time.Parse("2006-01-02", req.PlannedEndDate)
		project.PlannedEndDate = &t
	}

	if err := database.DB.Create(&project).Error; err != nil {
		response.InternalError(c, "Failed to create project")
		return
	}

	database.DB.Preload("Auditee").Preload("Auditor.Role").Preload("SPV.Role").First(&project, "id = ?", project.ID)
	response.Created(c, "Project created", project)
}

func UpdateProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var project database.AuditProject
	if err := database.DB.First(&project, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Project not found")
		return
	}

	var req struct {
		Title            string `json:"title"`
		AuditTheme       string `json:"audit_theme"`
		Priority         string `json:"priority"`
		RiskLevel        string `json:"risk_level"`
		PlannedStartDate string `json:"planned_start_date"`
		PlannedEndDate   string `json:"planned_end_date"`
		Status           string `json:"status"`
	}
	c.ShouldBindJSON(&req)

	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.AuditTheme != "" {
		updates["audit_theme"] = req.AuditTheme
	}
	if req.Priority != "" {
		updates["priority"] = req.Priority
	}
	if req.RiskLevel != "" {
		updates["risk_level"] = req.RiskLevel
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.PlannedStartDate != "" {
		t, _ := time.Parse("2006-01-02", req.PlannedStartDate)
		updates["planned_start_date"] = t
	}
	if req.PlannedEndDate != "" {
		t, _ := time.Parse("2006-01-02", req.PlannedEndDate)
		updates["planned_end_date"] = t
	}

	database.DB.Model(&project).Updates(updates)
	response.OK(c, "Project updated", project)
}

func GetProjectDashboard(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var project database.AuditProject
	if err := database.DB.Preload("Auditee").Preload("Auditor").Preload("SPV").First(&project, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Project not found")
		return
	}

	// Checklist stats
	var totalChecklists, completedChecklists int64
	database.DB.Model(&database.ChecklistExecution{}).Where("audit_project_id = ?", id).Count(&totalChecklists)
	database.DB.Model(&database.ChecklistExecution{}).Where("audit_project_id = ? AND status = 'completed'", id).Count(&completedChecklists)

	// Approval requests
	var pendingApprovals int64
	database.DB.Model(&database.ApprovalRequest{}).Where("entity_id = ? AND status = 'pending'", id).Count(&pendingApprovals)

	progressPct := 0
	if totalChecklists > 0 {
		progressPct = int(completedChecklists * 100 / totalChecklists)
	}

	response.OK(c, "Dashboard retrieved", gin.H{
		"project":              project,
		"total_checklists":     totalChecklists,
		"completed_checklists": completedChecklists,
		"progress_percentage":  progressPct,
		"pending_approvals":    pendingApprovals,
	})
}
