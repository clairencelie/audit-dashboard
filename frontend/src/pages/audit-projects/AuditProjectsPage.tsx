import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { auditProjectsService } from '@/services/auditProjects'
import { useAuthStore } from '@/stores/authStore'
import { formatDate } from '@/lib/utils'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, RISK_LEVEL_COLORS } from '@/types'
import { CreateProjectModal } from './CreateProjectModal'
import {
  Plus,
  Search,
  FolderOpen,
  ChevronRight,
  Calendar,
  User,
} from 'lucide-react'

export function AuditProjectsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-projects', page, search],
    queryFn: () => auditProjectsService.list({ page, limit: 20, search }),
  })

  const canCreate = ['admin', 'div_head', 'dept_head', 'spv'].includes(user?.role ?? '')

  return (
    <div>
      <TopBar
        breadcrumbs={[{ label: 'Audit Projects' }]}
        title="Audit Projects"
      />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Buat Project
            </Button>
          )}
        </div>

        {/* Project List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <Card className="text-center py-16">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Belum ada audit project</p>
            {canCreate && (
              <Button onClick={() => setShowCreate(true)} className="mt-4">
                <Plus className="w-4 h-4" />
                Buat Project Pertama
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {data.data.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/audit-projects/${project.id}`)}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {project.title}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          PROJECT_STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {project.auditee?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(project.planned_start_date)} – {formatDate(project.planned_end_date)}
                      </span>
                      <span>Auditor: {project.auditor?.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        RISK_LEVEL_COLORS[project.risk_level] ?? 'bg-gray-100'
                      }`}
                    >
                      {project.risk_level?.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="w-10 h-10 rounded-full border-4 border-blue-200 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">{project.health_score}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.meta.total_pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">
              Menampilkan {data.data.length} dari {data.meta.total} project
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Sebelumnya
              </Button>
              <span className="text-sm text-gray-600">
                {page} / {data.meta.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === data.meta.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false)
          refetch()
        }}
      />
    </div>
  )
}
