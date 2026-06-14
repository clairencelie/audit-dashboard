package datarequests

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

	var requests []database.DataRequest
	database.DB.
		Preload("RequestedBy").
		Preload("AuditChecklist").
		Where("audit_project_id = ?", projectID).
		Order("created_at DESC").
		Find(&requests)

	response.OK(c, "Data requests retrieved", requests)
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
		AuditChecklistID *string `json:"audit_checklist_id"`
		Title            string  `json:"title" binding:"required"`
		Description      string  `json:"description"`
		RequestedTo      string  `json:"requested_to"`
		DueDate          string  `json:"due_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	dr := database.DataRequest{
		AuditProjectID: projectID,
		RequestedByID:  userID,
		Title:          req.Title,
		Description:    req.Description,
		RequestedTo:    req.RequestedTo,
		Status:         "pending",
	}

	if req.AuditChecklistID != nil && *req.AuditChecklistID != "" {
		checklistID, err := uuid.Parse(*req.AuditChecklistID)
		if err == nil {
			dr.AuditChecklistID = &checklistID
		}
	}
	if req.DueDate != "" {
		t, err := time.Parse("2006-01-02", req.DueDate)
		if err == nil {
			dr.DueDate = &t
		}
	}

	if err := database.DB.Create(&dr).Error; err != nil {
		response.InternalError(c, "Failed to create data request")
		return
	}

	database.DB.Preload("RequestedBy").Preload("AuditChecklist").First(&dr, "id = ?", dr.ID)
	response.Created(c, "Data request created", dr)
}

func Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid data request ID")
		return
	}

	var dr database.DataRequest
	if err := database.DB.First(&dr, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Data request not found")
		return
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		RequestedTo string `json:"requested_to"`
		Status      string `json:"status"`
		DueDate     string `json:"due_date"`
		ReceivedAt  string `json:"received_at"`
		Notes       string `json:"notes"`
	}
	c.ShouldBindJSON(&req)

	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.RequestedTo != "" {
		updates["requested_to"] = req.RequestedTo
	}
	if req.Status != "" {
		updates["status"] = req.Status
		if req.Status == "received" && dr.ReceivedAt == nil {
			now := time.Now()
			updates["received_at"] = &now
		}
	}
	if req.Notes != "" {
		updates["notes"] = req.Notes
	}
	if req.DueDate != "" {
		t, err := time.Parse("2006-01-02", req.DueDate)
		if err == nil {
			updates["due_date"] = &t
		}
	}
	if req.ReceivedAt != "" {
		t, err := time.Parse("2006-01-02", req.ReceivedAt)
		if err == nil {
			updates["received_at"] = &t
		}
	}

	database.DB.Model(&dr).Updates(updates)
	database.DB.Preload("RequestedBy").Preload("AuditChecklist").First(&dr, "id = ?", dr.ID)
	response.OK(c, "Data request updated", dr)
}

func Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid data request ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	role, _ := c.Get("role")

	var dr database.DataRequest
	if err := database.DB.First(&dr, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Data request not found")
		return
	}

	if role != "admin" && dr.RequestedByID != userID {
		response.Forbidden(c, "Cannot delete another user's data request")
		return
	}

	database.DB.Delete(&dr)
	response.OK(c, "Data request deleted", nil)
}
