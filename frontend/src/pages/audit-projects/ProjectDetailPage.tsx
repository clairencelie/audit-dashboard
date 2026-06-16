import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { auditProjectsService } from '@/services/auditProjects'
import { formatDate } from '@/lib/utils'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, RISK_LEVEL_COLORS } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { AuditProgramTab } from './tabs/AuditProgramTab'
import { ChecklistExecutionTab } from './tabs/ChecklistExecutionTab'
import { DailyEffortTab } from './tabs/DailyEffortTab'
import { WorkingPaperTab } from './tabs/WorkingPaperTab'
import { DataRequestTab } from './tabs/DataRequestTab'
import { ReferenceDocTab } from './tabs/ReferenceDocTab'
import {
  ChevronLeft,
  Calendar,
  User,
  ClipboardList,
  CheckSquare,
  FileText,
  Clock,
  Upload,
  Database,
  BookOpen,
} from 'lucide-react'

type Tab = 'overview' | 'audit-program' | 'checklists' | 'daily-effort' | 'working-papers' | 'data-requests' | 'reference-docs'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const { data: projectRes, isLoading } = useQuery({
    queryKey: ['audit-project', id],
    queryFn: () => auditProjectsService.get(id!),
    enabled: !!id,
  })

  const project = projectRes?.data

  if (isLoading) {
    return (
      <div>
        <TopBar breadcrumbs={[{ label: 'Audit Projects' }, { label: 'Loading...' }]} />
        <div className="p-6">
          <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Project tidak ditemukan.</p>
      </div>
    )
  }

  const isFieldwork = project.status === 'fieldwork'

  const tabs: { id: Tab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'audit-program', label: 'Audit Program', icon: <FileText className="w-4 h-4" /> },
    {
      id: 'checklists',
      label: 'Checklist',
      icon: <CheckSquare className="w-4 h-4" />,
    },
    {
      id: 'daily-effort',
      label: 'Daily Effort',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      id: 'working-papers',
      label: 'Working Papers',
      icon: <Upload className="w-4 h-4" />,
    },
    {
      id: 'data-requests',
      label: 'Data Request',
      icon: <Database className="w-4 h-4" />,
    },
    {
      id: 'reference-docs',
      label: 'Dok. Referensi',
      icon: <BookOpen className="w-4 h-4" />,
    },
  ]

  return (
    <div>
      <TopBar
        breadcrumbs={[
          { label: 'Audit Projects', href: '/audit-projects' },
          { label: project.title },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* Project Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <button
            onClick={() => navigate('/audit-projects')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    PROJECT_STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    RISK_LEVEL_COLORS[project.risk_level] ?? 'bg-gray-100'
                  }`}
                >
                  Risk: {project.risk_level?.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-gray-400" />
                  Auditee: <strong>{project.auditee?.name}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-gray-400" />
                  Auditor: <strong>{project.auditor?.name}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-gray-400" />
                  SPV: <strong>{project.spv?.name}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(project.planned_start_date)} – {formatDate(project.planned_end_date)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{project.health_score}</div>
                <div className="text-xs text-gray-500">Health Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex gap-1 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : tab.disabled
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <ProjectOverview project={project} />}
        {activeTab === 'audit-program' && <AuditProgramTab project={project} />}
        {activeTab === 'checklists' && <ChecklistExecutionTab project={project} />}
        {activeTab === 'daily-effort' && <DailyEffortTab project={project} />}
        {activeTab === 'working-papers' && <WorkingPaperTab project={project} />}
        {activeTab === 'data-requests' && <DataRequestTab project={project} />}
        {activeTab === 'reference-docs' && <ReferenceDocTab project={project} />}
      </div>
    </div>
  )
}

function ProjectOverview({ project }: { project: import('@/types').AuditProject }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Informasi Project</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 mb-1">Tema Audit</dt>
            <dd className="font-medium text-gray-900">{project.audit_theme || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">Prioritas</dt>
            <dd className="font-medium text-gray-900 capitalize">{project.priority}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">Dept Head</dt>
            <dd className="font-medium text-gray-900">{project.dept_head?.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">Div Head</dt>
            <dd className="font-medium text-gray-900">{project.div_head?.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">Dibuat pada</dt>
            <dd className="font-medium text-gray-900">{formatDate(project.created_at)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">Status</dt>
            <dd>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  PROJECT_STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {PROJECT_STATUS_LABELS[project.status] ?? project.status}
              </span>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <div className="text-center py-4">
          <div className="text-4xl font-bold text-blue-600 mb-1">{project.health_score}%</div>
          <p className="text-sm text-gray-500">Health Score</p>
          <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${project.health_score}%` }}
            />
          </div>
        </div>

        {project.status === 'fieldwork' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-center text-purple-600 font-medium bg-purple-50 rounded-lg px-3 py-2">
              Fieldwork sedang berjalan
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
