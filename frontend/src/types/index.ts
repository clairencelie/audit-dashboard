export interface Role {
  id: string
  name: string
  description: string
}

export interface Department {
  id: string
  name: string
  parent_id?: string
}

export interface User {
  id: string
  name: string
  email: string
  role_id: string
  role: Role
  department_id?: string
  department?: Department
  position: string
  is_active: boolean
  created_at: string
}

export interface Auditee {
  id: string
  name: string
  type: string
  department_id?: string
  department?: Department
  contact_person: string
  email: string
  is_active: boolean
}

export interface AuditProject {
  id: string
  annual_audit_plan_id?: string
  title: string
  audit_theme: string
  auditee_id: string
  auditee: Auditee
  auditor_id: string
  auditor: User
  spv_id: string
  spv: User
  dept_head_id?: string
  dept_head?: User
  div_head_id?: string
  div_head?: User
  priority: 'low' | 'medium' | 'high' | 'critical'
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  planned_start_date?: string
  planned_end_date?: string
  actual_start_date?: string
  actual_end_date?: string
  status: string
  health_score: number
  created_at: string
  updated_at: string
}

export interface AuditProgram {
  id: string
  audit_project_id: string
  version: number
  audit_period_start?: string
  audit_period_end?: string
  data_period_start?: string
  data_period_end?: string
  scope: string
  objectives: string
  criteria_summary: string
  risk_analysis: string
  data_required: string
  status: string
  is_locked: boolean
  created_by_id: string
  created_by: User
  submitted_at?: string
  approved_at?: string
  checklists?: AuditChecklist[]
  created_at: string
}

export interface AuditChecklist {
  id: string
  audit_program_id: string
  title: string
  objective: string
  procedure_text: string
  required_data: string
  expected_evidence: string
  is_mandatory: boolean
  source_criteria: string
  sequence_no: number
  created_at: string
}

export interface ChecklistExecution {
  id: string
  audit_project_id: string
  audit_checklist_id: string
  audit_checklist: AuditChecklist
  status: string
  progress_percentage: number
  result_summary: string
  exception_found: boolean
  potential_finding: boolean
  justification_if_not_done: string
  completed_at?: string
  reviewed_by_id?: string
  reviewed_by?: User
  reviewer_note: string
}

export interface ApprovalRequest {
  id: string
  entity_type: string
  entity_id: string
  approval_stage: string
  requested_by_id: string
  requested_by: User
  current_approver_id?: string
  current_approver?: User
  status: string
  submitted_at?: string
  completed_at?: string
  histories?: ApprovalHistory[]
  created_at: string
}

export interface ApprovalHistory {
  id: string
  approval_request_id: string
  approver_id: string
  approver: User
  action: string
  comments: string
  action_at: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  position: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: AuthUser
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
}

export interface PaginatedResponse<T> {
  success: boolean
  message: string
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft_audit_program: 'Draft Audit Program',
  submitted: 'Submitted',
  approved_spv: 'Disetujui SPV',
  approved_dept_head: 'Disetujui Kabag',
  approved_audit_program: 'Audit Program Final Approved',
  fieldwork: 'Fieldwork (STP/SPA Terbit)',
  draft_finding: 'Draft Finding',
  draft_report: 'Draft Report',
  report_released: 'Report Released',
  closed: 'Closed',
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  draft_audit_program: 'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved_spv: 'bg-blue-100 text-blue-700',
  approved_dept_head: 'bg-indigo-100 text-indigo-700',
  approved_audit_program: 'bg-green-100 text-green-700',
  fieldwork: 'bg-purple-100 text-purple-700',
  draft_finding: 'bg-orange-100 text-orange-700',
  draft_report: 'bg-cyan-100 text-cyan-700',
  report_released: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-200 text-gray-600',
}

export const PROGRAM_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  need_revision: 'Need Revision',
  approved_spv: 'Approved by SPV',
  approved_dept_head: 'Approved by Dept Head',
  final_approved: 'Final Approved',
}

export const RISK_LEVEL_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export interface AuditDocument {
  id: string
  audit_project_id: string
  type: 'STP' | 'SPA'
  document_number: string
  issued_at: string
  issued_by_id: string
  issued_by: User
  created_at: string
}

export interface AIChecklist {
  title: string
  objective: string
  procedure_text: string
  required_data: string
  expected_evidence: string
  is_mandatory: boolean
  source_criteria: string
}

export interface AIGeneratedProgram {
  objectives: string
  scope: string
  risk_analysis: string
  data_required: string
  criteria_summary: string
  checklists: AIChecklist[]
}

export const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
]

export const CHECKLIST_EXECUTION_STATUS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  waiting_data: 'Waiting Data',
  testing_done: 'Testing Done',
  exception_found: 'Exception Found',
  no_exception: 'No Exception',
  need_review: 'Need Review',
  reviewed: 'Reviewed',
  completed: 'Completed',
}
