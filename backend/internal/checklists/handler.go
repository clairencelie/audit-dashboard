package checklists

import (
	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func ListByProgram(c *gin.Context) {
	programID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid program ID")
		return
	}

	var checklists []database.AuditChecklist
	database.DB.Where("audit_program_id = ?", programID).Order("sequence_no ASC").Find(&checklists)
	response.OK(c, "Checklists retrieved", checklists)
}

func Create(c *gin.Context) {
	programID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid program ID")
		return
	}

	var program database.AuditProgram
	if err := database.DB.First(&program, "id = ?", programID).Error; err != nil {
		response.NotFound(c, "Audit program not found")
		return
	}
	if program.IsLocked {
		response.BadRequest(c, "Cannot add checklist to a locked audit program")
		return
	}

	var req struct {
		Title            string `json:"title" binding:"required"`
		Objective        string `json:"objective"`
		ProcedureText    string `json:"procedure_text"`
		RequiredData     string `json:"required_data"`
		ExpectedEvidence string `json:"expected_evidence"`
		IsMandatory      *bool  `json:"is_mandatory"`
		SourceCriteria   string `json:"source_criteria"`
		SequenceNo       int    `json:"sequence_no"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	isMandatory := true
	if req.IsMandatory != nil {
		isMandatory = *req.IsMandatory
	}

	if req.SequenceNo == 0 {
		var count int64
		database.DB.Model(&database.AuditChecklist{}).Where("audit_program_id = ?", programID).Count(&count)
		req.SequenceNo = int(count) + 1
	}

	checklist := database.AuditChecklist{
		AuditProgramID:   programID,
		Title:            req.Title,
		Objective:        req.Objective,
		ProcedureText:    req.ProcedureText,
		RequiredData:     req.RequiredData,
		ExpectedEvidence: req.ExpectedEvidence,
		IsMandatory:      isMandatory,
		SourceCriteria:   req.SourceCriteria,
		SequenceNo:       req.SequenceNo,
	}

	if err := database.DB.Create(&checklist).Error; err != nil {
		response.InternalError(c, "Failed to create checklist")
		return
	}

	response.Created(c, "Checklist created", checklist)
}

func Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid checklist ID")
		return
	}

	var checklist database.AuditChecklist
	if err := database.DB.Preload("AuditProgram").First(&checklist, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Checklist not found")
		return
	}

	if checklist.AuditProgram.IsLocked && checklist.IsMandatory {
		response.BadRequest(c, "Cannot edit mandatory checklist on a locked program")
		return
	}

	var req struct {
		Title            string `json:"title"`
		Objective        string `json:"objective"`
		ProcedureText    string `json:"procedure_text"`
		RequiredData     string `json:"required_data"`
		ExpectedEvidence string `json:"expected_evidence"`
		SourceCriteria   string `json:"source_criteria"`
		SequenceNo       int    `json:"sequence_no"`
	}
	c.ShouldBindJSON(&req)

	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Objective != "" {
		updates["objective"] = req.Objective
	}
	if req.ProcedureText != "" {
		updates["procedure_text"] = req.ProcedureText
	}
	if req.RequiredData != "" {
		updates["required_data"] = req.RequiredData
	}
	if req.ExpectedEvidence != "" {
		updates["expected_evidence"] = req.ExpectedEvidence
	}
	if req.SourceCriteria != "" {
		updates["source_criteria"] = req.SourceCriteria
	}
	if req.SequenceNo > 0 {
		updates["sequence_no"] = req.SequenceNo
	}

	database.DB.Model(&checklist).Updates(updates)
	response.OK(c, "Checklist updated", checklist)
}

func Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid checklist ID")
		return
	}

	var checklist database.AuditChecklist
	if err := database.DB.Preload("AuditProgram").First(&checklist, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Checklist not found")
		return
	}

	if checklist.AuditProgram.IsLocked && checklist.IsMandatory {
		response.BadRequest(c, "Cannot delete mandatory checklist on a locked program")
		return
	}

	database.DB.Delete(&checklist)
	response.OK(c, "Checklist deleted", nil)
}

// --- Checklist Execution ---

func ListExecutions(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	// Auto-create executions if project is in fieldwork but has none yet
	var execCount int64
	database.DB.Model(&database.ChecklistExecution{}).Where("audit_project_id = ?", projectID).Count(&execCount)
	if execCount == 0 {
		var project database.AuditProject
		if err := database.DB.First(&project, "id = ?", projectID).Error; err == nil {
			if project.Status == "fieldwork" || project.Status == "draft_finding" || project.Status == "draft_report" {
				var approvedProgram database.AuditProgram
				if err := database.DB.Preload("Checklists").
					Where("audit_project_id = ? AND status = 'final_approved'", projectID).
					First(&approvedProgram).Error; err == nil {
					for _, cl := range approvedProgram.Checklists {
						exec := database.ChecklistExecution{
							AuditProjectID:     projectID,
							AuditChecklistID:   cl.ID,
							Status:             "not_started",
							ProgressPercentage: 0,
						}
						database.DB.Create(&exec)
					}
				}
			}
		}
	}

	var executions []database.ChecklistExecution
	database.DB.
		Preload("AuditChecklist").
		Preload("ReviewedBy").
		Where("audit_project_id = ?", projectID).
		Joins("JOIN audit_checklists ON audit_checklists.id = checklist_executions.audit_checklist_id").
		Order("audit_checklists.sequence_no ASC").
		Find(&executions)

	response.OK(c, "Checklist executions retrieved", executions)
}

func UpdateExecution(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid execution ID")
		return
	}

	var exec database.ChecklistExecution
	if err := database.DB.First(&exec, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Checklist execution not found")
		return
	}

	var req struct {
		Status                 string `json:"status"`
		ProgressPercentage     int    `json:"progress_percentage"`
		ResultSummary          string `json:"result_summary"`
		ExceptionFound         *bool  `json:"exception_found"`
		PotentialFinding       *bool  `json:"potential_finding"`
		JustificationIfNotDone string `json:"justification_if_not_done"`
		ReviewerNote           string `json:"reviewer_note"`
	}
	c.ShouldBindJSON(&req)

	updates := map[string]interface{}{}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.ProgressPercentage >= 0 {
		updates["progress_percentage"] = req.ProgressPercentage
	}
	if req.ResultSummary != "" {
		updates["result_summary"] = req.ResultSummary
	}
	if req.ExceptionFound != nil {
		updates["exception_found"] = *req.ExceptionFound
	}
	if req.PotentialFinding != nil {
		updates["potential_finding"] = *req.PotentialFinding
	}
	if req.JustificationIfNotDone != "" {
		updates["justification_if_not_done"] = req.JustificationIfNotDone
	}
	if req.ReviewerNote != "" {
		updates["reviewer_note"] = req.ReviewerNote
	}

	database.DB.Model(&exec).Updates(updates)
	response.OK(c, "Execution updated", exec)
}
