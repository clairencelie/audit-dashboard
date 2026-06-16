import api from '@/lib/axios'
import type { ReferenceDocument, ApiResponse } from '@/types'

export interface ReferenceDocUploadPayload {
  title: string
  category: string
  file_name: string
  file_size: number
  content_type: string
  file_data: string
}

export const referenceDocsService = {
  list: (projectId: string) =>
    api.get<ApiResponse<ReferenceDocument[]>>(`/projects/${projectId}/reference-docs`),

  upload: (projectId: string, payload: ReferenceDocUploadPayload) =>
    api.post<ApiResponse<ReferenceDocument>>(`/projects/${projectId}/reference-docs`, payload),

  delete: (id: string) => api.delete(`/reference-docs/${id}`),
}
