package approvals

import (
	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func ListPending(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	var requests []database.ApprovalRequest
	database.DB.
		Preload("RequestedBy").
		Preload("CurrentApprover").
		Preload("Histories.Approver").
		Where("current_approver_id = ? AND status = 'pending'", userID).
		Order("created_at DESC").
		Find(&requests)

	response.OK(c, "Pending approvals retrieved", requests)
}

func ListByEntity(c *gin.Context) {
	entityType := c.Query("entity_type")
	entityIDStr := c.Query("entity_id")

	if entityType == "" || entityIDStr == "" {
		response.BadRequest(c, "entity_type and entity_id are required")
		return
	}

	entityID, err := uuid.Parse(entityIDStr)
	if err != nil {
		response.BadRequest(c, "Invalid entity ID")
		return
	}

	var requests []database.ApprovalRequest
	database.DB.
		Preload("RequestedBy").
		Preload("CurrentApprover").
		Preload("Histories.Approver").
		Where("entity_type = ? AND entity_id = ?", entityType, entityID).
		Order("created_at DESC").
		Find(&requests)

	response.OK(c, "Approval requests retrieved", requests)
}
