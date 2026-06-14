import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { auditProgramsService } from '@/services/auditPrograms'
import { documentsService } from '@/services/documents'
import { useAuthStore } from '@/stores/authStore'
import { formatDate, formatDateTime } from '@/lib/utils'
import { PROGRAM_STATUS_LABELS, GEMINI_MODELS } from '@/types'
import type { AuditProject, AuditProgram, AuditChecklist, AIGeneratedProgram, AIChecklist, ApprovalRequest, AuditDocument } from '@/types'
import api from '@/lib/axios'
import { printSTP, printSPA } from '@/lib/printDocument'
import {
  Plus,
  FileText,
  CheckCircle,
  AlertCircle,
  Lock,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  MessageSquare,
  Stamp,
  Printer,
} from 'lucide-react'

const STAGE_LABELS: Record<string, string> = {
  spv: 'Supervisor (SPV)',
  dept_head: 'Kepala Bagian',
  div_head: 'Kepala Divisi',
}

interface Props {
  project: AuditProject
}

export function AuditProgramTab({ project }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [showAddChecklist, setShowAddChecklist] = useState(false)
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<{
    open: boolean
    programId: string
    type: 'approve' | 'reject'
  }>({ open: false, programId: '', type: 'approve' })
  const [actionComment, setActionComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-program', project.id],
    queryFn: () => auditProgramsService.getByProject(project.id),
  })

  const programs = data?.data ?? []

  const submitMutation = useMutation({
    mutationFn: (id: string) => auditProgramsService.submit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-program', project.id] }),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) =>
      auditProgramsService.approve(id, comments),
    onSuccess: () => {
      setActionModal({ open: false, programId: '', type: 'approve' })
      setActionComment('')
      queryClient.invalidateQueries({ queryKey: ['audit-program', project.id] })
      queryClient.invalidateQueries({ queryKey: ['audit-project', project.id] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      auditProgramsService.reject(id, comments),
    onSuccess: () => {
      setActionModal({ open: false, programId: '', type: 'approve' })
      setActionComment('')
      queryClient.invalidateQueries({ queryKey: ['audit-program', project.id] })
    },
  })

  const deleteChecklistMutation = useMutation({
    mutationFn: (id: string) => auditProgramsService.deleteChecklist(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-program', project.id] }),
  })

  const canCreate = user?.role === 'auditor'
  const canApprove = ['spv', 'dept_head', 'div_head'].includes(user?.role ?? '')

  function canApproveAtStage(status: string): boolean {
    if (user?.role === 'spv' && status === 'submitted') return true
    if (user?.role === 'dept_head' && status === 'approved_spv') return true
    if (user?.role === 'div_head' && status === 'approved_dept_head') return true
    return false
  }

  // Approval history for the latest program
  const latestProgram = programs[0]
  const { data: approvalsData } = useQuery({
    queryKey: ['program-approvals', latestProgram?.id],
    queryFn: async () => {
      const res = await api.get(
        `/approvals?entity_type=audit_program&entity_id=${latestProgram!.id}`
      )
      return res.data.data as ApprovalRequest[]
    },
    enabled: !!latestProgram?.id,
  })
  const programApprovals = approvalsData ?? []

  // Documents (STP/SPA)
  const { data: docsData, refetch: refetchDocs } = useQuery({
    queryKey: ['project-documents', project.id],
    queryFn: () => documentsService.list(project.id),
  })
  const documents = docsData?.data ?? []

  const issueMutation = useMutation({
    mutationFn: () => documentsService.issue(project.id),
    onSuccess: () => {
      refetchDocs()
      queryClient.invalidateQueries({ queryKey: ['audit-project', project.id] })
    },
  })

  if (isLoading) {
    return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
  }

  return (
    <div className="space-y-4">
      {programs.length === 0 ? (
        <Card className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 mb-4">Belum ada Audit Program</p>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Buat Audit Program
            </Button>
          )}
        </Card>
      ) : (
        programs.map((program) => (
          <Card key={program.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Audit Program v{program.version}</CardTitle>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                  {PROGRAM_STATUS_LABELS[program.status] ?? program.status}
                </span>
                {program.is_locked && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Lock className="w-3 h-3" />
                    Locked
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canCreate && program.status === 'draft' && (
                  <Button
                    size="sm"
                    onClick={() => submitMutation.mutate(program.id)}
                    loading={submitMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                    Submit untuk Review
                  </Button>
                )}
                {canApproveAtStage(program.status) && (
                  <>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setActionModal({ open: true, programId: program.id, type: 'reject' })}
                    >
                      Tolak
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setActionModal({ open: true, programId: program.id, type: 'approve' })}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>

            {/* Program Details */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-gray-500 mb-0.5">Periode Audit</p>
                <p className="font-medium text-gray-800">
                  {formatDate(program.audit_period_start)} – {formatDate(program.audit_period_end)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-0.5">Periode Data Pemeriksaan</p>
                <p className="font-medium text-gray-800">
                  {program.data_period_start
                    ? `${formatDate(program.data_period_start)} – ${formatDate(program.data_period_end)}`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-0.5">Dibuat oleh</p>
                <p className="font-medium text-gray-800">{program.created_by?.name}</p>
              </div>
              {program.submitted_at && (
                <div>
                  <p className="text-gray-500 mb-0.5">Submitted</p>
                  <p className="font-medium text-gray-800">{formatDateTime(program.submitted_at)}</p>
                </div>
              )}
            </div>

            {program.scope && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Lingkup</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{program.scope}</p>
              </div>
            )}

            {program.objectives && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tujuan</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{program.objectives}</p>
              </div>
            )}

            {program.risk_analysis && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Analisis Risiko</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{program.risk_analysis}</p>
              </div>
            )}

            {/* Checklists */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">
                  Checklist ({program.checklists?.length ?? 0})
                </h4>
                {canCreate && !program.is_locked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddChecklist(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Checklist
                  </Button>
                )}
              </div>

              {!program.checklists?.length ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Belum ada checklist
                </p>
              ) : (
                <div className="space-y-2">
                  {program.checklists.map((cl, idx) => (
                    <ChecklistItem
                      key={cl.id}
                      checklist={cl}
                      index={idx + 1}
                      isExpanded={expandedChecklist === cl.id}
                      onToggle={() =>
                        setExpandedChecklist(expandedChecklist === cl.id ? null : cl.id)
                      }
                      canDelete={canCreate && !program.is_locked}
                      onDelete={() => deleteChecklistMutation.mutate(cl.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {showAddChecklist && !program.is_locked && (
              <AddChecklistModal
                programId={program.id}
                onClose={() => setShowAddChecklist(false)}
                onSuccess={() => {
                  setShowAddChecklist(false)
                  queryClient.invalidateQueries({ queryKey: ['audit-program', project.id] })
                }}
              />
            )}
          </Card>
        ))
      )}

      {canCreate && programs.length > 0 && programs[0].status === 'need_revision' && (
        <Card className="border-orange-200 bg-orange-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800">Audit Program perlu revisi</p>
              <p className="text-xs text-orange-600">Silakan perbaiki dan submit kembali.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Approval history & comments — visible to all relevant roles */}
      {(canCreate || canApprove) && latestProgram && programApprovals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Riwayat Review & Komentar
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {programApprovals.map((req) => (
              <div key={req.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600">
                    {STAGE_LABELS[req.approval_stage] ?? req.approval_stage}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    req.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : req.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {req.status === 'approved' ? 'Disetujui' : req.status === 'rejected' ? 'Ditolak / Perlu Revisi' : 'Menunggu'}
                  </span>
                </div>
                {req.histories && req.histories.length > 0 ? (
                  <div className="space-y-2">
                    {req.histories.map((h) => (
                      <div key={h.id} className="flex items-start gap-2">
                        {h.action === 'approved' ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-700">{h.approver?.name}</p>
                          {h.comments ? (
                            <p className="text-sm text-gray-800 bg-gray-50 rounded p-2 mt-1 whitespace-pre-wrap">{h.comments}</p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">Tanpa komentar</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">{formatDateTime(h.action_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Belum ada tindakan</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* STP & SPA section — visible after final_approved */}
      {latestProgram?.status === 'final_approved' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stamp className="w-4 h-4 text-emerald-600" />
              Penerbitan Surat Tugas & Surat Pengantar Audit
            </CardTitle>
          </CardHeader>

          {documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc: AuditDocument) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      {doc.type === 'STP' ? 'Surat Tugas Pemeriksaan (STP)' : 'Surat Pengantar Audit (SPA)'}
                    </p>
                    <p className="text-lg font-bold text-emerald-900 mt-0.5">{doc.document_number}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Diterbitkan oleh {doc.issued_by?.name} — {formatDateTime(doc.issued_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!latestProgram) return
                      if (doc.type === 'STP') printSTP(project, latestProgram, doc)
                      else printSPA(project, latestProgram, doc)
                    }}
                  >
                    <Printer className="w-4 h-4" />
                    Cetak
                  </Button>
                </div>
              ))}
              <p className="text-xs text-gray-400 text-center pt-1">
                Dokumen sudah diterbitkan. Status project telah berubah ke Fieldwork.
              </p>
            </div>
          ) : canCreate ? (
            <div className="text-center py-4">
              <Stamp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-600 mb-1">
                Audit Program sudah mendapat persetujuan final.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Terbitkan nomor STP dan SPA untuk memulai fieldwork.
              </p>
              {issueMutation.isError && (
                <p className="text-sm text-red-600 mb-3">
                  {(issueMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Gagal menerbitkan dokumen'}
                </p>
              )}
              <Button
                onClick={() => issueMutation.mutate()}
                loading={issueMutation.isPending}
              >
                <Stamp className="w-4 h-4" />
                Terbitkan STP & SPA
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Menunggu auditor menerbitkan nomor STP & SPA.
            </p>
          )}
        </Card>
      )}

      {/* Create Program Modal */}
      {showCreate && (
        <CreateProgramModal
          project={project}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false)
            queryClient.invalidateQueries({ queryKey: ['audit-program', project.id] })
          }}
        />
      )}

      {/* Approve / Reject Modal */}
      <Modal
        open={actionModal.open}
        onClose={() => { setActionModal({ open: false, programId: '', type: 'approve' }); setActionComment('') }}
        title={actionModal.type === 'approve' ? 'Setujui Audit Program' : 'Tolak Audit Program'}
        size="sm"
      >
        <div className="space-y-4">
          <Textarea
            label={actionModal.type === 'approve' ? 'Komentar (opsional)' : 'Alasan Penolakan'}
            required={actionModal.type === 'reject'}
            placeholder={actionModal.type === 'approve' ? 'Tambahkan catatan jika ada...' : 'Jelaskan alasan penolakan...'}
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => { setActionModal({ open: false, programId: '', type: 'approve' }); setActionComment('') }}
            >
              Batal
            </Button>
            {actionModal.type === 'approve' ? (
              <Button
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id: actionModal.programId, comments: actionComment || undefined })}
              >
                <CheckCircle className="w-4 h-4" />
                Setujui
              </Button>
            ) : (
              <Button
                variant="danger"
                loading={rejectMutation.isPending}
                disabled={!actionComment}
                onClick={() => rejectMutation.mutate({ id: actionModal.programId, comments: actionComment })}
              >
                Tolak
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ChecklistItem({
  checklist,
  index,
  isExpanded,
  onToggle,
  canDelete,
  onDelete,
}: {
  checklist: AuditChecklist
  index: number
  isExpanded: boolean
  onToggle: () => void
  canDelete: boolean
  onDelete: () => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
            {index}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{checklist.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {checklist.is_mandatory ? (
                <span className="text-xs text-blue-600 font-medium">Wajib</span>
              ) : (
                <span className="text-xs text-gray-400">Tambahan</span>
              )}
              {checklist.source_criteria && (
                <span className="text-xs text-gray-400">• {checklist.source_criteria}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50 space-y-2 text-sm">
          {checklist.objective && (
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tujuan: </span>
              <span className="text-gray-700">{checklist.objective}</span>
            </div>
          )}
          {checklist.procedure_text && (
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prosedur: </span>
              <span className="text-gray-700">{checklist.procedure_text}</span>
            </div>
          )}
          {checklist.required_data && (
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Diperlukan: </span>
              <span className="text-gray-700">{checklist.required_data}</span>
            </div>
          )}
          {checklist.expected_evidence && (
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Evidence: </span>
              <span className="text-gray-700">{checklist.expected_evidence}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Inline checklist row for CreateProgramModal ---

interface ChecklistRow {
  title: string
  objective: string
  procedure_text: string
  required_data: string
  expected_evidence: string
  is_mandatory: boolean
  source_criteria: string
}

function emptyChecklist(): ChecklistRow {
  return {
    title: '',
    objective: '',
    procedure_text: '',
    required_data: '',
    expected_evidence: '',
    is_mandatory: true,
    source_criteria: '',
  }
}

function ChecklistRowEditor({
  row,
  index,
  onChange,
  onRemove,
}: {
  row: ChecklistRow
  index: number
  onChange: (row: ChecklistRow) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
          {index}
        </span>
        <input
          className="flex-1 text-sm font-medium bg-transparent border-none outline-none placeholder-gray-400"
          placeholder="Judul checklist (wajib diisi)..."
          value={row.title}
          onChange={(e) => onChange({ ...row, title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex items-center gap-2 shrink-0">
          <select
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={row.is_mandatory ? 'true' : 'false'}
            onChange={(e) => onChange({ ...row, is_mandatory: e.target.value === 'true' })}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="true">Wajib</option>
            <option value="false">Tambahan</option>
          </select>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="p-3 space-y-2 border-t border-gray-100">
          <Textarea
            label="Tujuan"
            rows={2}
            value={row.objective}
            onChange={(e) => onChange({ ...row, objective: e.target.value })}
          />
          <Textarea
            label="Prosedur Audit"
            rows={2}
            value={row.procedure_text}
            onChange={(e) => onChange({ ...row, procedure_text: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Data Diperlukan"
              value={row.required_data}
              onChange={(e) => onChange({ ...row, required_data: e.target.value })}
            />
            <Input
              label="Expected Evidence"
              value={row.expected_evidence}
              onChange={(e) => onChange({ ...row, expected_evidence: e.target.value })}
            />
          </div>
          <Input
            label="Sumber Kriteria"
            placeholder="cth. SOP-001, POJK 12/2021"
            value={row.source_criteria}
            onChange={(e) => onChange({ ...row, source_criteria: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}

// --- CreateProgramModal ---

function CreateProgramModal({
  project,
  onClose,
  onSuccess,
}: {
  project: AuditProject
  onClose: () => void
  onSuccess: () => void
}) {
  const { register, handleSubmit, setValue, watch } = useForm<{
    scope: string
    objectives: string
    criteria_summary: string
    risk_analysis: string
    data_required: string
    audit_period_start: string
    audit_period_end: string
    data_period_start: string
    data_period_end: string
  }>()

  const [checklists, setChecklists] = useState<ChecklistRow[]>([])
  const [showAIAssist, setShowAIAssist] = useState(false)

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      auditProgramsService.create(project.id, data as Parameters<typeof auditProgramsService.create>[1]),
    onSuccess,
  })

  const handleSubmitForm = handleSubmit((d) => {
    mutation.mutate({ ...d, checklists })
  })

  const applyAIDraft = (draft: AIGeneratedProgram) => {
    setValue('objectives', draft.objectives)
    setValue('scope', draft.scope)
    setValue('risk_analysis', draft.risk_analysis)
    setValue('data_required', draft.data_required)
    setValue('criteria_summary', draft.criteria_summary)
    setChecklists(
      draft.checklists.map((cl) => ({
        title: cl.title,
        objective: cl.objective,
        procedure_text: cl.procedure_text,
        required_data: cl.required_data,
        expected_evidence: cl.expected_evidence,
        is_mandatory: cl.is_mandatory,
        source_criteria: cl.source_criteria,
      }))
    )
    setShowAIAssist(false)
  }

  return (
    <>
      <Modal open onClose={onClose} title="Buat Audit Program" size="xl">
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {/* AI Assist banner */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-800 font-medium">AI Assist tersedia</span>
              <span className="text-xs text-purple-600">— Generate draft program + checklist dengan Gemini</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowAIAssist(true)}
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              AI Assist
            </Button>
          </div>

          {/* Periode fields */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Periode Audit Mulai" type="date" {...register('audit_period_start')} />
            <Input label="Periode Audit Selesai" type="date" {...register('audit_period_end')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Periode Data Pemeriksaan Mulai" type="date" {...register('data_period_start')} />
            <Input label="Periode Data Pemeriksaan Selesai" type="date" {...register('data_period_end')} />
          </div>

          <Textarea label="Lingkup Pemeriksaan" rows={3} {...register('scope')} />
          <Textarea label="Tujuan Pemeriksaan" rows={3} {...register('objectives')} />
          <Textarea label="Kriteria Pemeriksaan" rows={2} {...register('criteria_summary')} />
          <Textarea label="Analisis Risiko" rows={3} {...register('risk_analysis')} />
          <Textarea label="Data yang Diperlukan" rows={2} {...register('data_required')} />

          {/* Checklists inline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                Checklist Pemeriksaan ({checklists.length})
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setChecklists([...checklists, emptyChecklist()])}
              >
                <Plus className="w-4 h-4" />
                Tambah Checklist
              </Button>
            </div>
            {checklists.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-sm text-gray-400">Belum ada checklist. Tambah manual atau gunakan AI Assist.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {checklists.map((cl, i) => (
                  <ChecklistRowEditor
                    key={i}
                    row={cl}
                    index={i + 1}
                    onChange={(updated) => {
                      const next = [...checklists]
                      next[i] = updated
                      setChecklists(next)
                    }}
                    onRemove={() => setChecklists(checklists.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Simpan Draft
            </Button>
          </div>
        </form>
      </Modal>

      {showAIAssist && (
        <AIAssistModal
          project={project}
          onClose={() => setShowAIAssist(false)}
          onApply={applyAIDraft}
        />
      )}
    </>
  )
}

// --- AI Assist Modal ---

function AIAssistModal({
  project,
  onClose,
  onApply,
}: {
  project: AuditProject
  onClose: () => void
  onApply: (draft: AIGeneratedProgram) => void
}) {
  const [step, setStep] = useState<'input' | 'result'>('input')
  const [scope, setScope] = useState('')
  const [areas, setAreas] = useState('')
  const [criteria, setCriteria] = useState('')
  const [risks, setRisks] = useState('')
  const [model, setModel] = useState(GEMINI_MODELS[0].value)
  const [draft, setDraft] = useState<AIGeneratedProgram | null>(null)
  const [editedDraft, setEditedDraft] = useState<AIGeneratedProgram | null>(null)
  const [error, setError] = useState('')

  const generateMutation = useMutation({
    mutationFn: () =>
      auditProgramsService.generateWithAI({
        scope,
        areas,
        auditee: project.auditee?.name,
        theme: project.audit_theme,
        period:
          project.planned_start_date && project.planned_end_date
            ? `${project.planned_start_date} s/d ${project.planned_end_date}`
            : undefined,
        criteria: criteria || undefined,
        risks: risks || undefined,
        model,
        project_id: project.id,
      }),
    onSuccess: (res) => {
      if (res.data) {
        setDraft(res.data)
        setEditedDraft(JSON.parse(JSON.stringify(res.data)))
        setStep('result')
        setError('')
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Gagal generate. Coba lagi.')
    },
  })

  const updateChecklist = (i: number, updated: AIChecklist) => {
    if (!editedDraft) return
    const cls = [...editedDraft.checklists]
    cls[i] = updated
    setEditedDraft({ ...editedDraft, checklists: cls })
  }

  const removeChecklist = (i: number) => {
    if (!editedDraft) return
    setEditedDraft({
      ...editedDraft,
      checklists: editedDraft.checklists.filter((_, idx) => idx !== i),
    })
  }

  return (
    <Modal open onClose={onClose} title="AI Assist — Generate Audit Program" size="xl">
      {step === 'input' ? (
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
            AI akan generate draft Audit Program + Checklist. Auditor wajib review & edit sebelum disimpan.
          </div>

          <Textarea
            label="Scope Pemeriksaan"
            required
            rows={3}
            placeholder="cth. Pemeriksaan atas pengelolaan klaim asuransi jiwa Q1 2025..."
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />
          <Textarea
            label="Area/Bagian yang Dicakup"
            required
            rows={2}
            placeholder="cth. Proses penerimaan klaim, verifikasi dokumen, pembayaran klaim, pelaporan..."
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
          />
          <Input
            label="Kriteria/Regulasi Terkait (opsional)"
            placeholder="cth. POJK 69/2016, SOP-KLA-001, SEOJK 5/2022"
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
          />
          <Input
            label="Risiko Utama (opsional)"
            placeholder="cth. Fraud klaim, keterlambatan pembayaran, ketidaksesuaian dokumen"
            value={risks}
            onChange={(e) => setRisks(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Model Gemini</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="button"
              loading={generateMutation.isPending}
              disabled={!scope.trim() || !areas.trim()}
              onClick={() => generateMutation.mutate()}
            >
              <Sparkles className="w-4 h-4" />
              {generateMutation.isPending ? 'Generating...' : 'Generate Draft'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-700">Draft berhasil di-generate. Review & edit sebelum Apply.</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setStep('input'); setDraft(null) }}
            >
              Regenerate
            </Button>
          </div>

          {editedDraft && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <Textarea
                label="Tujuan Pemeriksaan"
                rows={3}
                value={editedDraft.objectives}
                onChange={(e) => setEditedDraft({ ...editedDraft, objectives: e.target.value })}
              />
              <Textarea
                label="Lingkup"
                rows={2}
                value={editedDraft.scope}
                onChange={(e) => setEditedDraft({ ...editedDraft, scope: e.target.value })}
              />
              <Textarea
                label="Analisis Risiko"
                rows={3}
                value={editedDraft.risk_analysis}
                onChange={(e) => setEditedDraft({ ...editedDraft, risk_analysis: e.target.value })}
              />
              <Textarea
                label="Data Diperlukan"
                rows={2}
                value={editedDraft.data_required}
                onChange={(e) => setEditedDraft({ ...editedDraft, data_required: e.target.value })}
              />
              <Textarea
                label="Kriteria Pemeriksaan"
                rows={2}
                value={editedDraft.criteria_summary}
                onChange={(e) => setEditedDraft({ ...editedDraft, criteria_summary: e.target.value })}
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Checklist ({editedDraft.checklists.length})
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEditedDraft({
                        ...editedDraft,
                        checklists: [
                          ...editedDraft.checklists,
                          {
                            title: '',
                            objective: '',
                            procedure_text: '',
                            required_data: '',
                            expected_evidence: '',
                            is_mandatory: true,
                            source_criteria: '',
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="w-4 h-4" />
                    Tambah
                  </Button>
                </div>
                <div className="space-y-2">
                  {editedDraft.checklists.map((cl, i) => (
                    <AIChecklistEditor
                      key={i}
                      checklist={cl}
                      index={i + 1}
                      onChange={(updated) => updateChecklist(i, updated)}
                      onRemove={() => removeChecklist(i)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => editedDraft && onApply(editedDraft)}
              disabled={!editedDraft}
            >
              <CheckCircle className="w-4 h-4" />
              Apply Draft ke Form
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function AIChecklistEditor({
  checklist,
  index,
  onChange,
  onRemove,
}: {
  checklist: AIChecklist
  index: number
  onChange: (cl: AIChecklist) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700 shrink-0">
          {index}
        </span>
        <input
          className="flex-1 text-sm font-medium bg-transparent border-none outline-none"
          value={checklist.title}
          onChange={(e) => onChange({ ...checklist, title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex items-center gap-1 shrink-0">
          <select
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5"
            value={checklist.is_mandatory ? 'true' : 'false'}
            onChange={(e) => onChange({ ...checklist, is_mandatory: e.target.value === 'true' })}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="true">Wajib</option>
            <option value="false">Tambahan</option>
          </select>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="p-1 text-gray-300 hover:text-red-500"
          >
            <X className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="p-3 space-y-2 border-t border-gray-100 text-sm">
          <Textarea
            label="Tujuan"
            rows={2}
            value={checklist.objective}
            onChange={(e) => onChange({ ...checklist, objective: e.target.value })}
          />
          <Textarea
            label="Prosedur"
            rows={2}
            value={checklist.procedure_text}
            onChange={(e) => onChange({ ...checklist, procedure_text: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Data Diperlukan"
              value={checklist.required_data}
              onChange={(e) => onChange({ ...checklist, required_data: e.target.value })}
            />
            <Input
              label="Expected Evidence"
              value={checklist.expected_evidence}
              onChange={(e) => onChange({ ...checklist, expected_evidence: e.target.value })}
            />
          </div>
          <Input
            label="Sumber Kriteria"
            value={checklist.source_criteria}
            onChange={(e) => onChange({ ...checklist, source_criteria: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}

function AddChecklistModal({
  programId,
  onClose,
  onSuccess,
}: {
  programId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const { register, handleSubmit } = useForm<{
    title: string
    objective: string
    procedure_text: string
    required_data: string
    expected_evidence: string
    source_criteria: string
    is_mandatory: string
  }>({
    defaultValues: { is_mandatory: 'true' },
  })

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      auditProgramsService.createChecklist(programId, {
        ...data,
        is_mandatory: data.is_mandatory === 'true',
      }),
    onSuccess,
  })

  return (
    <Modal open onClose={onClose} title="Tambah Checklist" size="lg">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Input label="Judul Checklist" required {...register('title')} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Jenis</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('is_mandatory')}
          >
            <option value="true">Wajib (Mandatory)</option>
            <option value="false">Tambahan (Additional)</option>
          </select>
        </div>
        <Textarea label="Tujuan" rows={2} {...register('objective')} />
        <Textarea label="Prosedur Audit" rows={3} {...register('procedure_text')} />
        <Input label="Data yang Diperlukan" {...register('required_data')} />
        <Input label="Expected Evidence" {...register('expected_evidence')} />
        <Input label="Sumber Kriteria (SOP/POJK/dll)" {...register('source_criteria')} />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Tambah
          </Button>
        </div>
      </form>
    </Modal>
  )
}
