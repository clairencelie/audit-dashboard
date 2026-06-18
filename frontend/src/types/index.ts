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
  reviewed_at?: string
  reviewer_note: string
  created_at: string
  updated_at: string
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
  not_started: 'Belum Dimulai',
  in_progress: 'Sedang Dikerjakan',
  waiting_data: 'Menunggu Data',
  testing_done: 'Testing Selesai',
  exception_found: 'Ditemukan Temuan',
  no_exception: 'Tidak Ada Temuan',
  need_review: 'Perlu Review',
  reviewed: 'Sudah Direview',
  completed: 'Selesai',
}

export const CHECKLIST_EXECUTION_STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  waiting_data: 'bg-yellow-100 text-yellow-700',
  testing_done: 'bg-indigo-100 text-indigo-700',
  exception_found: 'bg-red-100 text-red-700',
  no_exception: 'bg-green-100 text-green-700',
  need_review: 'bg-orange-100 text-orange-700',
  reviewed: 'bg-teal-100 text-teal-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

export interface DailyEffort {
  id: string
  audit_project_id: string
  audit_checklist_id?: string
  audit_checklist?: AuditChecklist
  auditor_id: string
  auditor: User
  date: string
  activity_description: string
  issue_encountered: string
  created_at: string
  updated_at: string
}

export interface WorkingPaper {
  id: string
  audit_project_id: string
  checklist_execution_id?: string
  checklist_execution?: ChecklistExecution
  audit_checklist_id?: string
  audit_checklist?: AuditChecklist
  title: string
  file_name: string
  file_url: string
  drive_file_url: string
  file_size: number
  content_type: string
  uploaded_by_id: string
  uploaded_by: User
  created_at: string
}

export interface ReferenceDocument {
  id: string
  audit_project_id: string
  title: string
  category: 'Regulasi' | 'SOP' | 'Standar Audit' | 'Kebijakan' | 'Lainnya'
  file_name: string
  drive_file_url: string
  file_size: number
  content_type: string
  uploaded_by_id: string
  uploaded_by: User
  created_at: string
}

export interface DataRequest {
  id: string
  audit_project_id: string
  audit_checklist_id?: string
  audit_checklist?: AuditChecklist
  requested_by_id: string
  requested_by: User
  title: string
  description: string
  requested_to: string
  status: 'pending' | 'partial' | 'received' | 'not_available'
  due_date?: string
  received_at?: string
  notes: string
  created_at: string
  updated_at: string
}

export const DATA_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Belum Diterima',
  partial: 'Sebagian Diterima',
  received: 'Sudah Diterima',
  not_available: 'Data Tidak Tersedia',
}

export const DATA_REQUEST_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-orange-100 text-orange-700',
  received: 'bg-green-100 text-green-700',
  not_available: 'bg-gray-100 text-gray-600',
}

export interface FindingAttachment {
  id: string
  finding_id: string
  title: string
  file_name: string
  drive_file_url: string
  file_size: number
  content_type: string
  uploaded_by_id: string
  uploaded_by: User
  created_at: string
}

export interface Finding {
  id: string
  audit_project_id: string
  checklist_execution_id?: string
  checklist_execution?: ChecklistExecution

  subject_area: string
  finding_category: string
  criteria_text: string
  risk_type: string
  risk_rating: 'low' | 'medium' | 'high'

  condition_text: string

  impact_quantity: number
  impact_loss_value: number
  impact_potential_risk: string

  auditee_response_condition: string

  cause_kebijakan: string
  cause_sistem: string
  cause_sdm: string
  cause_eksternal: string

  rec_kebijakan: string
  rec_sistem: string
  rec_sdm: string
  rec_eksternal: string

  auditee_rec_kebijakan: string
  auditee_rec_sistem: string
  auditee_rec_sdm: string
  auditee_rec_eksternal: string

  auditee_pic: string
  deadline_date?: string

  status: string
  created_by_id: string
  created_by: User
  submitted_at?: string
  approval_requests?: ApprovalRequest[]
  attachments?: FindingAttachment[]
  created_at: string
  updated_at: string
}

export const FINDING_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  need_revision: 'Perlu Revisi',
  approved_spv: 'Disetujui SPV',
  approved_dept_head: 'Disetujui Kabag',
  final_approved: 'Final Approved',
  sent_to_auditee: 'Dikirim ke Auditee',
  auditee_responded: 'Auditee Sudah Merespons',
  closed: 'Closed',
}

export const FINDING_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  need_revision: 'bg-red-100 text-red-700',
  approved_spv: 'bg-blue-100 text-blue-700',
  approved_dept_head: 'bg-indigo-100 text-indigo-700',
  final_approved: 'bg-green-100 text-green-700',
  sent_to_auditee: 'bg-purple-100 text-purple-700',
  auditee_responded: 'bg-teal-100 text-teal-700',
  closed: 'bg-gray-200 text-gray-600',
}

export const FINDING_RISK_RATING_LABELS: Record<string, string> = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
}

export const FINDING_RISK_RATING_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
}

export const FINDING_CATEGORY_OPTIONS = [
  'Untuk Menjadi Perhatian',
  'Pelanggaran Administrasi Material',
  'Pelanggaran Integritas',
]

export const FINDING_RISK_TYPE_OPTIONS = [
  'Risiko Strategis',
  'Risiko Operasional',
  'Risiko Asuransi',
  'Risiko Kredit',
  'Risiko Pasar',
  'Risiko Likuiditas',
  'Risiko Hukum',
  'Risiko Kepatuhan',
  'Risiko Reputasi',
]

export const FINDING_CAUSE_CATEGORIES = [
  { key: 'kebijakan', label: 'Kebijakan' },
  { key: 'sistem', label: 'Sistem' },
  { key: 'sdm', label: 'SDM' },
  { key: 'eksternal', label: 'Eksternal' },
] as const
