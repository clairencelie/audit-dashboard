package auditprograms

import (
	"time"

	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func GetByProject(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var programs []database.AuditProgram
	database.DB.Preload("CreatedBy").
		Preload("Checklists").
		Where("audit_project_id = ?", projectID).
		Order("version DESC").
		Find(&programs)

	response.OK(c, "Audit programs retrieved", programs)
}

func Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid program ID")
		return
	}

	var program database.AuditProgram
	if err := database.DB.Preload("CreatedBy").Preload("Checklists").First(&program, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Audit program not found")
		return
	}

	response.OK(c, "Audit program retrieved", program)
}

func Create(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	type checklistInput struct {
		Title            string `json:"title"`
		Objective        string `json:"objective"`
		ProcedureText    string `json:"procedure_text"`
		RequiredData     string `json:"required_data"`
		ExpectedEvidence string `json:"expected_evidence"`
		IsMandatory      *bool  `json:"is_mandatory"`
		SourceCriteria   string `json:"source_criteria"`
	}
	var req struct {
		AuditPeriodStart string           `json:"audit_period_start"`
		AuditPeriodEnd   string           `json:"audit_period_end"`
		DataPeriodStart  string           `json:"data_period_start"`
		DataPeriodEnd    string           `json:"data_period_end"`
		Scope            string           `json:"scope"`
		Objectives       string           `json:"objectives"`
		CriteriaSummary  string           `json:"criteria_summary"`
		RiskAnalysis     string           `json:"risk_analysis"`
		DataRequired     string           `json:"data_required"`
		Checklists       []checklistInput `json:"checklists"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	parseDate := func(s string) *time.Time {
		if s == "" {
			return nil
		}
		t, _ := time.Parse("2006-01-02", s)
		return &t
	}

	// Get latest version
	var lastProgram database.AuditProgram
	var version = 1
	if err := database.DB.Where("audit_project_id = ?", projectID).Order("version DESC").First(&lastProgram).Error; err == nil {
		version = lastProgram.Version + 1
	}

	program := database.AuditProgram{
		AuditProjectID:   projectID,
		Version:          version,
		Scope:            req.Scope,
		Objectives:       req.Objectives,
		CriteriaSummary:  req.CriteriaSummary,
		RiskAnalysis:     req.RiskAnalysis,
		DataRequired:     req.DataRequired,
		Status:           "draft",
		CreatedByID:      userID,
		AuditPeriodStart: parseDate(req.AuditPeriodStart),
		AuditPeriodEnd:   parseDate(req.AuditPeriodEnd),
		DataPeriodStart:  parseDate(req.DataPeriodStart),
		DataPeriodEnd:    parseDate(req.DataPeriodEnd),
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&program).Error; err != nil {
			return err
		}
		for i, cl := range req.Checklists {
			if cl.Title == "" {
				continue
			}
			isMandatory := true
			if cl.IsMandatory != nil {
				isMandatory = *cl.IsMandatory
			}
			checklist := database.AuditChecklist{
				AuditProgramID:   program.ID,
				Title:            cl.Title,
				Objective:        cl.Objective,
				ProcedureText:    cl.ProcedureText,
				RequiredData:     cl.RequiredData,
				ExpectedEvidence: cl.ExpectedEvidence,
				IsMandatory:      isMandatory,
				SourceCriteria:   cl.SourceCriteria,
				SequenceNo:       i + 1,
			}
			if err := tx.Create(&checklist).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		response.InternalError(c, "Failed to create audit program")
		return
	}

	database.DB.Preload("CreatedBy").Preload("Checklists").First(&program, "id = ?", program.ID)
	response.Created(c, "Audit program created", program)
}

func Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid program ID")
		return
	}

	var program database.AuditProgram
	if err := database.DB.First(&program, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Audit program not found")
		return
	}

	if program.IsLocked {
		response.BadRequest(c, "Cannot edit a locked audit program")
		return
	}

	var req struct {
		AuditPeriodStart string `json:"audit_period_start"`
		AuditPeriodEnd   string `json:"audit_period_end"`
		DataPeriodStart  string `json:"data_period_start"`
		DataPeriodEnd    string `json:"data_period_end"`
		Scope            string `json:"scope"`
		Objectives       string `json:"objectives"`
		CriteriaSummary  string `json:"criteria_summary"`
		RiskAnalysis     string `json:"risk_analysis"`
		DataRequired     string `json:"data_required"`
	}
	c.ShouldBindJSON(&req)

	updates := map[string]interface{}{}
	if req.Scope != "" {
		updates["scope"] = req.Scope
	}
	if req.Objectives != "" {
		updates["objectives"] = req.Objectives
	}
	if req.CriteriaSummary != "" {
		updates["criteria_summary"] = req.CriteriaSummary
	}
	if req.RiskAnalysis != "" {
		updates["risk_analysis"] = req.RiskAnalysis
	}
	if req.DataRequired != "" {
		updates["data_required"] = req.DataRequired
	}

	database.DB.Model(&program).Updates(updates)
	response.OK(c, "Audit program updated", program)
}

func Submit(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid program ID")
		return
	}

	var program database.AuditProgram
	if err := database.DB.Preload("AuditProject").First(&program, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Audit program not found")
		return
	}

	if program.Status != "draft" && program.Status != "need_revision" {
		response.BadRequest(c, "Audit program is not in draft or need_revision status")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	now := time.Now()

	database.DB.Model(&program).Updates(map[string]interface{}{
		"status":       "submitted",
		"submitted_at": now,
	})

	// Create approval request for SPV
	approval := database.ApprovalRequest{
		EntityType:        "audit_program",
		EntityID:          program.ID,
		ApprovalStage:     "spv",
		RequestedByID:     userID,
		CurrentApproverID: &program.AuditProject.SPVID,
		Status:            "pending",
		SubmittedAt:       &now,
	}
	database.DB.Create(&approval)

	response.OK(c, "Audit program submitted for approval", program)
}

func Approve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid program ID")
		return
	}

	var req struct {
		Comments string `json:"comments"`
	}
	c.ShouldBindJSON(&req)

	var program database.AuditProgram
	if err := database.DB.Preload("AuditProject").First(&program, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Audit program not found")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")
	approverID, _ := uuid.Parse(userIDStr.(string))
	now := time.Now()

	var approvalRequest database.ApprovalRequest
	database.DB.Where("entity_id = ? AND entity_type = 'audit_program' AND status = 'pending'", id).First(&approvalRequest)

	if approvalRequest.ID == uuid.Nil {
		response.BadRequest(c, "No pending approval request found")
		return
	}

	history := database.ApprovalHistory{
		ApprovalRequestID: approvalRequest.ID,
		ApproverID:        approverID,
		Action:            "approved",
		Comments:          req.Comments,
		ActionAt:          now,
	}
	database.DB.Create(&history)

	nextStatus := ""
	nextStage := ""
	nextApproverID := (*uuid.UUID)(nil)

	switch userRole {
	case "spv":
		if program.AuditProject.DeptHeadID != nil {
			nextStatus = "approved_spv"
			nextStage = "dept_head"
			nextApproverID = program.AuditProject.DeptHeadID
		} else if program.AuditProject.DivHeadID != nil {
			nextStatus = "approved_spv"
			nextStage = "div_head"
			nextApproverID = program.AuditProject.DivHeadID
		} else {
			nextStatus = "final_approved"
		}
	case "dept_head":
		if program.AuditProject.DivHeadID != nil {
			nextStatus = "approved_dept_head"
			nextStage = "div_head"
			nextApproverID = program.AuditProject.DivHeadID
		} else {
			nextStatus = "final_approved"
		}
	case "div_head":
		nextStatus = "final_approved"
	}

	database.DB.Model(&approvalRequest).Updates(map[string]interface{}{
		"status":       "approved",
		"completed_at": now,
	})

	if nextStatus == "final_approved" {
		database.DB.Model(&program).Updates(map[string]interface{}{
			"status":      "final_approved",
			"is_locked":   true,
			"approved_at": now,
		})
		// Update project status
		database.DB.Model(&database.AuditProject{}).Where("id = ?", program.AuditProjectID).Update("status", "approved_audit_program")
	} else {
		database.DB.Model(&program).Update("status", nextStatus)

		newApproval := database.ApprovalRequest{
			EntityType:        "audit_program",
			EntityID:          program.ID,
			ApprovalStage:     nextStage,
			RequestedByID:     approverID,
			CurrentApproverID: nextApproverID,
			Status:            "pending",
			SubmittedAt:       &now,
		}
		database.DB.Create(&newApproval)
	}

	response.OK(c, "Audit program approved", nil)
}

func Reject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid program ID")
		return
	}

	var req struct {
		Comments string `json:"comments" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Comments are required for rejection")
		return
	}

	var program database.AuditProgram
	if err := database.DB.First(&program, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Audit program not found")
		return
	}

	userIDStr, _ := c.Get("user_id")
	approverID, _ := uuid.Parse(userIDStr.(string))
	now := time.Now()

	var approvalRequest database.ApprovalRequest
	database.DB.Where("entity_id = ? AND entity_type = 'audit_program' AND status = 'pending'", id).First(&approvalRequest)

	history := database.ApprovalHistory{
		ApprovalRequestID: approvalRequest.ID,
		ApproverID:        approverID,
		Action:            "rejected",
		Comments:          req.Comments,
		ActionAt:          now,
	}
	database.DB.Create(&history)

	database.DB.Model(&approvalRequest).Updates(map[string]interface{}{
		"status":       "rejected",
		"completed_at": now,
	})

	database.DB.Model(&program).Update("status", "need_revision")

	response.OK(c, "Audit program rejected, returned to auditor", nil)
}
