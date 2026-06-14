import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { dataRequestsService } from '@/services/dataRequests'
import { formatDate } from '@/lib/utils'
import type { AuditProject, DataRequest, AuditChecklist, AuditProgram, ApiResponse } from '@/types'
import {
  DATA_REQUEST_STATUS_LABELS,
  DATA_REQUEST_STATUS_COLORS,
} from '@/types'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/axios'
import {
  Plus,
  Trash2,
  Loader2,
  Database,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface Props {
  project: AuditProject
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Belum Diterima' },
  { value: 'partial', label: 'Sebagian Diterima' },
  { value: 'received', label: 'Sudah Diterima' },
  { value: 'not_available', label: 'Data Tidak Tersedia' },
]

function statusIcon(status: string) {
  switch (status) {
    case 'received': return <CheckCircle2 className="w-4 h-4 text-green-500" />
    case 'partial': return <AlertCircle className="w-4 h-4 text-orange-500" />
    case 'not_available': return <AlertCircle className="w-4 h-4 text-gray-400" />
    default: return <Clock className="w-4 h-4 text-yellow-500" />
  }
}

export function DataRequestTab({ project }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DataRequest | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const isAuditor = user?.role === 'auditor'
  const isAdmin = user?.role === 'admin'
  const isSPVOrAbove = ['spv', 'dept_head', 'div_head', 'admin'].includes(user?.role ?? '')
  const canCreate = isAuditor || isAdmin

  const { data: drRes, isLoading } = useQuery({
    queryKey: ['data-requests', project.id],
    queryFn: () => dataRequestsService.list(project.id),
  })

  const requests = drRes?.data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: dataRequestsService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['data-requests', project.id] }),
  })

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    partial: requests.filter((r) => r.status === 'partial').length,
    received: requests.filter((r) => r.status === 'received').length,
    notAvailable: requests.filter((r) => r.status === 'not_available').length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Data Request Tracker</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats.pending + stats.partial} permintaan belum selesai dari {stats.total} total
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditTarget(null); setShowCreateModal(true) }} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Buat Permintaan
          </Button>
        )}
      </div>

      {/* Stats */}
      {requests.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Belum Diterima', value: stats.pending, color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: 'Sebagian', value: stats.partial, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: 'Sudah Diterima', value: stats.received, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Tidak Tersedia', value: stats.notAvailable, color: 'text-gray-600', bg: 'bg-gray-50' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center border border-gray-100`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {requests.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Belum ada permintaan data untuk project ini.</p>
            {canCreate && (
              <Button className="mt-3" onClick={() => { setEditTarget(null); setShowCreateModal(true) }}>
                Buat Permintaan Pertama
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((dr) => {
            const isOverdue =
              dr.status === 'pending' &&
              dr.due_date &&
              new Date(dr.due_date) < new Date()
            return (
              <div
                key={dr.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                  isOverdue ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === dr.id ? null : dr.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {statusIcon(dr.status)}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 text-sm truncate">{dr.title}</p>
                        {isOverdue && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        Kepada: {dr.requested_to || '—'} · {formatDate(dr.created_at)}
                        {dr.due_date && ` · Deadline: ${formatDate(dr.due_date)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        DATA_REQUEST_STATUS_COLORS[dr.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {DATA_REQUEST_STATUS_LABELS[dr.status] ?? dr.status}
                    </span>
                    {expandedId === dr.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded */}
                {expandedId === dr.id && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    {dr.description && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Deskripsi</p>
                        <p className="text-sm text-gray-700">{dr.description}</p>
                      </div>
                    )}
                    {dr.audit_checklist && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Terkait Checklist</p>
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                          {dr.audit_checklist.title}
                        </span>
                      </div>
                    )}
                    {dr.notes && (
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Catatan</p>
                        <p className="text-sm text-gray-700">{dr.notes}</p>
                      </div>
                    )}
                    {dr.received_at && (
                      <p className="text-xs text-green-600">
                        ✓ Diterima pada: {formatDate(dr.received_at)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      Diminta oleh: {dr.requested_by?.name}
                    </p>

                    <div className="flex justify-end gap-2">
                      {(canCreate || isSPVOrAbove) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditTarget(dr); setShowCreateModal(true) }}
                        >
                          Update
                        </Button>
                      )}
                      {(canCreate && dr.requested_by_id === user?.id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 border-red-200"
                          onClick={() => {
                            if (confirm('Hapus permintaan data ini?')) deleteMutation.mutate(dr.id)
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showCreateModal && (
        <DataRequestModal
          project={project}
          request={editTarget}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['data-requests', project.id] })
          }}
        />
      )}
    </div>
  )
}

interface DataRequestModalProps {
  project: AuditProject
  request: DataRequest | null
  onClose: () => void
  onSuccess: () => void
}

function DataRequestModal({ project, request, onClose, onSuccess }: DataRequestModalProps) {
  const [title, setTitle] = useState(request?.title ?? '')
  const [description, setDescription] = useState(request?.description ?? '')
  const [requestedTo, setRequestedTo] = useState(request?.requested_to ?? '')
  const [dueDate, setDueDate] = useState(request?.due_date?.slice(0, 10) ?? '')
  const [checklistId, setChecklistId] = useState(request?.audit_checklist_id ?? '')
  const [status, setStatus] = useState<string>(request?.status ?? 'pending')
  const [notes, setNotes] = useState(request?.notes ?? '')
  const [error, setError] = useState('')

  const { data: programRes } = useQuery({
    queryKey: ['audit-program', project.id],
    queryFn: () => api.get<ApiResponse<AuditProgram[]>>(`/projects/${project.id}/audit-program`),
  })

  const programs = programRes?.data?.data ?? []
  const checklists: AuditChecklist[] = programs[0]?.checklists ?? []

  const checklistOptions = [
    { value: '', label: '— Tidak terkait checklist —' },
    ...checklists.map((c: AuditChecklist) => ({ value: c.id, label: `#${c.sequence_no} ${c.title}` })),
  ]

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof dataRequestsService.create>[1]) =>
      dataRequestsService.create(project.id, data),
    onSuccess,
    onError: () => setError('Gagal membuat permintaan data'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof dataRequestsService.update>[1]) =>
      dataRequestsService.update(request!.id, data),
    onSuccess,
    onError: () => setError('Gagal menyimpan perubahan'),
  })

  const handleSubmit = () => {
    setError('')
    if (!title.trim()) { setError('Judul wajib diisi'); return }

    if (request) {
      updateMutation.mutate({
        title: title.trim(),
        description,
        requested_to: requestedTo,
        status,
        due_date: dueDate || undefined,
        notes,
      })
    } else {
      createMutation.mutate({
        title: title.trim(),
        description,
        requested_to: requestedTo,
        due_date: dueDate || undefined,
        audit_checklist_id: checklistId || undefined,
      })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      open
      onClose={onClose}
      title={request ? 'Update Permintaan Data' : 'Buat Permintaan Data'}
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Judul / Nama Data <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. Laporan Premi 2024, Data Klaim Januari-Maret 2025"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Detail data yang diminta..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Diminta Kepada
            </label>
            <Input
              value={requestedTo}
              onChange={(e) => setRequestedTo(e.target.value)}
              placeholder="Divisi / Nama PIC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {!request && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Terkait Checklist (opsional)
            </label>
            <Select
              value={checklistId}
              onChange={(e) => setChecklistId(e.target.value)}
              options={checklistOptions}
            />
          </div>
        )}

        {request && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={STATUS_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Update terkait data yang diterima / kendala..."
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {request ? 'Simpan Perubahan' : 'Buat Permintaan'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
