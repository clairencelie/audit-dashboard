import api from '@/lib/axios'
import type { LoginResponse, ApiResponse } from '@/types'

export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password })
    return response.data
  },

  logout: async () => {
    await api.post('/auth/logout')
  },

  me: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },
}
