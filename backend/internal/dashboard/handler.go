package dashboard

import (
	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Auditor(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	var activeProjects []database.AuditProject
	database.DB.Preload("Auditee").Preload("SPV").
		Where("auditor_id = ? AND status NOT IN ('closed', 'report_released')", userID).
		Order("created_at DESC").
		Find(&activeProjects)

	var pendingApprovals []database.ApprovalRequest
	database.DB.Preload("RequestedBy").
		Where("current_approver_id = ? AND status = 'pending'", userID).
		Order("created_at DESC").
		Find(&pendingApprovals)

	var totalProjects, activeCount int64
	database.DB.Model(&database.AuditProject{}).Where("auditor_id = ?", userID).Count(&totalProjects)
	database.DB.Model(&database.AuditProject{}).Where("auditor_id = ? AND status NOT IN ('closed', 'report_released')", userID).Count(&activeCount)

	response.OK(c, "Auditor dashboard retrieved", gin.H{
		"active_projects":   activeProjects,
		"pending_approvals": pendingApprovals,
		"stats": gin.H{
			"total_projects":  totalProjects,
			"active_projects": activeCount,
		},
	})
}

func SPV(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	var projects []database.AuditProject
	database.DB.Preload("Auditee").Preload("Auditor").
		Where("spv_id = ?", userID).
		Order("created_at DESC").
		Limit(20).
		Find(&projects)

	var pendingApprovals []database.ApprovalRequest
	database.DB.Preload("RequestedBy").
		Where("current_approver_id = ? AND status = 'pending'", userID).
		Order("created_at DESC").
		Find(&pendingApprovals)

	var totalProjects, activeCount int64
	database.DB.Model(&database.AuditProject{}).Where("spv_id = ?", userID).Count(&totalProjects)
	database.DB.Model(&database.AuditProject{}).
		Where("spv_id = ? AND status NOT IN ('closed', 'report_released')", userID).
		Count(&activeCount)

	response.OK(c, "SPV dashboard retrieved", gin.H{
		"projects":          projects,
		"pending_approvals": pendingApprovals,
		"stats": gin.H{
			"total_projects":  totalProjects,
			"active_projects": activeCount,
		},
	})
}

func DeptHead(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	var projects []database.AuditProject
	database.DB.Preload("Auditee").Preload("Auditor").Preload("SPV").
		Where("dept_head_id = ?", userID).
		Order("created_at DESC").
		Limit(20).
		Find(&projects)

	var pendingApprovals []database.ApprovalRequest
	database.DB.Preload("RequestedBy").
		Where("current_approver_id = ? AND status = 'pending'", userID).
		Order("created_at DESC").
		Find(&pendingApprovals)

	var totalProjects, activeCount int64
	database.DB.Model(&database.AuditProject{}).Where("dept_head_id = ?", userID).Count(&totalProjects)
	database.DB.Model(&database.AuditProject{}).
		Where("dept_head_id = ? AND status NOT IN ('closed', 'report_released')", userID).
		Count(&activeCount)

	response.OK(c, "Dept Head dashboard retrieved", gin.H{
		"projects":          projects,
		"pending_approvals": pendingApprovals,
		"stats": gin.H{
			"total_projects":  totalProjects,
			"active_projects": activeCount,
		},
	})
}

func DivHead(c *gin.Context) {
	var allProjects []database.AuditProject
	database.DB.Preload("Auditee").Preload("Auditor").Preload("SPV").
		Order("created_at DESC").
		Limit(50).
		Find(&allProjects)

	var pendingApprovals []database.ApprovalRequest
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	database.DB.Preload("RequestedBy").
		Where("current_approver_id = ? AND status = 'pending'", userID).
		Order("created_at DESC").
		Find(&pendingApprovals)

	var totalProjects, activeCount, closedCount int64
	database.DB.Model(&database.AuditProject{}).Count(&totalProjects)
	database.DB.Model(&database.AuditProject{}).Where("status NOT IN ('closed', 'report_released')").Count(&activeCount)
	database.DB.Model(&database.AuditProject{}).Where("status IN ('closed', 'report_released')").Count(&closedCount)

	response.OK(c, "Div Head dashboard retrieved", gin.H{
		"projects":          allProjects,
		"pending_approvals": pendingApprovals,
		"stats": gin.H{
			"total_projects":  totalProjects,
			"active_projects": activeCount,
			"closed_projects": closedCount,
		},
	})
}
