package workingpapers

import (
	"bytes"
	"encoding/base64"
	"log"
	"os"

	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/internal/drive"
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

	var papers []database.WorkingPaper
	database.DB.
		Preload("UploadedBy").
		Preload("AuditChecklist").
		Where("audit_project_id = ?", projectID).
		Order("created_at DESC").
		Find(&papers)

	type PaperWithURL struct {
		database.WorkingPaper
		FileURL string `json:"file_url"`
	}

	result := make([]PaperWithURL, len(papers))
	for i, p := range papers {
		fileURL := p.DriveFileURL
		if fileURL == "" && p.FilePath != "" {
			fileURL = "/api/v1/uploads/working-papers/" + p.FilePath
		}
		result[i] = PaperWithURL{WorkingPaper: p, FileURL: fileURL}
	}

	response.OK(c, "Working papers retrieved", result)
}

func Upload(c *gin.Context) {
	if !drive.Enabled() {
		response.InternalError(c, "Google Drive integration is not configured")
		return
	}

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	var req struct {
		Title               string `json:"title"`
		AuditChecklistID    string `json:"audit_checklist_id"`
		ChecklistExecutionID string `json:"checklist_execution_id"`
		FileName            string `json:"file_name"`
		FileSize            int64  `json:"file_size"`
		ContentType         string `json:"content_type"`
		FileData            string `json:"file_data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if req.Title == "" {
		response.BadRequest(c, "Title is required")
		return
	}
	if req.FileName == "" {
		response.BadRequest(c, "File name is required")
		return
	}
	if req.FileData == "" {
		response.BadRequest(c, "File data is required")
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

	var project database.AuditProject
	if err := database.DB.First(&project, "id = ?", projectID).Error; err != nil {
		response.NotFound(c, "Project not found")
		return
	}

	checklistFolder := "General"
	if req.AuditChecklistID != "" {
		var checklist database.AuditChecklist
		if err := database.DB.First(&checklist, "id = ?", req.AuditChecklistID).Error; err == nil {
			checklistFolder = checklist.Title
		}
	}

	projectFolderID, err := drive.GetOrCreateFolder(drive.RootFolderID, project.Title)
	if err != nil {
		log.Printf("Drive: create project folder: %v", err)
		response.InternalError(c, "Failed to create project folder in Drive")
		return
	}

	checklistFolderID, err := drive.GetOrCreateFolder(projectFolderID, checklistFolder)
	if err != nil {
		log.Printf("Drive: create checklist folder: %v", err)
		response.InternalError(c, "Failed to create checklist folder in Drive")
		return
	}

	driveFileID, driveFileURL, err := drive.UploadFile(checklistFolderID, req.FileName, bytes.NewReader(fileBytes), contentType)
	if err != nil {
		log.Printf("Drive: upload file: %v", err)
		response.InternalError(c, "Failed to upload file to Google Drive")
		return
	}

	paper := database.WorkingPaper{
		AuditProjectID: projectID,
		Title:          req.Title,
		FileName:       req.FileName,
		FilePath:       "",
		DriveFileID:    driveFileID,
		DriveFileURL:   driveFileURL,
		FileSize:       int64(len(fileBytes)),
		ContentType:    contentType,
		UploadedByID:   userID,
	}

	if req.AuditChecklistID != "" {
		checklistID, err := uuid.Parse(req.AuditChecklistID)
		if err == nil {
			paper.AuditChecklistID = &checklistID
		}
	}
	if req.ChecklistExecutionID != "" {
		execID, err := uuid.Parse(req.ChecklistExecutionID)
		if err == nil {
			paper.ChecklistExecutionID = &execID
		}
	}

	if err := database.DB.Create(&paper).Error; err != nil {
		if delErr := drive.DeleteFile(driveFileID); delErr != nil {
			log.Printf("Drive: cleanup after DB error: %v", delErr)
		}
		response.InternalError(c, "Failed to save working paper record")
		return
	}

	database.DB.Preload("UploadedBy").Preload("AuditChecklist").First(&paper, "id = ?", paper.ID)

	type PaperWithURL struct {
		database.WorkingPaper
		FileURL string `json:"file_url"`
	}
	response.Created(c, "Working paper uploaded", PaperWithURL{
		WorkingPaper: paper,
		FileURL:      driveFileURL,
	})
}

func Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid working paper ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	role, _ := c.Get("role")

	var paper database.WorkingPaper
	if err := database.DB.First(&paper, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Working paper not found")
		return
	}

	if role != "admin" && paper.UploadedByID != userID {
		response.Forbidden(c, "Cannot delete another user's working paper")
		return
	}

	if paper.DriveFileID != "" {
		if err := drive.DeleteFile(paper.DriveFileID); err != nil {
			log.Printf("Drive: delete file %s: %v", paper.DriveFileID, err)
		}
	}

	if paper.FilePath != "" {
		os.Remove(paper.FilePath)
	}

	database.DB.Delete(&paper)
	response.OK(c, "Working paper deleted", nil)
}
