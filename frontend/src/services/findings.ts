import api from '@/lib/axios'
import type { ApiResponse, Finding, FindingAttachment } from '@/types'

export interface FindingPayload {
  checklist_execution_id?: string
  subject_area?: string
  finding_category?: string
  criteria_text?: string
  risk_type?: string
  risk_rating?: string
  condition_text?: string
  impact_quantity?: number
  impact_loss_value?: number
  impact_potential_risk?: string
  auditee_response_condition?: string
  cause_kebijakan?: string
  cause_sistem?: string
  cause_sdm?: string
  cause_eksternal?: string
  rec_kebijakan?: string
  rec_sistem?: string
  rec_sdm?: string
  rec_eksternal?: string
  auditee_pic?: string
  deadline_date?: string
}

export interface FindingAuditeeResponsePayload {
  auditee_rec_kebijakan?: string
  auditee_rec_sistem?: string
  auditee_rec_sdm?: string
  auditee_rec_eksternal?: string
  auditee_pic?: string
  deadline_date?: string
}

export interface FindingAttachmentUploadPayload {
  title: string
  file_name: string
  file_size: number
  content_type: string
  file_data: string
}

export const findingsService = {
  list: (projectId: string) =>
    api.get<ApiResponse<Finding[]>>(`/projects/${projectId}/findings`),

  get: (id: string) =>
    api.get<ApiResponse<Finding>>(`/findings/${id}`),

  create: (projectId: string, data: FindingPayload) =>
    api.post<ApiResponse<Finding>>(`/projects/${projectId}/findings`, data),

  update: (id: string, data: FindingPayload) =>
    api.put<ApiResponse<Finding>>(`/findings/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/findings/${id}`),

  submit: (id: string) =>
    api.post<ApiResponse<Finding>>(`/findings/${id}/submit`),

  approve: (id: string, comments?: string) =>
    api.post<ApiResponse<null>>(`/findings/${id}/approve`, { comments }),

  reject: (id: string, comments: string) =>
    api.post<ApiResponse<null>>(`/findings/${id}/reject`, { comments }),

  recordAuditeeResponse: (id: string, data: FindingAuditeeResponsePayload) =>
    api.post<ApiResponse<Finding>>(`/findings/${id}/auditee-response`, data),

  listAttachments: (findingId: string) =>
    api.get<ApiResponse<FindingAttachment[]>>(`/findings/${findingId}/attachments`),

  uploadAttachment: (findingId: string, payload: FindingAttachmentUploadPayload) =>
    api.post<ApiResponse<FindingAttachment>>(`/findings/${findingId}/attachments`, payload),

  deleteAttachment: (id: string) =>
    api.delete<ApiResponse<null>>(`/finding-attachments/${id}`),
}
