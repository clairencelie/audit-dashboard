import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import api from '@/lib/axios'
import { auditProgramsService } from '@/services/auditPrograms'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
} from 'lucide-react'
import type { ApprovalRequest, AuditProgram, AuditChecklist } from '@/types'
import { PROGRAM_STATUS_LABELS } from '@/types'

// ---- Stage labels ----
const STAGE_LABELS: Record<string, string> = {
  spv: 'Supervisor (SPV)',
  dept_head: 'Kepala Bagian',
  div_head: 'Kepala Divisi',
}

export function ApprovalsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<{
    open: boolean
    type: 'approve' | 'reject'
    entityId: string
    entityType: string
  }>({ open: false, type: 'approve', entityId: '', entityType: '' })
  const [comment, setComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['approvals-pending'],
    queryFn: async () => {
      const res = await api.get('/approvals/pending')
      return res.data.data as ApprovalRequest[]
    },
  })

  const approveMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments: string }) =>
      api.post(`/audit-programs/${id}/approve`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals-pending'] })
      closeModal()
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments: string }) =>
      api.post(`/audit-programs/${id}/reject`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals-pending'] })
      closeModal()
    },
  })

  const closeModal = () => {
    setActionModal({ open: false, type: 'approve', entityId: '', entityType: '' })
    setComment('')
  }

  const handleAction = () => {
    if (actionModal.type === 'approve') {
      approveMutation.mutate({ id: actionModal.entityId, comments: comment })
    } else {
      rejectMutation.mutate({ id: actionModal.entityId, comments: comment })
    }
  }

  const approvals = data ?? []

  return (
    <div>
      <TopBar breadcrumbs={[{ label: 'Approvals' }]} title="Approvals" />

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <Card className="text-center py-16">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
            <p className="text-gray-500 font-medium">Tidak ada approval yang perlu ditindaklanjuti</p>
            <p className="text-sm text-gray-400 mt-1">Semua sudah beres!</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                isExpanded={expandedId === approval.id}
                onToggle={() =>
                  setExpandedId(expandedId === approval.id ? null : approval.id)
                }
                onApprove={() =>
                  setActionModal({
                    open: true,
                    type: 'approve',
                    entityId: approval.entity_id,
                    entityType: approval.entity_type,
                  })
                }
                onReject={() =>
                  setActionModal({
                    open: true,
                    type: 'reject',
                    entityId: approval.entity_id,
                    entityType: approval.entity_type,
                  })
                }
                onNavigate={(projectId) => navigate(`/audit-projects/${projectId}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Approve / Reject Modal */}
      <Modal
        open={actionModal.open}
        onClose={closeModal}
        title={actionModal.type === 'approve' ? 'Approve Audit Program' : 'Tolak Audit Program'}
        size="sm"
      >
        <div className="space-y-4">
          {actionModal.type === 'approve' ? (
            <p className="text-sm text-gray-600">
              Kamu akan menyetujui audit program ini dan meneruskan ke tahap berikutnya.
              Opsional: tambahkan catatan/komentar untuk auditor.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Audit program akan dikembalikan ke auditor untuk direvisi.
            </p>
          )}
          <Textarea
            label={actionModal.type === 'approve' ? 'Komentar (opsional)' : 'Alasan Penolakan'}
            required={actionModal.type === 'reject'}
            rows={3}
            placeholder={
              actionModal.type === 'approve'
                ? 'Catatan untuk auditor (opsional)...'
                : 'Jelaskan alasan penolakan dan perbaikan yang diperlukan...'
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeModal}>
              Batal
            </Button>
            <Button
              variant={actionModal.type === 'reject' ? 'danger' : 'primary'}
              loading={approveMutation.isPending || rejectMutation.isPending}
              disabled={actionModal.type === 'reject' && !comment.trim()}
              onClick={handleAction}
            >
              {actionModal.type === 'approve' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Tolak
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ---- ApprovalCard component ----

function ApprovalCard({
  approval,
  isExpanded,
  onToggle,
  onApprove,
  onReject,
  onNavigate,
}: {
  approval: ApprovalRequest
  isExpanded: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  onNavigate: (projectId: string) => void
}) {
  const { data: programData, isLoading: isProgramLoading } = useQuery({
    queryKey: ['approval-program-detail', approval.entity_id],
    queryFn: () => auditProgramsService.get(approval.entity_id),
    enabled: isExpanded && approval.entity_type === 'audit_program',
  })

  // Fetch all approval requests for this entity to show full history
  const { data: historyData } = useQuery({
    queryKey: ['approval-history', approval.entity_id],
    queryFn: async () => {
      const res = await api.get(
        `/approvals?entity_type=${approval.entity_type}&entity_id=${approval.entity_id}`
      )
      return res.data.data as ApprovalRequest[]
    },
    enabled: isExpanded && approval.entity_type === 'audit_program',
  })

  const program = programData?.data as AuditProgram | undefined
  const allApprovals = historyData ?? []

  return (
    <Card className="overflow-hidden">
      {/* Card header — always visible */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {approval.entity_type === 'audit_program' ? 'Audit Program' : approval.entity_type?.replace(/_/g, ' ')}{' '}
              <span className="text-blue-600">— Review Stage: {STAGE_LABELS[approval.approval_stage] ?? approval.approval_stage}</span>
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              Diajukan oleh <strong>{approval.requested_by?.name}</strong>{' '}
              pada {formatDateTime(approval.submitted_at)}
            </p>

            {/* Previous histories on this specific approval request */}
            {approval.histories?.map((h) => (
              <div key={h.id} className="mt-1 flex items-start gap-1.5">
                {h.action === 'approved' ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                )}
                <span className="text-xs text-gray-500">
                  <strong>{h.approver?.name}</strong>: {h.comments || '(tanpa komentar)'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" />
            Menunggu Review
          </span>
          <Button size="sm" variant="ghost" onClick={onToggle}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isExpanded ? 'Sembunyikan' : 'Lihat Program'}
          </Button>
          <Button size="sm" variant="danger" onClick={onReject}>
            <XCircle className="w-4 h-4" />
            Tolak
          </Button>
          <Button size="sm" onClick={onApprove}>
            <CheckCircle className="w-4 h-4" />
            Approve
          </Button>
        </div>
      </div>

      {/* Expanded: program details + full history */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {isProgramLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
            </div>
          ) : program ? (
            <div className="space-y-4">
              {/* Navigate to project */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {PROGRAM_STATUS_LABELS[program.status] ?? program.status}
                  </span>
                  <span className="text-xs text-gray-400">v{program.version}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigate(program.audit_project_id)}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Project
                </Button>
              </div>

              {/* Program content */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Periode Audit</p>
                  <p className="font-medium text-gray-800">
                    {formatDate(program.audit_period_start)} – {formatDate(program.audit_period_end)}
                  </p>
                </div>
                {program.data_period_start && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Periode Data</p>
                    <p className="font-medium text-gray-800">
                      {formatDate(program.data_period_start)} – {formatDate(program.data_period_end)}
                    </p>
                  </div>
                )}
              </div>

              {program.scope && (
                <ProgramField label="Lingkup" value={program.scope} />
              )}
              {program.objectives && (
                <ProgramField label="Tujuan" value={program.objectives} />
              )}
              {program.risk_analysis && (
                <ProgramField label="Analisis Risiko" value={program.risk_analysis} />
              )}
              {program.data_required && (
                <ProgramField label="Data Diperlukan" value={program.data_required} />
              )}
              {program.criteria_summary && (
                <ProgramField label="Kriteria" value={program.criteria_summary} />
              )}

              {/* Checklists */}
              {program.checklists && program.checklists.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Checklist ({program.checklists.length})
                  </p>
                  <div className="space-y-1.5">
                    {program.checklists.map((cl, i) => (
                      <ExpandableChecklist key={cl.id} checklist={cl} index={i + 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Full approval history across all stages */}
              {allApprovals.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Riwayat Approval
                  </p>
                  <div className="space-y-2">
                    {allApprovals.map((req) => (
                      <div key={req.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-700">
                            Stage: {STAGE_LABELS[req.approval_stage] ?? req.approval_stage}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            req.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : req.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {req.status === 'approved' ? 'Disetujui' : req.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                          </span>
                        </div>
                        {req.histories?.map((h) => (
                          <div key={h.id} className="flex items-start gap-2 text-xs text-gray-600">
                            {h.action === 'approved' ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                            )}
                            <div>
                              <strong>{h.approver?.name}</strong>
                              {h.comments && (
                                <p className="text-gray-500 mt-0.5 whitespace-pre-wrap">{h.comments}</p>
                              )}
                              <p className="text-gray-400">{formatDateTime(h.action_at)}</p>
                            </div>
                          </div>
                        ))}
                        {(!req.histories || req.histories.length === 0) && (
                          <p className="text-xs text-gray-400">Belum ada tindakan</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  )
}

function ProgramField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function ExpandableChecklist({ checklist: cl, index }: { checklist: AuditChecklist; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = cl.procedure_text || cl.required_data || cl.expected_evidence

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
      <div
        className={`flex items-start gap-2 p-2.5 bg-gray-50 ${hasDetail ? 'cursor-pointer hover:bg-gray-100' : ''} transition-colors`}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <span className="w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800">{cl.title}</p>
          {cl.objective && (
            <p className="text-xs text-gray-500 mt-0.5">{cl.objective}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cl.is_mandatory ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
              {cl.is_mandatory ? 'Wajib' : 'Tambahan'}
            </span>
            {cl.source_criteria && (
              <span className="text-xs text-gray-400">{cl.source_criteria}</span>
            )}
          </div>
        </div>
        {hasDetail && (
          <div className="shrink-0 mt-0.5">
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-white space-y-2">
          {cl.procedure_text && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Prosedur Audit</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{cl.procedure_text}</p>
            </div>
          )}
          {cl.required_data && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Data Diperlukan</p>
              <p className="text-xs text-gray-700">{cl.required_data}</p>
            </div>
          )}
          {cl.expected_evidence && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Expected Evidence</p>
              <p className="text-xs text-gray-700">{cl.expected_evidence}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
