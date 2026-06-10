import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import api from '@/lib/axios'
import { formatDate } from '@/lib/utils'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/types'
import { useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  CheckSquare,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'

interface DashboardData {
  active_projects?: unknown[]
  projects?: unknown[]
  pending_approvals: unknown[]
  stats: {
    total_projects: number
    active_projects: number
    closed_projects?: number
  }
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const dashboardEndpoint = {
    auditor: '/dashboard/auditor',
    spv: '/dashboard/spv',
    dept_head: '/dashboard/dept-head',
    div_head: '/dashboard/div-head',
    admin: '/dashboard/div-head',
  }[user?.role ?? 'auditor'] ?? '/dashboard/auditor'

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', user?.role],
    queryFn: async () => {
      const res = await api.get(dashboardEndpoint)
      return res.data.data as DashboardData
    },
  })

  const activeProjects = (data?.active_projects ?? data?.['projects'] ?? []) as Record<string, unknown>[]
  const pendingApprovals = (data?.pending_approvals ?? []) as Record<string, unknown>[]
  const stats = data?.stats ?? { total_projects: 0, active_projects: 0 }

  return (
    <div>
      <TopBar title={`Selamat datang, ${user?.name}`} />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FolderOpen className="w-6 h-6 text-blue-600" />}
            label="Total Project"
            value={String(stats.total_projects)}
            bgColor="bg-blue-50"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-green-600" />}
            label="Project Aktif"
            value={String(stats.active_projects)}
            bgColor="bg-green-50"
          />
          <StatCard
            icon={<CheckSquare className="w-6 h-6 text-purple-600" />}
            label="Approval Pending"
            value={String(pendingApprovals.length)}
            bgColor="bg-purple-50"
          />
          <StatCard
            icon={<AlertTriangle className="w-6 h-6 text-orange-600" />}
            label="Perlu Perhatian"
            value="0"
            bgColor="bg-orange-50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Projects */}
          <Card>
            <CardHeader>
              <CardTitle>Project Aktif</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/audit-projects')}>
                Lihat Semua <ArrowRight className="w-4 h-4" />
              </Button>
            </CardHeader>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Belum ada project aktif</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeProjects.slice(0, 5).map((project) => (
                  <div
                    key={project.id as string}
                    onClick={() => navigate(`/audit-projects/${project.id}`)}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{project.title as string}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(project.auditee as Record<string, string>)?.name} •{' '}
                        {formatDate(project.planned_start_date as string)}
                      </p>
                    </div>
                    <span
                      className={`ml-3 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                        PROJECT_STATUS_COLORS[project.status as string] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {PROJECT_STATUS_LABELS[project.status as string] ?? project.status as string}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pending Approvals */}
          <Card>
            <CardHeader>
              <CardTitle>Perlu Approval Anda</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/approvals')}>
                Lihat Semua <ArrowRight className="w-4 h-4" />
              </Button>
            </CardHeader>

            {pendingApprovals.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Tidak ada approval pending</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.slice(0, 5).map((approval) => (
                  <div
                    key={approval.id as string}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {(approval.entity_type as string)?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Dari: {(approval.requested_by as Record<string, string>)?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  bgColor: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 ${bgColor} rounded-xl flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}
