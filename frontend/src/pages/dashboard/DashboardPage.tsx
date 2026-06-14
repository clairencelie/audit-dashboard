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
  Database,
  User,
  Activity,
} from 'lucide-react'

interface AuditorDashboard {
  active_projects: Record<string, unknown>[]
  pending_approvals: Record<string, unknown>[]
  no_effort_today: Record<string, unknown>[]
  pending_data_requests: Record<string, unknown>[]
  stats: { total_projects: number; active_projects: number }
}

interface SPVDashboard {
  projects: Record<string, unknown>[]
  pending_approvals: Record<string, unknown>[]
  no_effort_alerts: {
    auditor_id: string
    auditor_name: string
    project_id: string
    project_title: string
  }[]
  idle_checklists: {
    checklist_id: string
    checklist_title: string
    project_id: string
    project_title: string
    last_updated: string
  }[]
  progress_summary: {
    project_id: string
    project_title: string
    total: number
    completed: number
    in_progress: number
    not_started: number
  }[]
  stats: { total_projects: number; active_projects: number }
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
      return res.data.data
    },
  })

  const isAuditor = user?.role === 'auditor'
  const isSPV = user?.role === 'spv'

  if (isAuditor) {
    return <AuditorDashboardView data={data as AuditorDashboard} isLoading={isLoading} />
  }

  if (isSPV) {
    return <SPVDashboardView data={data as SPVDashboard} isLoading={isLoading} />
  }

  // Generic dashboard for dept_head, div_head, admin
  const activeProjects = (data?.active_projects ?? data?.['projects'] ?? []) as Record<string, unknown>[]
  const pendingApprovals = (data?.pending_approvals ?? []) as Record<string, unknown>[]
  const stats = data?.stats ?? { total_projects: 0, active_projects: 0 }

  return (
    <div>
      <TopBar title={`Selamat datang, ${user?.name}`} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<FolderOpen className="w-6 h-6 text-blue-600" />} label="Total Project" value={String(stats.total_projects)} bgColor="bg-blue-50" />
          <StatCard icon={<TrendingUp className="w-6 h-6 text-green-600" />} label="Project Aktif" value={String(stats.active_projects)} bgColor="bg-green-50" />
          <StatCard icon={<CheckSquare className="w-6 h-6 text-purple-600" />} label="Approval Pending" value={String(pendingApprovals.length)} bgColor="bg-purple-50" />
          <StatCard icon={<AlertTriangle className="w-6 h-6 text-orange-600" />} label="Perlu Perhatian" value="0" bgColor="bg-orange-50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProjectListCard projects={activeProjects} isLoading={isLoading} />
          <PendingApprovalsCard approvals={pendingApprovals} />
        </div>
      </div>
    </div>
  )
}

function AuditorDashboardView({ data, isLoading }: { data?: AuditorDashboard; isLoading: boolean }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const activeProjects = data?.active_projects ?? []
  const pendingApprovals = data?.pending_approvals ?? []
  const noEffortToday = data?.no_effort_today ?? []
  const pendingDataRequests = data?.pending_data_requests ?? []
  const stats = data?.stats ?? { total_projects: 0, active_projects: 0 }
  const alertCount = noEffortToday.length + pendingDataRequests.filter((r: any) => r.status === 'pending' && r.due_date && new Date(r.due_date) < new Date()).length

  return (
    <div>
      <TopBar title={`Selamat datang, ${user?.name}`} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<FolderOpen className="w-6 h-6 text-blue-600" />} label="Total Project" value={String(stats.total_projects)} bgColor="bg-blue-50" />
          <StatCard icon={<TrendingUp className="w-6 h-6 text-green-600" />} label="Project Aktif" value={String(stats.active_projects)} bgColor="bg-green-50" />
          <StatCard icon={<CheckSquare className="w-6 h-6 text-purple-600" />} label="Approval Pending" value={String(pendingApprovals.length)} bgColor="bg-purple-50" />
          <StatCard icon={<AlertTriangle className="w-6 h-6 text-orange-600" />} label="Perlu Perhatian" value={String(alertCount)} bgColor="bg-orange-50" />
        </div>

        {/* Alert: no effort today */}
        {noEffortToday.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-orange-800">
                Belum input effort hari ini — {noEffortToday.length} project fieldwork
              </h3>
            </div>
            <div className="space-y-2">
              {noEffortToday.map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/audit-projects/${p.id}?tab=daily-effort`)}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200 cursor-pointer hover:border-orange-400 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.title}</p>
                    <p className="text-xs text-gray-500">{(p.auditee as any)?.name}</p>
                  </div>
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/audit-projects/${p.id}`) }}>
                    Input Effort
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProjectListCard projects={activeProjects} isLoading={isLoading} />
          <PendingApprovalsCard approvals={pendingApprovals} />
        </div>

        {/* Pending data requests */}
        {pendingDataRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Data Request Belum Selesai</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {pendingDataRequests.map((dr: any) => {
                const isOverdue = dr.due_date && new Date(dr.due_date) < new Date()
                return (
                  <div
                    key={dr.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-100'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{dr.title}</p>
                      <p className="text-xs text-gray-400">
                        Kepada: {dr.requested_to || '—'}
                        {dr.due_date && ` · Deadline: ${formatDate(dr.due_date)}`}
                        {isOverdue && <span className="ml-2 text-red-600 font-medium">OVERDUE</span>}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                      {dr.status === 'pending' ? 'Belum Diterima' : 'Sebagian'}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function SPVDashboardView({ data, isLoading }: { data?: SPVDashboard; isLoading: boolean }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const projects = data?.projects ?? []
  const pendingApprovals = data?.pending_approvals ?? []
  const noEffortAlerts = data?.no_effort_alerts ?? []
  const idleChecklists = data?.idle_checklists ?? []
  const progressSummary = data?.progress_summary ?? []
  const stats = data?.stats ?? { total_projects: 0, active_projects: 0 }
  const alertCount = noEffortAlerts.length + idleChecklists.length

  return (
    <div>
      <TopBar title={`Selamat datang, ${user?.name}`} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<FolderOpen className="w-6 h-6 text-blue-600" />} label="Total Project" value={String(stats.total_projects)} bgColor="bg-blue-50" />
          <StatCard icon={<TrendingUp className="w-6 h-6 text-green-600" />} label="Project Aktif" value={String(stats.active_projects)} bgColor="bg-green-50" />
          <StatCard icon={<CheckSquare className="w-6 h-6 text-purple-600" />} label="Approval Pending" value={String(pendingApprovals.length)} bgColor="bg-purple-50" />
          <StatCard icon={<AlertTriangle className="w-6 h-6 text-orange-600" />} label="Alerts" value={String(alertCount)} bgColor="bg-orange-50" />
        </div>

        {/* Alert: no effort today */}
        {noEffortAlerts.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-orange-800">
                Auditor belum input effort hari ini ({noEffortAlerts.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {noEffortAlerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-orange-200"
                >
                  <User className="w-4 h-4 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{alert.auditor_name}</p>
                    <p className="text-xs text-gray-500 truncate">{alert.project_title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alert: idle checklists */}
        {idleChecklists.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-800">
                Checklist idle 3+ hari ({idleChecklists.length})
              </h3>
            </div>
            <div className="space-y-2">
              {idleChecklists.slice(0, 5).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-red-200 cursor-pointer hover:border-red-400 transition-colors"
                  onClick={() => navigate(`/audit-projects/${item.project_id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.checklist_title}</p>
                    <p className="text-xs text-gray-500">{item.project_title} · Update terakhir: {formatDate(item.last_updated)}</p>
                  </div>
                </div>
              ))}
              {idleChecklists.length > 5 && (
                <p className="text-xs text-red-600 text-center">+{idleChecklists.length - 5} checklist lainnya</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProjectListCard projects={projects} isLoading={isLoading} />
          <PendingApprovalsCard approvals={pendingApprovals} />
        </div>

        {/* Progress summary */}
        {progressSummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Progress Checklist per Project</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              {progressSummary.map((ps) => {
                const pct = ps.total > 0 ? Math.round((ps.completed / ps.total) * 100) : 0
                return (
                  <div key={ps.project_id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{ps.project_title}</p>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">
                        {ps.completed}/{ps.total} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span className="text-emerald-600">{ps.completed} selesai</span>
                      <span className="text-blue-600">{ps.in_progress} dikerjakan</span>
                      <span>{ps.not_started} belum mulai</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function ProjectListCard({ projects, isLoading }: { projects: Record<string, unknown>[]; isLoading: boolean }) {
  const navigate = useNavigate()
  return (
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
      ) : projects.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Belum ada project aktif</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.slice(0, 5).map((project) => (
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
  )
}

function PendingApprovalsCard({ approvals }: { approvals: Record<string, unknown>[] }) {
  const navigate = useNavigate()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perlu Approval Anda</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/approvals')}>
          Lihat Semua <ArrowRight className="w-4 h-4" />
        </Button>
      </CardHeader>

      {approvals.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Tidak ada approval pending</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.slice(0, 5).map((approval) => (
            <div
              key={approval.id as string}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => navigate('/approvals')}
            >
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {(approval.entity_type as string)?.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Dari: {(approval.requested_by as Record<string, string>)?.name}
                </p>
              </div>
              <Badge variant="warning">
                <Clock className="w-3 h-3 mr-1" />
                Pending
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
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
