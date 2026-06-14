import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import api from '@/lib/axios'
import { formatDate } from '@/lib/utils'
import type { AuditProject, ChecklistExecution, ApiResponse } from '@/types'
import {
  CHECKLIST_EXECUTION_STATUS,
  CHECKLIST_EXECUTION_STATUS_COLORS,
} from '@/types'
import { useAuthStore } from '@/stores/authStore'
import {
  CheckSquare,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react'

interface Props {
  project: AuditProject
}

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Belum Dimulai' },
  { value: 'in_progress', label: 'Sedang Dikerjakan' },
  { value: 'waiting_data', label: 'Menunggu Data' },
  { value: 'testing_done', label: 'Testing Selesai' },
  { value: 'exception_found', label: 'Ditemukan Temuan' },
  { value: 'no_exception', label: 'Tidak Ada Temuan' },
  { value: 'need_review', label: 'Perlu Review' },
  { value: 'reviewed', label: 'Sudah Direview' },
  { value: 'completed', label: 'Selesai' },
]

export function ChecklistExecutionTab({ project }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedExec, setSelectedExec] = useState<ChecklistExecution | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: execRes, isLoading } = useQuery({
    queryKey: ['checklist-executions', project.id],
    queryFn: () =>
      api.get<ApiResponse<ChecklistExecution[]>>(`/projects/${project.id}/checklist-executions`),
  })

  const executions = execRes?.data?.data ?? []

  const updateMutation = useMutation({
    mutationFn: (data: { id: string } & Partial<ChecklistExecution>) => {
      const { id, ...rest } = data
      return api.put(`/checklist-executions/${id}`, rest)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-executions', project.id] })
      setSelectedExec(null)
    },
  })

  const isFieldwork = project.status === 'fieldwork'
  const isAuditor = user?.role === 'auditor'
  const isSPVOrAbove = ['spv', 'dept_head', 'div_head', 'admin'].includes(user?.role ?? '')
  const canEdit = isFieldwork && (isAuditor || isSPVOrAbove)

  const stats = {
    total: executions.length,
    completed: executions.filter((e) =>
      ['completed', 'reviewed', 'no_exception'].includes(e.status),
    ).length,
    inProgress: executions.filter((e) =>
      ['in_progress', 'waiting_data', 'testing_done', 'exception_found', 'need_review'].includes(
        e.status,
      ),
    ).length,
    notStarted: executions.filter((e) => e.status === 'not_started').length,
    exceptions: executions.filter((e) => e.exception_found).length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!isFieldwork) {
    return (
      <Card>
        <div className="text-center py-8">
          <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            Checklist execution tersedia setelah STP/SPA diterbitkan (status: Fieldwork).
          </p>
          <p className="text-xs text-gray-400 mt-1">Status saat ini: <strong>{project.status}</strong></p>
        </div>
      </Card>
    )
  }

  if (executions.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Belum ada checklist execution untuk project ini.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'Selesai', value: stats.completed, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Dikerjakan', value: stats.inProgress, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Belum Mulai', value: stats.notStarted, color: 'text-gray-500', bg: 'bg-gray-50' },
          { label: 'Temuan', value: stats.exceptions, color: 'text-red-700', bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center border border-gray-100`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-bold text-blue-600">
            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{
              width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {executions.map((exec) => (
          <div
            key={exec.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Header row */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() =>
                setExpandedId(expandedId === exec.id ? null : exec.id)
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-gray-400 font-mono w-6 shrink-0">
                  #{exec.audit_checklist?.sequence_no ?? '—'}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {exec.audit_checklist?.title}
                  </p>
                  {exec.audit_checklist?.is_mandatory && (
                    <span className="text-[10px] text-red-600 font-medium">WAJIB</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {exec.exception_found && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    CHECKLIST_EXECUTION_STATUS_COLORS[exec.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {CHECKLIST_EXECUTION_STATUS[exec.status] ?? exec.status}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  {exec.progress_percentage}%
                </div>
                {expandedId === exec.id ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Progress bar mini */}
            <div className="h-1 bg-gray-100">
              <div
                className="h-full bg-blue-400 transition-all"
                style={{ width: `${exec.progress_percentage}%` }}
              />
            </div>

            {/* Expanded detail */}
            {expandedId === exec.id && (
              <div className="p-4 border-t border-gray-100 space-y-4">
                {exec.audit_checklist && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
                    {exec.audit_checklist.objective && (
                      <div>
                        <span className="font-medium text-gray-700">Tujuan:</span>{' '}
                        {exec.audit_checklist.objective}
                      </div>
                    )}
                    {exec.audit_checklist.procedure_text && (
                      <div>
                        <span className="font-medium text-gray-700">Prosedur:</span>{' '}
                        {exec.audit_checklist.procedure_text}
                      </div>
                    )}
                    {exec.audit_checklist.required_data && (
                      <div>
                        <span className="font-medium text-gray-700">Data Diperlukan:</span>{' '}
                        {exec.audit_checklist.required_data}
                      </div>
                    )}
                    {exec.audit_checklist.expected_evidence && (
                      <div>
                        <span className="font-medium text-gray-700">Expected Evidence:</span>{' '}
                        {exec.audit_checklist.expected_evidence}
                      </div>
                    )}
                  </div>
                )}

                {exec.result_summary && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm">
                    <span className="font-medium text-blue-800">Ringkasan Hasil: </span>
                    <span className="text-blue-700">{exec.result_summary}</span>
                  </div>
                )}

                {exec.justification_if_not_done && (
                  <div className="bg-yellow-50 rounded-lg p-3 text-sm">
                    <span className="font-medium text-yellow-800">Justifikasi: </span>
                    <span className="text-yellow-700">{exec.justification_if_not_done}</span>
                  </div>
                )}

                {exec.reviewer_note && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <span className="font-medium text-gray-700">Catatan Reviewer: </span>
                    <span className="text-gray-600">{exec.reviewer_note}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    {exec.completed_at && <span>Selesai: {formatDate(exec.completed_at)}</span>}
                    {exec.reviewed_by && (
                      <span className="ml-3">
                        Reviewed by: {exec.reviewed_by.name} ({formatDate(exec.reviewed_at)})
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <Button size="sm" onClick={() => setSelectedExec(exec)}>
                      Update Status
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Update Modal */}
      {selectedExec && (
        <UpdateExecutionModal
          execution={selectedExec}
          isAuditor={isAuditor}
          isSPVOrAbove={isSPVOrAbove}
          onClose={() => setSelectedExec(null)}
          onSave={(data) =>
            updateMutation.mutate({ id: selectedExec.id, ...data })
          }
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  )
}

interface UpdateModalProps {
  execution: ChecklistExecution
  isAuditor: boolean
  isSPVOrAbove: boolean
  onClose: () => void
  onSave: (data: Partial<ChecklistExecution>) => void
  isSaving: boolean
}

function UpdateExecutionModal({
  execution,
  isAuditor,
  isSPVOrAbove,
  onClose,
  onSave,
  isSaving,
}: UpdateModalProps) {
  const [status, setStatus] = useState(execution.status)
  const [progress, setProgress] = useState(execution.progress_percentage)
  const [resultSummary, setResultSummary] = useState(execution.result_summary)
  const [exceptionFound, setExceptionFound] = useState(execution.exception_found)
  const [potentialFinding, setPotentialFinding] = useState(execution.potential_finding)
  const [justification, setJustification] = useState(execution.justification_if_not_done)
  const [reviewerNote, setReviewerNote] = useState(execution.reviewer_note)

  const handleSave = () => {
    onSave({
      status,
      progress_percentage: progress,
      result_summary: resultSummary,
      exception_found: exceptionFound,
      potential_finding: potentialFinding,
      justification_if_not_done: justification,
      reviewer_note: reviewerNote,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Update: ${execution.audit_checklist?.title}`}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Progress ({progress}%)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {isAuditor && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ringkasan Hasil
              </label>
              <Textarea
                value={resultSummary}
                onChange={(e) => setResultSummary(e.target.value)}
                rows={3}
                placeholder="Deskripsi hasil pemeriksaan..."
              />
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={exceptionFound}
                  onChange={(e) => setExceptionFound(e.target.checked)}
                  className="w-4 h-4 rounded accent-red-600"
                />
                <span className="text-red-700 font-medium">Exception / Temuan Ditemukan</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={potentialFinding}
                  onChange={(e) => setPotentialFinding(e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-600"
                />
                <span className="text-orange-700">Potential Finding</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Justifikasi (jika tidak dikerjakan)
              </label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={2}
                placeholder="Alasan jika checklist tidak dapat diselesaikan..."
              />
            </div>
          </>
        )}

        {isSPVOrAbove && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan Reviewer (SPV)
            </label>
            <Textarea
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              rows={2}
              placeholder="Catatan dari SPV/reviewer..."
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  )
}
