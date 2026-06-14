package workingpapers

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const uploadDir = "/app/uploads/working-papers"

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
		result[i] = PaperWithURL{
			WorkingPaper: p,
			FileURL:      "/api/v1/uploads/working-papers/" + filepath.Base(p.FilePath),
		}
	}

	response.OK(c, "Working papers retrieved", result)
}

func Upload(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	title := c.PostForm("title")
	if title == "" {
		response.BadRequest(c, "Title is required")
		return
	}

	checklistIDStr := c.PostForm("audit_checklist_id")
	execIDStr := c.PostForm("checklist_execution_id")

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "File is required")
		return
	}
	defer file.Close()

	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		response.InternalError(c, "Failed to create upload directory")
		return
	}

	ext := filepath.Ext(header.Filename)
	uniqueName := fmt.Sprintf("%s_%s%s", time.Now().Format("20060102150405"), uuid.New().String()[:8], ext)
	destPath := filepath.Join(uploadDir, uniqueName)

	dst, err := os.Create(destPath)
	if err != nil {
		response.InternalError(c, "Failed to save file")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		response.InternalError(c, "Failed to write file")
		return
	}

	paper := database.WorkingPaper{
		AuditProjectID: projectID,
		Title:          title,
		FileName:       header.Filename,
		FilePath:       destPath,
		FileSize:       header.Size,
		ContentType:    header.Header.Get("Content-Type"),
		UploadedByID:   userID,
	}

	if checklistIDStr != "" {
		checklistID, err := uuid.Parse(checklistIDStr)
		if err == nil {
			paper.AuditChecklistID = &checklistID
		}
	}
	if execIDStr != "" {
		execID, err := uuid.Parse(execIDStr)
		if err == nil {
			paper.ChecklistExecutionID = &execID
		}
	}

	if err := database.DB.Create(&paper).Error; err != nil {
		os.Remove(destPath)
		response.InternalError(c, "Failed to save working paper record")
		return
	}

	database.DB.Preload("UploadedBy").Preload("AuditChecklist").First(&paper, "id = ?", paper.ID)

	type PaperWithURL struct {
		database.WorkingPaper
		FileURL string `json:"file_url"`
	}
	result := PaperWithURL{
		WorkingPaper: paper,
		FileURL:      "/api/v1/uploads/working-papers/" + uniqueName,
	}

	response.Created(c, "Working paper uploaded", result)
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

	os.Remove(paper.FilePath)
	database.DB.Delete(&paper)
	response.OK(c, "Working paper deleted", nil)
}
