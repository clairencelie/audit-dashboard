package findings

import (
	"bytes"
	"encoding/base64"
	"log"
	"time"

	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/internal/drive"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type findingInput struct {
	ChecklistExecutionID *string `json:"checklist_execution_id"`

	SubjectArea     string `json:"subject_area"`
	FindingCategory string `json:"finding_category"`
	CriteriaText    string `json:"criteria_text"`
	RiskType        string `json:"risk_type"`
	RiskRating      string `json:"risk_rating"`

	ConditionText string `json:"condition_text"`

	ImpactQuantity      *int     `json:"impact_quantity"`
	ImpactLossValue     *float64 `json:"impact_loss_value"`
	ImpactPotentialRisk string   `json:"impact_potential_risk"`

	AuditeeResponseCondition string `json:"auditee_response_condition"`

	CauseKebijakan string `json:"cause_kebijakan"`
	CauseSistem    string `json:"cause_sistem"`
	CauseSDM       string `json:"cause_sdm"`
	CauseEksternal string `json:"cause_eksternal"`

	RecKebijakan string `json:"rec_kebijakan"`
	RecSistem    string `json:"rec_sistem"`
	RecSDM       string `json:"rec_sdm"`
	RecEksternal string `json:"rec_eksternal"`

	AuditeePIC   string `json:"auditee_pic"`
	DeadlineDate string `json:"deadline_date"`
}

var validFindingCategories = map[string]bool{
	"Untuk Menjadi Perhatian":          true,
	"Pelanggaran Administrasi Material": true,
	"Pelanggaran Integritas":           true,
}

var validRiskRatings = map[string]bool{
	"low":    true,
	"medium": true,
	"high":   true,
}

func parseDate(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

// validateFindingInput checks enum constraints, non-negative numeric fields, and
// (when requireMandatory is true, i.e. on create/update) that the fields the auditor
// must always fill in are present: subject_area, finding_category, criteria_text,
// risk_type, risk_rating, condition_text. Everything else may stay empty so a
// finding can be saved as an in-progress draft.
func validateFindingInput(req findingInput, requireMandatory bool) string {
	if req.FindingCategory != "" && !validFindingCategories[req.FindingCategory] {
		return "finding_category must be one of: Untuk Menjadi Perhatian, Pelanggaran Administrasi Material, Pelanggaran Integritas"
	}
	if req.RiskRating != "" && !validRiskRatings[req.RiskRating] {
		return "risk_rating must be one of: low, medium, high"
	}
	if requireMandatory {
		if req.SubjectArea == "" {
			return "subject_area is required"
		}
		if req.FindingCategory == "" {
			return "finding_category is required"
		}
		if req.CriteriaText == "" {
			return "criteria_text is required"
		}
		if req.RiskType == "" {
			return "risk_type is required"
		}
		if req.RiskRating == "" {
			return "risk_rating is required"
		}
		if req.ConditionText == "" {
			return "condition_text is required"
		}
	}
	if req.ImpactQuantity != nil && *req.ImpactQuantity < 0 {
		return "impact_quantity cannot be negative"
	}
	if req.ImpactLossValue != nil && *req.ImpactLossValue < 0 {
		return "impact_loss_value cannot be negative"
	}
	return ""
}

// findingCompletionGap returns the first missing requirement before a finding may be
// submitted for review: the draft-condition stage (subject through potensi risiko)
// must be fully filled, since this is what SPV/Dept Head/Div Head will be approving.
func findingCompletionGap(f database.Finding) string {
	switch {
	case f.SubjectArea == "":
		return "Subjek Pemeriksaan belum diisi"
	case f.FindingCategory == "":
		return "Kategori Temuan belum diisi"
	case f.CriteriaText == "":
		return "Kriteria belum diisi"
	case f.RiskType == "":
		return "Jenis Risiko belum diisi"
	case f.RiskRating == "":
		return "Tingkat Risiko belum diisi"
	case f.ConditionText == "":
		return "Kondisi belum diisi"
	case f.ImpactQuantity <= 0:
		return "Jumlah (Dampak) belum diisi"
	case f.ImpactPotentialRisk == "":
		return "Potensi Risiko (Dampak) belum diisi"
	}
	return ""
}

// hasCause/hasRecommendation report whether at least one of the four category
// fields has content — the dynamic UI allows authoring only the categories that
// apply, so completeness means "at least one entry," not "all four."
func hasCause(f database.Finding) bool {
	return f.CauseKebijakan != "" || f.CauseSistem != "" || f.CauseSDM != "" || f.CauseEksternal != ""
}

func hasRecommendation(f database.Finding) bool {
	return f.RecKebijakan != "" || f.RecSistem != "" || f.RecSDM != "" || f.RecEksternal != ""
}

func List(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var findingsList []database.Finding
	database.DB.
		Preload("CreatedBy").
		Preload("ChecklistExecution.AuditChecklist").
		Preload("Attachments").
		Preload("ApprovalRequests", "status = ?", "pending").
		Where("audit_project_id = ?", projectID).
		Order("created_at DESC").
		Find(&findingsList)

	response.OK(c, "Findings retrieved", findingsList)
}

func Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid finding ID")
		return
	}

	var finding database.Finding
	if err := database.DB.
		Preload("CreatedBy").
		Preload("ChecklistExecution.AuditChecklist").
		Preload("Attachments.UploadedBy").
		Preload("ApprovalRequests.Histories.Approver").
		First(&finding, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Finding not found")
		return
	}

	response.OK(c, "Finding retrieved", finding)
}

func Create(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	var req findingInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if msg := validateFindingInput(req, true); msg != "" {
		response.BadRequest(c, msg)
		return
	}

	riskRating := req.RiskRating
	if riskRating == "" {
		riskRating = "medium"
	}

	finding := database.Finding{
		AuditProjectID:           projectID,
		SubjectArea:              req.SubjectArea,
		FindingCategory:          req.FindingCategory,
		CriteriaText:             req.CriteriaText,
		RiskType:                 req.RiskType,
		RiskRating:               riskRating,
		ConditionText:            req.ConditionText,
		ImpactPotentialRisk:      req.ImpactPotentialRisk,
		AuditeeResponseCondition: req.AuditeeResponseCondition,
		CauseKebijakan:           req.CauseKebijakan,
		CauseSistem:              req.CauseSistem,
		CauseSDM:                 req.CauseSDM,
		CauseEksternal:           req.CauseEksternal,
		RecKebijakan:             req.RecKebijakan,
		RecSistem:                req.RecSistem,
		RecSDM:                   req.RecSDM,
		RecEksternal:             req.RecEksternal,
		AuditeePIC:               req.AuditeePIC,
		DeadlineDate:             parseDate(req.DeadlineDate),
		Status:                   "draft",
		CreatedByID:              userID,
	}
	if req.ImpactQuantity != nil {
		finding.ImpactQuantity = *req.ImpactQuantity
	}
	if req.ImpactLossValue != nil {
		finding.ImpactLossValue = *req.ImpactLossValue
	}

	if req.ChecklistExecutionID != nil && *req.ChecklistExecutionID != "" {
		execID, err := uuid.Parse(*req.ChecklistExecutionID)
		if err == nil {
			finding.ChecklistExecutionID = &execID
		}
	}

	if err := database.DB.Create(&finding).Error; err != nil {
		response.InternalError(c, "Failed to create finding")
		return
	}

	database.DB.Preload("CreatedBy").Preload("ChecklistExecution.AuditChecklist").First(&finding, "id = ?", finding.ID)
	response.Created(c, "Finding created", finding)
}

func Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid finding ID")
		return
	}

	var finding database.Finding
	if err := database.DB.First(&finding, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Finding not found")
		return
	}

	isDraftEdit := finding.Status == "draft" || finding.Status == "need_revision"
	// Once the condition/impact baseline is final_approved it stays locked, but the
	// auditor must still be able to come back and add Penyebab & Rekomendasi before
	// recording the auditee's response to the recommendation (LHA stage 2).
	isRecommendationOnlyEdit := finding.Status == "final_approved"

	if !isDraftEdit && !isRecommendationOnlyEdit {
		response.BadRequest(c, "Cannot edit a finding in its current status")
		return
	}

	var req findingInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	var updates map[string]interface{}

	if isDraftEdit {
		if msg := validateFindingInput(req, true); msg != "" {
			response.BadRequest(c, msg)
			return
		}

		// Full replace: the edit form always submits the complete current state,
		// so an emptied field (e.g. a removed cause/recommendation row) must clear the column.
		updates = map[string]interface{}{
			"subject_area":               req.SubjectArea,
			"finding_category":           req.FindingCategory,
			"criteria_text":              req.CriteriaText,
			"risk_type":                  req.RiskType,
			"risk_rating":                req.RiskRating,
			"condition_text":             req.ConditionText,
			"impact_potential_risk":      req.ImpactPotentialRisk,
			"auditee_response_condition": req.AuditeeResponseCondition,
			"auditee_pic":                req.AuditeePIC,
			"deadline_date":              parseDate(req.DeadlineDate),
		}
		if req.ImpactQuantity != nil {
			updates["impact_quantity"] = *req.ImpactQuantity
		}
		if req.ImpactLossValue != nil {
			updates["impact_loss_value"] = *req.ImpactLossValue
		}
	} else {
		// Recommendation-only edit: the approved condition/impact baseline is locked;
		// only Penyebab, Rekomendasi, PIC, and deadline may still change.
		updates = map[string]interface{}{
			"auditee_pic":   req.AuditeePIC,
			"deadline_date": parseDate(req.DeadlineDate),
		}
	}

	updates["cause_kebijakan"] = req.CauseKebijakan
	updates["cause_sistem"] = req.CauseSistem
	updates["cause_sdm"] = req.CauseSDM
	updates["cause_eksternal"] = req.CauseEksternal
	updates["rec_kebijakan"] = req.RecKebijakan
	updates["rec_sistem"] = req.RecSistem
	updates["rec_sdm"] = req.RecSDM
	updates["rec_eksternal"] = req.RecEksternal

	database.DB.Model(&finding).Updates(updates)
	database.DB.Preload("CreatedBy").Preload("ChecklistExecution.AuditChecklist").Preload("Attachments").First(&finding, "id = ?", finding.ID)
	response.OK(c, "Finding updated", finding)
}

func Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid finding ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	role, _ := c.Get("user_role")

	var finding database.Finding
	if err := database.DB.First(&finding, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Finding not found")
		return
	}

	if role != "admin" && finding.CreatedByID != userID {
		response.Forbidden(c, "Cannot delete another user's finding")
		return
	}

	if finding.Status != "draft" {
		response.BadRequest(c, "Cannot delete a finding that has been submitted")
		return
	}

	var attachments []database.FindingAttachment
	database.DB.Where("finding_id = ?", id).Find(&attachments)
	for _, a := range attachments {
		if a.DriveFileID != "" {
			if err := drive.DeleteFile(a.DriveFileID); err != nil {
				log.Printf("Drive: delete file %s: %v", a.DriveFileID, err)
			}
		}
	}
	database.DB.Where("finding_id = ?", id).Delete(&database.FindingAttachment{})

	database.DB.Delete(&finding)
	response.OK(c, "Finding deleted", nil)
}

func Submit(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid finding ID")
		return
	}

	var finding database.Finding
	if err := database.DB.Preload("AuditProject").First(&finding, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Finding not found")
		return
	}

	if finding.Status != "draft" && finding.Status != "need_revision" {
		response.BadRequest(c, "Finding is not in draft or need_revision status")
		return
	}

	if msg := findingCompletionGap(finding); msg != "" {
		response.BadRequest(c, msg)
		return
	}

	var attachmentCount int64
	database.DB.Model(&database.FindingAttachment{}).Where("finding_id = ?", finding.ID).Count(&attachmentCount)
	if attachmentCount == 0 {
		response.BadRequest(c, "Lampiran minimal 1 file diperlukan sebelum submit untuk review")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	now := time.Now()

	database.DB.Model(&finding).Updates(map[string]interface{}{
		"status":       "submitted",
		"submitted_at": now,
	})

	approval := database.ApprovalRequest{
		EntityType:        "finding",
		EntityID:          finding.ID,
		ApprovalStage:     "spv",
		RequestedByID:     userID,
		CurrentApproverID: &finding.AuditProject.SPVID,
		Status:            "pending",
		SubmittedAt:       &now,
	}
	database.DB.Create(&approval)

	response.OK(c, "Finding submitted for review", finding)
}

func Approve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid finding ID")
		return
	}

	var req struct {
		Comments string `json:"comments"`
	}
	c.ShouldBindJSON(&req)

	var finding database.Finding
	if err := database.DB.Preload("AuditProject").First(&finding, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Finding not found")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")
	approverID, _ := uuid.Parse(userIDStr.(string))
	now := time.Now()

	var approvalRequest database.ApprovalRequest
	database.DB.Where("entity_id = ? AND entity_type = 'finding' AND status = 'pending'", id).First(&approvalRequest)

	if approvalRequest.ID == uuid.Nil {
		response.BadRequest(c, "No pending approval request found")
		return
	}

	// Enforce the chain strictly: only the specific person currently assigned at
	// this stage may approve — SPV must clear it before Dept Head can act, and so on.
	if approvalRequest.CurrentApproverID == nil || *approvalRequest.CurrentApproverID != approverID {
		response.Forbidden(c, "Anda bukan approver yang ditugaskan untuk tahap ini")
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

	var nextStatus, nextStage string
	var nextApproverID *uuid.UUID

	switch userRole {
	case "spv":
		if finding.AuditProject.DeptHeadID != nil {
			nextStatus = "approved_spv"
			nextStage = "dept_head"
			nextApproverID = finding.AuditProject.DeptHeadID
		} else if finding.AuditProject.DivHeadID != nil {
			nextStatus = "approved_spv"
			nextStage = "div_head"
			nextApproverID = finding.AuditProject.DivHeadID
		} else {
			nextStatus = "final_approved"
		}
	case "dept_head":
		if finding.AuditProject.DivHeadID != nil {
			nextStatus = "approved_dept_head"
			nextStage = "div_head"
			nextApproverID = finding.AuditProject.DivHeadID
		} else {
			nextStatus = "final_approved"
		}
	case "div_head":
		nextStatus = "final_approved"
	default:
		nextStatus = "final_approved"
	}

	database.DB.Model(&approvalRequest).Updates(map[string]interface{}{
		"status":       "approved",
		"completed_at": now,
	})

	if nextStatus == "final_approved" {
		database.DB.Model(&finding).Update("status", "final_approved")
		database.DB.Model(&database.AuditProject{}).
			Where("id = ? AND status = 'fieldwork'", finding.AuditProjectID).
			Update("status", "draft_finding")
	} else {
		database.DB.Model(&finding).Update("status", nextStatus)

		newApproval := database.ApprovalRequest{
			EntityType:        "finding",
			EntityID:          finding.ID,
			ApprovalStage:     nextStage,
			RequestedByID:     approverID,
			CurrentApproverID: nextApproverID,
			Status:            "pending",
			SubmittedAt:       &now,
		}
		database.DB.Create(&newApproval)
	}

	response.OK(c, "Finding approved", nil)
}

func Reject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid finding ID")
		return
	}

	var req struct {
		Comments string `json:"comments" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Comments are required for rejection")
		return
	}

	var finding database.Finding
	if err := database.DB.First(&finding, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Finding not found")
		return
	}

	userIDStr, _ := c.Get("user_id")
	approverID, _ := uuid.Parse(userIDStr.(string))
	now := time.Now()

	var approvalRequest database.ApprovalRequest
	database.DB.Where("entity_id = ? AND entity_type = 'finding' AND status = 'pending'", id).First(&approvalRequest)

	if approvalRequest.ID != uuid.Nil {
		if approvalRequest.CurrentApproverID == nil || *approvalRequest.CurrentApproverID != approverID {
			response.Forbidden(c, "Anda bukan approver yang ditugaskan untuk tahap ini")
			return
		}

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
	}

	database.DB.Model(&finding).Update("status", "need_revision")
	response.OK(c, "Finding rejected, returned to auditor", nil)
}

// RecordAuditeeResponse mencatat tanggapan auditee atas rekomendasi (per kategori),
// PIC penyelesaian, dan deadline — diisi setelah rekomendasi final disepakati.
func RecordAuditeeResponse(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid finding ID")
		return
	}

	var req struct {
		AuditeeRecKebijakan string `json:"auditee_rec_kebijakan"`
		AuditeeRecSistem    string `json:"auditee_rec_sistem"`
		AuditeeRecSDM       string `json:"auditee_rec_sdm"`
		AuditeeRecEksternal string `json:"auditee_rec_eksternal"`
		AuditeePIC          string `json:"auditee_pic"`
		DeadlineDate        string `json:"deadline_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	var finding database.Finding
	if err := database.DB.First(&finding, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Finding not found")
		return
	}

	if !hasCause(finding) || !hasRecommendation(finding) {
		response.BadRequest(c, "Penyebab dan Rekomendasi harus diisi sebelum mencatat tanggapan auditee")
		return
	}

	updates := map[string]interface{}{
		"status": "auditee_responded",
	}
	if req.AuditeeRecKebijakan != "" {
		updates["auditee_rec_kebijakan"] = req.AuditeeRecKebijakan
	}
	if req.AuditeeRecSistem != "" {
		updates["auditee_rec_sistem"] = req.AuditeeRecSistem
	}
	if req.AuditeeRecSDM != "" {
		updates["auditee_rec_sdm"] = req.AuditeeRecSDM
	}
	if req.AuditeeRecEksternal != "" {
		updates["auditee_rec_eksternal"] = req.AuditeeRecEksternal
	}
	if req.AuditeePIC != "" {
		updates["auditee_pic"] = req.AuditeePIC
	}
	if req.DeadlineDate != "" {
		updates["deadline_date"] = parseDate(req.DeadlineDate)
	}

	database.DB.Model(&finding).Updates(updates)
	database.DB.Preload("CreatedBy").First(&finding, "id = ?", finding.ID)
	response.OK(c, "Auditee response recorded", finding)
}

// --- Attachments (Lampiran) ---

func ListAttachments(c *gin.Context) {
	findingID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid finding ID")
		return
	}

	var attachments []database.FindingAttachment
	database.DB.Preload("UploadedBy").Where("finding_id = ?", findingID).Order("created_at DESC").Find(&attachments)
	response.OK(c, "Attachments retrieved", attachments)
}

func UploadAttachment(c *gin.Context) {
	if !drive.Enabled() {
		response.InternalError(c, "Google Drive integration is not configured")
		return
	}

	findingID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid finding ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	var req struct {
		Title       string `json:"title"`
		FileName    string `json:"file_name"`
		FileSize    int64  `json:"file_size"`
		ContentType string `json:"content_type"`
		FileData    string `json:"file_data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if req.Title == "" {
		response.BadRequest(c, "Title is required")
		return
	}
	if req.FileName == "" || req.FileData == "" {
		response.BadRequest(c, "File is required")
		return
	}

	contentType := req.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	fileBytes, err := base64.StdEncoding.DecodeString(req.FileData)
	if err != nil {
		response.BadRequest(c, "Invalid file data encoding")
		return
	}

	var finding database.Finding
	if err := database.DB.Preload("AuditProject").First(&finding, "id = ?", findingID).Error; err != nil {
		response.NotFound(c, "Finding not found")
		return
	}

	projectFolderID, err := drive.GetOrCreateFolder(drive.RootFolderID, finding.AuditProject.Title)
	if err != nil {
		log.Printf("Drive: create project folder: %v", err)
		response.InternalError(c, "Failed to create project folder in Drive")
		return
	}

	findingsFolderID, err := drive.GetOrCreateFolder(projectFolderID, "Findings")
	if err != nil {
		log.Printf("Drive: create findings folder: %v", err)
		response.InternalError(c, "Failed to create findings folder in Drive")
		return
	}

	folderName := finding.FindingCategory
	if folderName == "" {
		folderName = "Finding " + finding.ID.String()[:8]
	}
	findingFolderID, err := drive.GetOrCreateFolder(findingsFolderID, folderName)
	if err != nil {
		log.Printf("Drive: create finding folder: %v", err)
		response.InternalError(c, "Failed to create finding folder in Drive")
		return
	}

	driveFileID, driveFileURL, err := drive.UploadFile(findingFolderID, req.FileName, bytes.NewReader(fileBytes), contentType)
	if err != nil {
		log.Printf("Drive: upload file: %v", err)
		response.InternalError(c, "Failed to upload file to Google Drive")
		return
	}

	attachment := database.FindingAttachment{
		FindingID:    findingID,
		Title:        req.Title,
		FileName:     req.FileName,
		DriveFileID:  driveFileID,
		DriveFileURL: driveFileURL,
		FileSize:     int64(len(fileBytes)),
		ContentType:  contentType,
		UploadedByID: userID,
	}

	if err := database.DB.Create(&attachment).Error; err != nil {
		if delErr := drive.DeleteFile(driveFileID); delErr != nil {
			log.Printf("Drive: cleanup after DB error: %v", delErr)
		}
		response.InternalError(c, "Failed to save attachment record")
		return
	}

	database.DB.Preload("UploadedBy").First(&attachment, "id = ?", attachment.ID)
	response.Created(c, "Attachment uploaded", attachment)
}

func DeleteAttachment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid attachment ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	role, _ := c.Get("user_role")

	var attachment database.FindingAttachment
	if err := database.DB.First(&attachment, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Attachment not found")
		return
	}

	if role != "admin" && attachment.UploadedByID != userID {
		response.Forbidden(c, "Cannot delete another user's attachment")
		return
	}

	if attachment.DriveFileID != "" {
		if err := drive.DeleteFile(attachment.DriveFileID); err != nil {
			log.Printf("Drive: delete file %s: %v", attachment.DriveFileID, err)
		}
	}

	database.DB.Delete(&attachment)
	response.OK(c, "Attachment deleted", nil)
}
