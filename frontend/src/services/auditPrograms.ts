import api from '@/lib/axios'
import type { AuditProgram, AuditChecklist, ApiResponse } from '@/types'

export const auditProgramsService = {
  getByProject: async (projectId: string) => {
    const response = await api.get<ApiResponse<AuditProgram[]>>(`/projects/${projectId}/audit-program`)
    return response.data
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<AuditProgram>>(`/audit-programs/${id}`)
    return response.data
  },

  create: async (projectId: string, data: Partial<AuditProgram>) => {
    const response = await api.post<ApiResponse<AuditProgram>>(`/projects/${projectId}/audit-program`, data)
    return response.data
  },

  update: async (id: string, data: Partial<AuditProgram>) => {
    const response = await api.put<ApiResponse<AuditProgram>>(`/audit-programs/${id}`, data)
    return response.data
  },

  submit: async (id: string) => {
    const response = await api.post(`/audit-programs/${id}/submit`)
    return response.data
  },

  approve: async (id: string, comments?: string) => {
    const response = await api.post(`/audit-programs/${id}/approve`, { comments })
    return response.data
  },

  reject: async (id: string, comments: string) => {
    const response = await api.post(`/audit-programs/${id}/reject`, { comments })
    return response.data
  },

  // Checklists
  listChecklists: async (programId: string) => {
    const response = await api.get<ApiResponse<AuditChecklist[]>>(`/audit-programs/${programId}/checklists`)
    return response.data  // route: /audit-programs/:id/checklists
  },

  createChecklist: async (programId: string, data: Partial<AuditChecklist>) => {
    const response = await api.post<ApiResponse<AuditChecklist>>(`/audit-programs/${programId}/checklists`, data)
    return response.data  // route: POST /audit-programs/:id/checklists
  },

  updateChecklist: async (id: string, data: Partial<AuditChecklist>) => {
    const response = await api.put<ApiResponse<AuditChecklist>>(`/checklists/${id}`, data)
    return response.data
  },

  deleteChecklist: async (id: string) => {
    const response = await api.delete(`/checklists/${id}`)
    return response.data
  },
}
