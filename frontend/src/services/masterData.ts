import api from '@/lib/axios'
import type { User, Role, Department, Auditee, ApiResponse, PaginatedResponse } from '@/types'

export const masterDataService = {
  // Users
  listUsers: async (params?: { page?: number; limit?: number; search?: string; role?: string }) => {
    const response = await api.get<PaginatedResponse<User>>('/users', { params })
    return response.data
  },

  createUser: async (data: {
    name: string
    email: string
    password: string
    role_id: string
    department_id?: string
    position?: string
  }) => {
    const response = await api.post<ApiResponse<User>>('/users', data)
    return response.data
  },

  updateUser: async (id: string, data: Partial<User>) => {
    const response = await api.put<ApiResponse<User>>(`/users/${id}`, data)
    return response.data
  },

  // Roles
  listRoles: async () => {
    const response = await api.get<ApiResponse<Role[]>>('/roles')
    return response.data
  },

  // Departments
  listDepartments: async () => {
    const response = await api.get<ApiResponse<Department[]>>('/departments')
    return response.data
  },

  // Auditees
  listAuditees: async () => {
    const response = await api.get<ApiResponse<Auditee[]>>('/auditees')
    return response.data
  },

  createAuditee: async (data: Partial<Auditee>) => {
    const response = await api.post<ApiResponse<Auditee>>('/auditees', data)
    return response.data
  },
}
