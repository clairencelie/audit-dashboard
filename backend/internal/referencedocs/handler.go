package referencedocs

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

const driveFolder = "Dokumen Referensi"

var validCategories = map[string]bool{
	"Regulasi":      true,
	"SOP":           true,
	"Standar Audit": true,
	"Kebijakan":     true,
	"Lainnya":       true,
}

func List(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var docs []database.ReferenceDocument
	database.DB.
		Preload("UploadedBy").
		Where("audit_project_id = ?", projectID).
		Order("category ASC, created_at DESC").
		Find(&docs)

	response.OK(c, "Reference documents retrieved", docs)
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
		Title       string `json:"title"`
		Category    string `json:"category"`
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
	if req.FileName == "" {
		response.BadRequest(c, "File name is required")
		return
	}
	if req.FileData == "" {
		response.BadRequest(c, "File data is required")
		return
	}

	category := req.Category
	if !validCategories[category] {
		category = "Lainnya"
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

	projectFolderID, err := drive.GetOrCreateFolder(drive.RootFolderID, project.Title)
	if err != nil {
		log.Printf("Drive: create project folder: %v", err)
		response.InternalError(c, "Failed to create project folder in Drive")
		return
	}

	refFolderID, err := drive.GetOrCreateFolder(projectFolderID, driveFolder)
	if err != nil {
		log.Printf("Drive: create reference folder: %v", err)
		response.InternalError(c, "Failed to create reference folder in Drive")
		return
	}

	driveFileID, driveFileURL, err := drive.UploadFile(refFolderID, req.FileName, bytes.NewReader(fileBytes), contentType)
	if err != nil {
		log.Printf("Drive: upload reference doc: %v", err)
		response.InternalError(c, "Failed to upload file to Google Drive")
		return
	}

	doc := database.ReferenceDocument{
		AuditProjectID: projectID,
		Title:          req.Title,
		Category:       category,
		FileName:       req.FileName,
		DriveFileID:    driveFileID,
		DriveFileURL:   driveFileURL,
		FileSize:       int64(len(fileBytes)),
		ContentType:    contentType,
		UploadedByID:   userID,
	}

	if err := database.DB.Create(&doc).Error; err != nil {
		if delErr := drive.DeleteFile(driveFileID); delErr != nil {
			log.Printf("Drive: cleanup after DB error: %v", delErr)
		}
		response.InternalError(c, "Failed to save reference document record")
		return
	}

	database.DB.Preload("UploadedBy").First(&doc, "id = ?", doc.ID)
	response.Created(c, "Reference document uploaded", doc)
}

func Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid document ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	role, _ := c.Get("role")

	var doc database.ReferenceDocument
	if err := database.DB.First(&doc, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Reference document not found")
		return
	}

	if role != "admin" && doc.UploadedByID != userID {
		response.Forbidden(c, "Cannot delete another user's document")
		return
	}

	if doc.DriveFileID != "" {
		if err := drive.DeleteFile(doc.DriveFileID); err != nil {
			log.Printf("Drive: delete reference doc %s: %v", doc.DriveFileID, err)
		}
	}
	if doc.FilePath != "" {
		os.Remove(doc.FilePath)
	}

	database.DB.Delete(&doc)
	response.OK(c, "Reference document deleted", nil)
}
