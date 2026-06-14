package database

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// --- Base ---

type Base struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (b *Base) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// --- Role ---

type Role struct {
	Base
	Name        string `gorm:"uniqueIndex;not null" json:"name"`
	Description string `json:"description"`
	Users       []User `gorm:"foreignKey:RoleID" json:"-"`
}

// --- Department ---

type Department struct {
	Base
	Name        string       `gorm:"not null" json:"name"`
	ParentID    *uuid.UUID   `json:"parent_id"`
	Parent      *Department  `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children    []Department `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	Users       []User       `gorm:"foreignKey:DepartmentID" json:"-"`
}

// --- User ---

type User struct {
	Base
	Name         string      `gorm:"not null" json:"name"`
	Email        string      `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string      `gorm:"not null" json:"-"`
	RoleID       uuid.UUID   `gorm:"type:uuid;not null" json:"role_id"`
	Role         Role        `gorm:"foreignKey:RoleID" json:"role"`
	DepartmentID *uuid.UUID  `gorm:"type:uuid" json:"department_id"`
	Department   *Department `gorm:"foreignKey:DepartmentID" json:"department,omitempty"`
	Position     string      `json:"position"`
	IsActive     bool        `gorm:"default:true" json:"is_active"`
}

// --- Auditee ---

type Auditee struct {
	Base
	Name          string     `gorm:"not null" json:"name"`
	Type          string     `json:"type"`
	DepartmentID  *uuid.UUID `gorm:"type:uuid" json:"department_id"`
	Department    *Department `gorm:"foreignKey:DepartmentID" json:"department,omitempty"`
	ContactPerson string     `json:"contact_person"`
	Email         string     `json:"email"`
	IsActive      bool       `gorm:"default:true" json:"is_active"`
}

// --- Annual Audit Plan (RKAT) ---

type AnnualAuditPlan struct {
	Base
	Year          int            `gorm:"not null" json:"year"`
	Title         string         `gorm:"not null" json:"title"`
	Status        string         `gorm:"default:'draft'" json:"status"`
	CreatedByID   uuid.UUID      `gorm:"type:uuid;not null" json:"created_by_id"`
	CreatedBy     User           `gorm:"foreignKey:CreatedByID" json:"created_by"`
	ApprovedByID  *uuid.UUID     `gorm:"type:uuid" json:"approved_by_id"`
	ApprovedBy    *User          `gorm:"foreignKey:ApprovedByID" json:"approved_by,omitempty"`
	ApprovedAt    *time.Time     `json:"approved_at"`
	AuditProjects []AuditProject `gorm:"foreignKey:AnnualAuditPlanID" json:"audit_projects,omitempty"`
}

// --- Audit Project ---

type AuditProject struct {
	Base
	AnnualAuditPlanID *uuid.UUID      `gorm:"type:uuid" json:"annual_audit_plan_id"`
	AnnualAuditPlan   *AnnualAuditPlan `gorm:"foreignKey:AnnualAuditPlanID" json:"annual_audit_plan,omitempty"`
	Title             string          `gorm:"not null" json:"title"`
	AuditTheme        string          `json:"audit_theme"`
	AuditeeID         uuid.UUID       `gorm:"type:uuid;not null" json:"auditee_id"`
	Auditee           Auditee         `gorm:"foreignKey:AuditeeID" json:"auditee"`
	AuditorID         uuid.UUID       `gorm:"type:uuid;not null" json:"auditor_id"`
	Auditor           User            `gorm:"foreignKey:AuditorID" json:"auditor"`
	SPVID             uuid.UUID       `gorm:"type:uuid;not null" json:"spv_id"`
	SPV               User            `gorm:"foreignKey:SPVID" json:"spv"`
	DeptHeadID        *uuid.UUID      `gorm:"type:uuid" json:"dept_head_id"`
	DeptHead          *User           `gorm:"foreignKey:DeptHeadID" json:"dept_head,omitempty"`
	DivHeadID         *uuid.UUID      `gorm:"type:uuid" json:"div_head_id"`
	DivHead           *User           `gorm:"foreignKey:DivHeadID" json:"div_head,omitempty"`
	Priority          string          `gorm:"default:'medium'" json:"priority"`
	RiskLevel         string          `gorm:"default:'medium'" json:"risk_level"`
	PlannedStartDate  *time.Time      `json:"planned_start_date"`
	PlannedEndDate    *time.Time      `json:"planned_end_date"`
	ActualStartDate   *time.Time      `json:"actual_start_date"`
	ActualEndDate     *time.Time      `json:"actual_end_date"`
	Status            string          `gorm:"default:'draft_audit_program'" json:"status"`
	HealthScore       int             `gorm:"default:100" json:"health_score"`
	AuditPrograms     []AuditProgram  `gorm:"foreignKey:AuditProjectID" json:"audit_programs,omitempty"`
}

// --- Audit Program ---

type AuditProgram struct {
	Base
	AuditProjectID    uuid.UUID        `gorm:"type:uuid;not null" json:"audit_project_id"`
	AuditProject      AuditProject     `gorm:"foreignKey:AuditProjectID" json:"audit_project"`
	Version           int              `gorm:"default:1" json:"version"`
	AuditPeriodStart  *time.Time       `json:"audit_period_start"`
	AuditPeriodEnd    *time.Time       `json:"audit_period_end"`
	DataPeriodStart   *time.Time       `json:"data_period_start"`
	DataPeriodEnd     *time.Time       `json:"data_period_end"`
	Scope             string           `json:"scope"`
	Objectives        string           `json:"objectives"`
	CriteriaSummary   string           `json:"criteria_summary"`
	RiskAnalysis      string           `json:"risk_analysis"`
	DataRequired      string           `json:"data_required"`
	Status            string           `gorm:"default:'draft'" json:"status"`
	IsLocked          bool             `gorm:"default:false" json:"is_locked"`
	CreatedByID       uuid.UUID        `gorm:"type:uuid;not null" json:"created_by_id"`
	CreatedBy         User             `gorm:"foreignKey:CreatedByID" json:"created_by"`
	SubmittedAt       *time.Time       `json:"submitted_at"`
	ApprovedAt        *time.Time       `json:"approved_at"`
	Checklists        []AuditChecklist `gorm:"foreignKey:AuditProgramID" json:"checklists,omitempty"`
	ApprovalRequests  []ApprovalRequest `gorm:"polymorphic:Entity;polymorphicValue:audit_program" json:"approval_requests,omitempty"`
}

// --- Audit Checklist ---

type AuditChecklist struct {
	Base
	AuditProgramID  uuid.UUID `gorm:"type:uuid;not null" json:"audit_program_id"`
	AuditProgram    AuditProgram `gorm:"foreignKey:AuditProgramID" json:"-"`
	Title           string    `gorm:"not null" json:"title"`
	Objective       string    `json:"objective"`
	ProcedureText   string    `json:"procedure_text"`
	RequiredData    string    `json:"required_data"`
	ExpectedEvidence string   `json:"expected_evidence"`
	IsMandatory     bool      `gorm:"default:true" json:"is_mandatory"`
	SourceCriteria  string    `json:"source_criteria"`
	SequenceNo      int       `gorm:"default:1" json:"sequence_no"`
	ChecklistExecutions []ChecklistExecution `gorm:"foreignKey:AuditChecklistID" json:"executions,omitempty"`
}

// --- Checklist Execution ---

type ChecklistExecution struct {
	Base
	AuditProjectID      uuid.UUID       `gorm:"type:uuid;not null" json:"audit_project_id"`
	AuditChecklistID    uuid.UUID       `gorm:"type:uuid;not null" json:"audit_checklist_id"`
	AuditChecklist      AuditChecklist  `gorm:"foreignKey:AuditChecklistID" json:"audit_checklist"`
	Status              string          `gorm:"default:'not_started'" json:"status"`
	ProgressPercentage  int             `gorm:"default:0" json:"progress_percentage"`
	ResultSummary       string          `json:"result_summary"`
	ExceptionFound      bool            `gorm:"default:false" json:"exception_found"`
	PotentialFinding    bool            `gorm:"default:false" json:"potential_finding"`
	JustificationIfNotDone string       `json:"justification_if_not_done"`
	CompletedAt         *time.Time      `json:"completed_at"`
	ReviewedByID        *uuid.UUID      `gorm:"type:uuid" json:"reviewed_by_id"`
	ReviewedBy          *User           `gorm:"foreignKey:ReviewedByID" json:"reviewed_by,omitempty"`
	ReviewedAt          *time.Time      `json:"reviewed_at"`
	ReviewerNote        string          `json:"reviewer_note"`
}

// --- Approval Request ---

type ApprovalRequest struct {
	Base
	EntityType        string     `gorm:"not null" json:"entity_type"`
	EntityID          uuid.UUID  `gorm:"type:uuid;not null" json:"entity_id"`
	ApprovalStage     string     `gorm:"not null" json:"approval_stage"`
	RequestedByID     uuid.UUID  `gorm:"type:uuid;not null" json:"requested_by_id"`
	RequestedBy       User       `gorm:"foreignKey:RequestedByID" json:"requested_by"`
	CurrentApproverID *uuid.UUID `gorm:"type:uuid" json:"current_approver_id"`
	CurrentApprover   *User      `gorm:"foreignKey:CurrentApproverID" json:"current_approver,omitempty"`
	Status            string     `gorm:"default:'pending'" json:"status"`
	SubmittedAt       *time.Time `json:"submitted_at"`
	CompletedAt       *time.Time `json:"completed_at"`
	Histories         []ApprovalHistory `gorm:"foreignKey:ApprovalRequestID" json:"histories,omitempty"`
}

// --- Approval History ---

type ApprovalHistory struct {
	Base
	ApprovalRequestID uuid.UUID `gorm:"type:uuid;not null" json:"approval_request_id"`
	ApproverID        uuid.UUID `gorm:"type:uuid;not null" json:"approver_id"`
	Approver          User      `gorm:"foreignKey:ApproverID" json:"approver"`
	Action            string    `gorm:"not null" json:"action"`
	Comments          string    `json:"comments"`
	ActionAt          time.Time `json:"action_at"`
}

// --- Notification ---

type Notification struct {
	Base
	UserID     uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	User       User       `gorm:"foreignKey:UserID" json:"-"`
	Title      string     `gorm:"not null" json:"title"`
	Message    string     `json:"message"`
	EntityType string     `json:"entity_type"`
	EntityID   *uuid.UUID `gorm:"type:uuid" json:"entity_id"`
	IsRead     bool       `gorm:"default:false" json:"is_read"`
}

// --- Audit Document (STP / SPA) ---

type AuditDocument struct {
	Base
	AuditProjectID uuid.UUID    `gorm:"type:uuid;not null" json:"audit_project_id"`
	AuditProject   AuditProject `gorm:"foreignKey:AuditProjectID" json:"audit_project,omitempty"`
	Type           string       `gorm:"not null" json:"type"` // "STP" | "SPA"
	DocumentNumber string       `gorm:"not null" json:"document_number"`
	IssuedAt       time.Time    `json:"issued_at"`
	IssuedByID     uuid.UUID    `gorm:"type:uuid;not null" json:"issued_by_id"`
	IssuedBy       User         `gorm:"foreignKey:IssuedByID" json:"issued_by"`
}

// --- AI Log ---

type AILog struct {
	Base
	UserID       uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	User         User       `gorm:"foreignKey:UserID" json:"user"`
	ProjectID    *uuid.UUID `gorm:"type:uuid" json:"project_id"`
	ModelUsed    string     `json:"model_used"`
	Prompt       string     `gorm:"type:text" json:"prompt"`
	Response     string     `gorm:"type:text" json:"response"`
	Status       string     `gorm:"default:'success'" json:"status"`
	ErrorMessage string     `json:"error_message"`
}

// --- Audit Trail ---

type AuditTrail struct {
	ID         uuid.UUID  `gorm:"type:uuid;primary_key" json:"id"`
	UserID     *uuid.UUID `gorm:"type:uuid" json:"user_id"`
	User       *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Action     string     `gorm:"not null" json:"action"`
	EntityType string     `json:"entity_type"`
	EntityID   *uuid.UUID `gorm:"type:uuid" json:"entity_id"`
	OldValue   string     `gorm:"type:text" json:"old_value"`
	NewValue   string     `gorm:"type:text" json:"new_value"`
	IPAddress  string     `json:"ip_address"`
	UserAgent  string     `json:"user_agent"`
	CreatedAt  time.Time  `json:"created_at"`
}

func (a *AuditTrail) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
