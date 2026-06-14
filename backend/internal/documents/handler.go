package documents

import (
	"fmt"
	"time"

	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var romanMonths = [...]string{"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"}

func generateNumber(docType string, issuedAt time.Time) string {
	year := issuedAt.Year()
	month := int(issuedAt.Month())

	var count int64
	database.DB.Model(&database.AuditDocument{}).
		Where("type = ? AND EXTRACT(YEAR FROM issued_at) = ?", docType, year).
		Count(&count)

	seq := int(count) + 1
	return fmt.Sprintf("%03d/%s/%d/AUDIT", seq, romanMonths[month], year)
}

func IssueDocuments(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	var project database.AuditProject
	if err := database.DB.First(&project, "id = ?", projectID).Error; err != nil {
		response.NotFound(c, "Project not found")
		return
	}
	if project.Status != "approved_audit_program" {
		response.BadRequest(c, "Audit program belum mendapat persetujuan final")
		return
	}

	var existingCount int64
	database.DB.Model(&database.AuditDocument{}).Where("audit_project_id = ?", projectID).Count(&existingCount)
	if existingCount > 0 {
		response.BadRequest(c, "Dokumen STP & SPA sudah pernah diterbitkan untuk project ini")
		return
	}

	now := time.Now()
	stpNumber := generateNumber("STP", now)
	spaNumber := generateNumber("SPA", now)

	stp := database.AuditDocument{
		AuditProjectID: projectID,
		Type:           "STP",
		DocumentNumber: stpNumber,
		IssuedAt:       now,
		IssuedByID:     userID,
	}
	spa := database.AuditDocument{
		AuditProjectID: projectID,
		Type:           "SPA",
		DocumentNumber: spaNumber,
		IssuedAt:       now,
		IssuedByID:     userID,
	}

	database.DB.Create(&stp)
	database.DB.Create(&spa)

	// Move project to fieldwork stage
	database.DB.Model(&project).Update("status", "fieldwork")

	database.DB.Preload("IssuedBy").First(&stp, "id = ?", stp.ID)
	database.DB.Preload("IssuedBy").First(&spa, "id = ?", spa.ID)

	response.Created(c, "Dokumen STP & SPA berhasil diterbitkan", gin.H{
		"stp": stp,
		"spa": spa,
	})
}

func ListDocuments(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var docs []database.AuditDocument
	database.DB.Preload("IssuedBy").
		Where("audit_project_id = ?", projectID).
		Order("created_at ASC").
		Find(&docs)

	response.OK(c, "Documents retrieved", docs)
}
