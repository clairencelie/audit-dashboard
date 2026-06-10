import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { AuditProjectsPage } from '@/pages/audit-projects/AuditProjectsPage'
import { ProjectDetailPage } from '@/pages/audit-projects/ProjectDetailPage'
import { ApprovalsPage } from '@/pages/approvals/ApprovalsPage'
import { UsersPage } from '@/pages/master-data/UsersPage'
import { AuditeeesPage } from '@/pages/master-data/AuditeeesPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/audit-projects" element={<AuditProjectsPage />} />
            <Route path="/audit-projects/:id" element={<ProjectDetailPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/master-data/users" element={<UsersPage />} />
            <Route path="/master-data/auditees" element={<AuditeeesPage />} />
            <Route path="/master-data" element={<Navigate to="/master-data/users" replace />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
