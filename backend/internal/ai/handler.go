package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// --- Rate limiter: max 10 requests per minute per user ---

var (
	rateMu       sync.Mutex
	userRequests = map[string][]time.Time{}
)

func checkRateLimit(userID string) bool {
	rateMu.Lock()
	defer rateMu.Unlock()

	now := time.Now()
	windowStart := now.Add(-time.Minute)

	var recent []time.Time
	for _, t := range userRequests[userID] {
		if t.After(windowStart) {
			recent = append(recent, t)
		}
	}
	if len(recent) >= 10 {
		userRequests[userID] = recent
		return false
	}
	userRequests[userID] = append(recent, now)
	return true
}

// --- Gemini API types ---

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiSchemaProperty struct {
	Type  string `json:"type"`
	Items *geminiSchemaProperty `json:"items,omitempty"`
}

type geminiSchema struct {
	Type       string                          `json:"type"`
	Properties map[string]geminiSchemaProperty `json:"properties,omitempty"`
	Required   []string                        `json:"required,omitempty"`
	Items      *geminiSchema                   `json:"items,omitempty"`
}

type geminiGenConfig struct {
	ResponseMIMEType string       `json:"responseMimeType"`
	ResponseSchema   geminiSchema `json:"responseSchema"`
}

type geminiRequest struct {
	Contents         []geminiContent `json:"contents"`
	GenerationConfig geminiGenConfig `json:"generationConfig"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error"`
}

// --- AI output types ---

type AIChecklist struct {
	Title            string `json:"title"`
	Objective        string `json:"objective"`
	ProcedureText    string `json:"procedure_text"`
	RequiredData     string `json:"required_data"`
	ExpectedEvidence string `json:"expected_evidence"`
	IsMandatory      bool   `json:"is_mandatory"`
	SourceCriteria   string `json:"source_criteria"`
}

type AIGeneratedProgram struct {
	Objectives      string        `json:"objectives"`
	Scope           string        `json:"scope"`
	RiskAnalysis    string        `json:"risk_analysis"`
	DataRequired    string        `json:"data_required"`
	CriteriaSummary string        `json:"criteria_summary"`
	Checklists      []AIChecklist `json:"checklists"`
}

// --- Handler ---

func GenerateAuditProgram(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))

	if !checkRateLimit(userID.String()) {
		response.BadRequest(c, "Terlalu banyak permintaan AI. Coba lagi dalam 1 menit.")
		return
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		response.InternalError(c, "Gemini API key tidak dikonfigurasi")
		return
	}

	defaultModel := os.Getenv("GEMINI_MODEL")
	if defaultModel == "" {
		defaultModel = "gemini-2.5-flash"
	}

	var req struct {
		Scope     string `json:"scope" binding:"required"`
		Areas     string `json:"areas" binding:"required"`
		Auditee   string `json:"auditee"`
		Theme     string `json:"theme"`
		Period    string `json:"period"`
		Criteria  string `json:"criteria"`
		Risks     string `json:"risks"`
		Model     string `json:"model"`
		ProjectID string `json:"project_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	model := req.Model
	if model == "" {
		model = defaultModel
	}

	prompt := buildPrompt(req.Scope, req.Areas, req.Auditee, req.Theme, req.Period, req.Criteria, req.Risks)

	responseSchema := geminiSchema{
		Type: "object",
		Properties: map[string]geminiSchemaProperty{
			"objectives":       {Type: "string"},
			"scope":            {Type: "string"},
			"risk_analysis":    {Type: "string"},
			"data_required":    {Type: "string"},
			"criteria_summary": {Type: "string"},
			"checklists": {
				Type: "array",
				Items: &geminiSchemaProperty{Type: "object"},
			},
		},
		Required: []string{"objectives", "scope", "risk_analysis", "data_required", "criteria_summary", "checklists"},
	}

	geminiReq := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
		GenerationConfig: geminiGenConfig{
			ResponseMIMEType: "application/json",
			ResponseSchema:   responseSchema,
		},
	}

	body, _ := json.Marshal(geminiReq)
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

	httpResp, err := http.Post(url, "application/json", bytes.NewReader(body))

	var logStatus = "success"
	var logError = ""
	var logResponse = ""

	if err != nil {
		logStatus = "error"
		logError = err.Error()
		saveLog(userID, req.ProjectID, model, prompt, "", logStatus, logError)
		response.InternalError(c, "Gagal menghubungi Gemini API")
		return
	}
	defer httpResp.Body.Close()

	respBytes, _ := io.ReadAll(httpResp.Body)
	logResponse = string(respBytes)

	var geminiResp geminiResponse
	if err := json.Unmarshal(respBytes, &geminiResp); err != nil {
		logStatus = "error"
		logError = "Failed to parse Gemini response"
		saveLog(userID, req.ProjectID, model, prompt, logResponse, logStatus, logError)
		response.InternalError(c, "Gagal memproses respons Gemini API")
		return
	}

	if geminiResp.Error != nil {
		logStatus = "error"
		logError = geminiResp.Error.Message
		saveLog(userID, req.ProjectID, model, prompt, logResponse, logStatus, logError)
		response.InternalError(c, fmt.Sprintf("Gemini API error: %s", geminiResp.Error.Message))
		return
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		logStatus = "error"
		logError = "No candidates in response"
		saveLog(userID, req.ProjectID, model, prompt, logResponse, logStatus, logError)
		response.InternalError(c, "Gemini tidak menghasilkan output")
		return
	}

	jsonText := geminiResp.Candidates[0].Content.Parts[0].Text

	var generated AIGeneratedProgram
	if err := json.Unmarshal([]byte(jsonText), &generated); err != nil {
		// Try to parse the response as a raw JSON text fallback
		logStatus = "error"
		logError = fmt.Sprintf("Failed to parse AI output JSON: %s", err.Error())
		saveLog(userID, req.ProjectID, model, prompt, logResponse, logStatus, logError)
		response.InternalError(c, "Output AI tidak dapat diproses. Coba lagi.")
		return
	}

	saveLog(userID, req.ProjectID, model, prompt, logResponse, logStatus, logError)
	response.OK(c, "AI draft generated", generated)
}

func buildPrompt(scope, areas, auditee, theme, period, criteria, risks string) string {
	info := fmt.Sprintf(`Kamu adalah asisten audit internal yang berpengalaman. Berdasarkan informasi berikut, buatkan draft Audit Program lengkap beserta checklist pemeriksaan.

Informasi Proyek Audit:
- Scope Pemeriksaan: %s
- Area/Bagian yang Dicakup: %s`, scope, areas)

	if auditee != "" {
		info += fmt.Sprintf("\n- Auditee: %s", auditee)
	}
	if theme != "" {
		info += fmt.Sprintf("\n- Tema Audit: %s", theme)
	}
	if period != "" {
		info += fmt.Sprintf("\n- Periode: %s", period)
	}
	if criteria != "" {
		info += fmt.Sprintf("\n- Kriteria/Regulasi Terkait: %s", criteria)
	}
	if risks != "" {
		info += fmt.Sprintf("\n- Risiko Utama: %s", risks)
	}

	info += `

Buatkan draft audit program dalam JSON dengan field:
- objectives: tujuan pemeriksaan yang jelas dan terukur (paragraf)
- scope: lingkup yang sudah dirapikan secara profesional (paragraf)
- risk_analysis: analisis risiko berdasarkan area yang dicakup (paragraf)
- data_required: daftar data/dokumen yang diperlukan (paragraf atau bullet)
- criteria_summary: ringkasan kriteria/standar yang digunakan (paragraf)
- checklists: array minimal 5 checklist, masing-masing berisi:
  - title: judul singkat checklist
  - objective: tujuan pemeriksaan item ini
  - procedure_text: prosedur langkah-langkah audit
  - required_data: data yang diperlukan untuk item ini
  - expected_evidence: bukti yang diharapkan
  - is_mandatory: true jika wajib, false jika tambahan
  - source_criteria: sumber kriteria (misal SOP-001, POJK 12/2021, dll)

Gunakan bahasa Indonesia yang profesional dan formal. Buat checklist yang relevan dan komprehensif sesuai scope dan area.`

	return info
}

func saveLog(userID uuid.UUID, projectIDStr, model, prompt, resp, status, errMsg string) {
	log := database.AILog{
		UserID:       userID,
		ModelUsed:    model,
		Prompt:       prompt,
		Response:     resp,
		Status:       status,
		ErrorMessage: errMsg,
	}
	if projectIDStr != "" {
		pid, err := uuid.Parse(projectIDStr)
		if err == nil {
			log.ProjectID = &pid
		}
	}
	database.DB.Create(&log)
}
