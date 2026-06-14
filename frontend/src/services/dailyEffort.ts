import api from '@/lib/axios'
import type { DailyEffort, ApiResponse } from '@/types'

export const dailyEffortService = {
  list: (projectId: string) =>
    api.get<ApiResponse<DailyEffort[]>>(`/projects/${projectId}/daily-efforts`),

  create: (
    projectId: string,
    data: {
      audit_checklist_id?: string
      date: string
      activity_description: string
      issue_encountered: string
    },
  ) => api.post<ApiResponse<DailyEffort>>(`/projects/${projectId}/daily-efforts`, data),

  update: (
    id: string,
    data: Partial<{
      audit_checklist_id: string
      activity_description: string
      issue_encountered: string
    }>,
  ) => api.put<ApiResponse<DailyEffort>>(`/daily-efforts/${id}`, data),

  delete: (id: string) => api.delete(`/daily-efforts/${id}`),
}
