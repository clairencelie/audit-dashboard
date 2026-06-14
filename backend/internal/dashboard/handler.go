package dashboard

import (
	"time"

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

	// Projects with no effort logged today
	today := time.Now().Truncate(24 * time.Hour)
	var projectsWithEffortToday []uuid.UUID
	database.DB.Model(&database.DailyEffort{}).
		Where("auditor_id = ? AND date >= ? AND date < ?", userID, today, today.Add(24*time.Hour)).
		Distinct("audit_project_id").
		Pluck("audit_project_id", &projectsWithEffortToday)

	var noEffortProjects []database.AuditProject
	for _, p := range activeProjects {
		if p.Status == "fieldwork" {
			found := false
			for _, pid := range projectsWithEffortToday {
				if pid == p.ID {
					found = true
					break
				}
			}
			if !found {
				noEffortProjects = append(noEffortProjects, p)
			}
		}
	}

	// Pending data requests
	var pendingDataRequests []database.DataRequest
	database.DB.Where("audit_project_id IN (SELECT id FROM audit_projects WHERE auditor_id = ?) AND status IN ('pending', 'partial')", userID).
		Preload("AuditChecklist").
		Order("due_date ASC NULLS LAST").
		Limit(10).
		Find(&pendingDataRequests)

	response.OK(c, "Auditor dashboard retrieved", gin.H{
		"active_projects":       activeProjects,
		"pending_approvals":     pendingApprovals,
		"no_effort_today":       noEffortProjects,
		"pending_data_requests": pendingDataRequests,
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

	// Alert: auditors under this SPV who haven't logged effort today on fieldwork projects
	today := time.Now().Truncate(24 * time.Hour)
	type AuditorAlert struct {
		AuditorID   uuid.UUID `json:"auditor_id"`
		AuditorName string    `json:"auditor_name"`
		ProjectID   uuid.UUID `json:"project_id"`
		ProjectTitle string   `json:"project_title"`
	}
	var noEffortAlerts []AuditorAlert
	for _, p := range projects {
		if p.Status == "fieldwork" {
			var effortCount int64
			database.DB.Model(&database.DailyEffort{}).
				Where("audit_project_id = ? AND auditor_id = ? AND date >= ? AND date < ?",
					p.ID, p.AuditorID, today, today.Add(24*time.Hour)).
				Count(&effortCount)
			if effortCount == 0 {
				noEffortAlerts = append(noEffortAlerts, AuditorAlert{
					AuditorID:    p.AuditorID,
					AuditorName:  p.Auditor.Name,
					ProjectID:    p.ID,
					ProjectTitle: p.Title,
				})
			}
		}
	}

	// Alert: idle checklist executions (not updated in 3+ days) for SPV's projects
	threeDaysAgo := time.Now().Add(-3 * 24 * time.Hour)
	type IdleChecklist struct {
		ChecklistID    uuid.UUID `json:"checklist_id"`
		ChecklistTitle string    `json:"checklist_title"`
		ProjectID      uuid.UUID `json:"project_id"`
		ProjectTitle   string    `json:"project_title"`
		LastUpdated    time.Time `json:"last_updated"`
	}
	var idleChecklists []IdleChecklist
	for _, p := range projects {
		if p.Status == "fieldwork" {
			var staleExecs []database.ChecklistExecution
			database.DB.Preload("AuditChecklist").
				Where("audit_project_id = ? AND status IN ('not_started', 'in_progress', 'waiting_data') AND updated_at < ?", p.ID, threeDaysAgo).
				Find(&staleExecs)
			for _, exec := range staleExecs {
				idleChecklists = append(idleChecklists, IdleChecklist{
					ChecklistID:    exec.AuditChecklistID,
					ChecklistTitle: exec.AuditChecklist.Title,
					ProjectID:      p.ID,
					ProjectTitle:   p.Title,
					LastUpdated:    exec.UpdatedAt,
				})
			}
		}
	}

	// Checklist execution progress summary per project
	type ProjectProgress struct {
		ProjectID    uuid.UUID `json:"project_id"`
		ProjectTitle string    `json:"project_title"`
		Total        int64     `json:"total"`
		Completed    int64     `json:"completed"`
		InProgress   int64     `json:"in_progress"`
		NotStarted   int64     `json:"not_started"`
	}
	var progressSummary []ProjectProgress
	for _, p := range projects {
		var total, completed, inProgress, notStarted int64
		database.DB.Model(&database.ChecklistExecution{}).Where("audit_project_id = ?", p.ID).Count(&total)
		database.DB.Model(&database.ChecklistExecution{}).Where("audit_project_id = ? AND status IN ('completed', 'reviewed', 'no_exception')", p.ID).Count(&completed)
		database.DB.Model(&database.ChecklistExecution{}).Where("audit_project_id = ? AND status IN ('in_progress', 'waiting_data', 'testing_done', 'exception_found', 'need_review')", p.ID).Count(&inProgress)
		database.DB.Model(&database.ChecklistExecution{}).Where("audit_project_id = ? AND status = 'not_started'", p.ID).Count(&notStarted)
		if total > 0 {
			progressSummary = append(progressSummary, ProjectProgress{
				ProjectID:    p.ID,
				ProjectTitle: p.Title,
				Total:        total,
				Completed:    completed,
				InProgress:   inProgress,
				NotStarted:   notStarted,
			})
		}
	}

	response.OK(c, "SPV dashboard retrieved", gin.H{
		"projects":            projects,
		"pending_approvals":   pendingApprovals,
		"no_effort_alerts":    noEffortAlerts,
		"idle_checklists":     idleChecklists,
		"progress_summary":    progressSummary,
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
