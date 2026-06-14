import api from '@/lib/axios'
import type { AuditDocument, ApiResponse } from '@/types'

export const documentsService = {
  issue: async (projectId: string) => {
    const response = await api.post<ApiResponse<{ stp: AuditDocument; spa: AuditDocument }>>(
      `/audit-projects/${projectId}/documents/issue`
    )
    return response.data
  },

  list: async (projectId: string) => {
    const response = await api.get<ApiResponse<AuditDocument[]>>(
      `/audit-projects/${projectId}/documents`
    )
    return response.data
  },
}
