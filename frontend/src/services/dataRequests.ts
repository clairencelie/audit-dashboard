import api from '@/lib/axios'
import type { DataRequest, ApiResponse } from '@/types'

export const dataRequestsService = {
  list: (projectId: string) =>
    api.get<ApiResponse<DataRequest[]>>(`/projects/${projectId}/data-requests`),

  create: (
    projectId: string,
    data: {
      audit_checklist_id?: string
      title: string
      description: string
      requested_to: string
      due_date?: string
    },
  ) => api.post<ApiResponse<DataRequest>>(`/projects/${projectId}/data-requests`, data),

  update: (
    id: string,
    data: Partial<{
      title: string
      description: string
      requested_to: string
      status: string
      due_date: string
      received_at: string
      notes: string
    }>,
  ) => api.put<ApiResponse<DataRequest>>(`/data-requests/${id}`, data),

  delete: (id: string) => api.delete(`/data-requests/${id}`),
}
