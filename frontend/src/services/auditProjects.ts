import api from '@/lib/axios'
import type { AuditProject, ApiResponse, PaginatedResponse } from '@/types'

export const auditProjectsService = {
  list: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const response = await api.get<PaginatedResponse<AuditProject>>('/audit-projects', { params })
    return response.data
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<AuditProject>>(`/audit-projects/${id}`)
    return response.data
  },

  getDashboard: async (id: string) => {
    const response = await api.get(`/audit-projects/${id}/dashboard`)
    return response.data
  },

  create: async (data: Partial<AuditProject>) => {
    const response = await api.post<ApiResponse<AuditProject>>('/audit-projects', data)
    return response.data
  },

  update: async (id: string, data: Partial<AuditProject>) => {
    const response = await api.put<ApiResponse<AuditProject>>(`/audit-projects/${id}`, data)
    return response.data
  },
}
