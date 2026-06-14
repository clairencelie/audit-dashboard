import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { dailyEffortService } from '@/services/dailyEffort'
import { formatDate } from '@/lib/utils'
import type { AuditProject, DailyEffort, AuditChecklist, AuditProgram, ApiResponse } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/axios'
import { Plus, Trash2, Loader2, Clock, AlertCircle } from 'lucide-react'

interface Props {
  project: AuditProject
}

export function DailyEffortTab({ project }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DailyEffort | null>(null)

  const isAuditor = user?.role === 'auditor'
  const isAdmin = user?.role === 'admin'
  const canAdd = isAuditor || isAdmin

  const { data: effortRes, isLoading } = useQuery({
    queryKey: ['daily-efforts', project.id],
    queryFn: () => dailyEffortService.list(project.id),
  })

  const efforts = effortRes?.data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: dailyEffortService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily-efforts', project.id] }),
  })

  // Group by date
  const byDate = efforts.reduce<Record<string, DailyEffort[]>>((acc, e) => {
    const d = e.date.slice(0, 10)
    if (!acc[d]) acc[d] = []
    acc[d].push(e)
    return acc
  }, {})

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
          <h2 className="text-base font-semibold text-gray-900">Daily Effort Log</h2>
          <p className="text-xs text-gray-500 mt-0.5">{efforts.length} entri</p>
        </div>
        {canAdd && (
          <Button onClick={() => { setEditTarget(null); setShowModal(true) }} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Tambah Log
          </Button>
        )}
      </div>

      {efforts.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Belum ada effort log untuk project ini.</p>
            {canAdd && (
              <Button className="mt-3" onClick={() => { setEditTarget(null); setShowModal(true) }}>
                Log Aktivitas Pertama
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(byDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dayEfforts]) => (
              <div key={date} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">{formatDate(date)}</span>
                  <span className="text-xs text-gray-400">{dayEfforts.length} aktivitas</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {dayEfforts.map((effort) => (
                    <div key={effort.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        {effort.audit_checklist && (
                          <span className="inline-block text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full mb-1.5">
                            {effort.audit_checklist.title}
                          </span>
                        )}
                        {effort.activity_description ? (
                          <p className="text-sm text-gray-700">{effort.activity_description}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">—</p>
                        )}
                        {effort.issue_encountered && (
                          <div className="flex items-start gap-1.5 mt-1.5 bg-orange-50 rounded p-2">
                            <AlertCircle className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-orange-700">{effort.issue_encountered}</p>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{effort.auditor.name}</p>
                      </div>
                      {canAdd && (user?.role === 'admin' || effort.auditor_id === user?.id) && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditTarget(effort); setShowModal(true) }}
                            className="text-xs px-2 py-1"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50 border-red-200 px-2 py-1"
                            onClick={() => {
                              if (confirm('Hapus log ini?')) deleteMutation.mutate(effort.id)
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {showModal && (
        <EffortModal
          project={project}
          effort={editTarget}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            queryClient.invalidateQueries({ queryKey: ['daily-efforts', project.id] })
          }}
        />
      )}
    </div>
  )
}

interface EffortModalProps {
  project: AuditProject
  effort: DailyEffort | null
  onClose: () => void
  onSuccess: () => void
}

function EffortModal({ project, effort, onClose, onSuccess }: EffortModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(effort?.date?.slice(0, 10) ?? today)
  const [activity, setActivity] = useState(effort?.activity_description ?? '')
  const [issue, setIssue] = useState(effort?.issue_encountered ?? '')
  const [checklistId, setChecklistId] = useState(effort?.audit_checklist_id ?? '')
  const [error, setError] = useState('')

  // Ambil checklists dari audit program (array response, ambil index 0)
  const { data: programRes } = useQuery({
    queryKey: ['audit-program', project.id],
    queryFn: () => api.get<ApiResponse<AuditProgram[]>>(`/projects/${project.id}/audit-program`),
  })

  const programs = programRes?.data?.data ?? []
  const checklists: AuditChecklist[] = programs[0]?.checklists ?? []

  const checklistOptions = [
    { value: '', label: '— Tidak terkait checklist spesifik —' },
    ...checklists.map((c) => ({ value: c.id, label: `#${c.sequence_no} ${c.title}` })),
  ]

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof dailyEffortService.create>[1]) =>
      dailyEffortService.create(project.id, data),
    onSuccess,
    onError: () => setError('Gagal menyimpan log aktivitas'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof dailyEffortService.update>[1]) =>
      dailyEffortService.update(effort!.id, data),
    onSuccess,
    onError: () => setError('Gagal menyimpan log aktivitas'),
  })

  const handleSubmit = () => {
    setError('')
    if (!date) { setError('Tanggal wajib diisi'); return }

    const payload = {
      audit_checklist_id: checklistId || undefined,
      date,
      activity_description: activity,
      issue_encountered: issue,
    }

    if (effort) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Modal open onClose={onClose} title={effort ? 'Edit Log Aktivitas' : 'Tambah Log Aktivitas'}>
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tanggal <span className="text-red-500">*</span>
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today}
          />
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deskripsi Aktivitas
          </label>
          <Textarea
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            rows={3}
            placeholder="Apa yang dikerjakan hari ini..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kendala / Issue
          </label>
          <Textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            rows={2}
            placeholder="Kendala atau hambatan yang dihadapi (opsional)..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {effort ? 'Simpan' : 'Tambah'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
