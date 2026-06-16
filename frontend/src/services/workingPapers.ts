import api from '@/lib/axios'
import type { WorkingPaper, ApiResponse } from '@/types'

export interface WorkingPaperUploadPayload {
  title: string
  audit_checklist_id?: string
  checklist_execution_id?: string
  file_name: string
  file_size: number
  content_type: string
  file_data: string
}

export const workingPapersService = {
  list: (projectId: string) =>
    api.get<ApiResponse<WorkingPaper[]>>(`/projects/${projectId}/working-papers`),

  upload: (projectId: string, payload: WorkingPaperUploadPayload) =>
    api.post<ApiResponse<WorkingPaper>>(`/projects/${projectId}/working-papers`, payload),

  delete: (id: string) => api.delete(`/working-papers/${id}`),
}
