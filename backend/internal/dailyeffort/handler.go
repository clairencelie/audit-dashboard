package dailyeffort

import (
	"time"

	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func List(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var efforts []database.DailyEffort
	database.DB.
		Preload("Auditor").
		Preload("AuditChecklist").
		Where("audit_project_id = ?", projectID).
		Order("date DESC, created_at DESC").
		Find(&efforts)

	response.OK(c, "Daily efforts retrieved", efforts)
}

func Create(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	var req struct {
		AuditChecklistID    *string `json:"audit_checklist_id"`
		Date                string  `json:"date" binding:"required"`
		ActivityDescription string  `json:"activity_description"`
		IssueEncountered    string  `json:"issue_encountered"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		response.BadRequest(c, "Invalid date format, use YYYY-MM-DD")
		return
	}

	effort := database.DailyEffort{
		AuditProjectID:      projectID,
		AuditorID:           userID,
		Date:                date,
		ActivityDescription: req.ActivityDescription,
		IssueEncountered:    req.IssueEncountered,
	}

	if req.AuditChecklistID != nil && *req.AuditChecklistID != "" {
		checklistID, err := uuid.Parse(*req.AuditChecklistID)
		if err == nil {
			effort.AuditChecklistID = &checklistID
		}
	}

	if err := database.DB.Create(&effort).Error; err != nil {
		response.InternalError(c, "Failed to create daily effort")
		return
	}

	database.DB.Preload("Auditor").Preload("AuditChecklist").First(&effort, "id = ?", effort.ID)
	response.Created(c, "Daily effort created", effort)
}

func Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid effort ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	role, _ := c.Get("role")

	var effort database.DailyEffort
	if err := database.DB.First(&effort, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Daily effort not found")
		return
	}

	if role != "admin" && effort.AuditorID != userID {
		response.Forbidden(c, "Cannot edit another auditor's effort log")
		return
	}

	var req struct {
		AuditChecklistID    *string `json:"audit_checklist_id"`
		ActivityDescription string  `json:"activity_description"`
		IssueEncountered    string  `json:"issue_encountered"`
	}
	c.ShouldBindJSON(&req)

	updates := map[string]interface{}{}
	if req.ActivityDescription != "" {
		updates["activity_description"] = req.ActivityDescription
	}
	if req.IssueEncountered != "" {
		updates["issue_encountered"] = req.IssueEncountered
	}
	if req.AuditChecklistID != nil {
		if *req.AuditChecklistID == "" {
			updates["audit_checklist_id"] = nil
		} else {
			checklistID, err := uuid.Parse(*req.AuditChecklistID)
			if err == nil {
				updates["audit_checklist_id"] = checklistID
			}
		}
	}

	database.DB.Model(&effort).Updates(updates)
	database.DB.Preload("Auditor").Preload("AuditChecklist").First(&effort, "id = ?", effort.ID)
	response.OK(c, "Daily effort updated", effort)
}

func Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid effort ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	role, _ := c.Get("role")

	var effort database.DailyEffort
	if err := database.DB.First(&effort, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Daily effort not found")
		return
	}

	if role != "admin" && effort.AuditorID != userID {
		response.Forbidden(c, "Cannot delete another auditor's effort log")
		return
	}

	database.DB.Delete(&effort)
	response.OK(c, "Daily effort deleted", nil)
}
