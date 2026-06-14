import api from '@/lib/axios'
import type { WorkingPaper, ApiResponse } from '@/types'

export const workingPapersService = {
  list: (projectId: string) =>
    api.get<ApiResponse<WorkingPaper[]>>(`/projects/${projectId}/working-papers`),

  upload: (
    projectId: string,
    formData: FormData,
  ) =>
    api.post<ApiResponse<WorkingPaper>>(`/projects/${projectId}/working-papers`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: string) => api.delete(`/working-papers/${id}`),
}
