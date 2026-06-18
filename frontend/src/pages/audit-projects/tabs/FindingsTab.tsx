import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { findingsService } from '@/services/findings'
import type { FindingPayload, FindingAuditeeResponsePayload, FindingAttachmentUploadPayload } from '@/services/findings'
import { formatDate } from '@/lib/utils'
import type { AuditProject, Finding, FindingAttachment, ChecklistExecution, ApiResponse } from '@/types'
import {
  FINDING_STATUS_LABELS,
  FINDING_STATUS_COLORS,
  FINDING_RISK_RATING_LABELS,
  FINDING_RISK_RATING_COLORS,
  FINDING_CATEGORY_OPTIONS,
  FINDING_RISK_TYPE_OPTIONS,
  FINDING_CAUSE_CATEGORIES,
} from '@/types'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/axios'
import {
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Paperclip,
  Upload,
  ExternalLink,
  File,
} from 'lucide-react'

interface Props {
  project: AuditProject
}

const RISK_OPTIONS = [
  { value: 'low', label: 'Rendah' },
  { value: 'medium', label: 'Sedang' },
  { value: 'high', label: 'Tinggi' },
]

type CategoryKey = 'kebijakan' | 'sistem' | 'sdm' | 'eksternal'

interface CategoryEntry {
  category: CategoryKey
  text: string
}

function fieldsToEntries(fields: Partial<Record<CategoryKey, string | undefined>>): CategoryEntry[] {
  return FINDING_CAUSE_CATEGORIES
    .filter((c) => fields[c.key])
    .map((c) => ({ category: c.key, text: fields[c.key] as string }))
}

function entriesToFields(entries: CategoryEntry[]): Record<CategoryKey, string> {
  const result: Record<CategoryKey, string> = { kebijakan: '', sistem: '', sdm: '', eksternal: '' }
  entries.forEach((e) => { result[e.category] = e.text })
  return result
}

function makeNonNegativeHandler(setter: (v: string) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0)) {
      setter(v)
    }
  }
}

function formatCurrency(value: number): string {
  if (!value) return '—'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Stage 1 gate: a finding may only be submitted for review once the condition/impact
// baseline — what SPV through Div Head will actually be approving — is complete,
// and at least one lampiran has been attached.
function getFindingGaps(finding: Finding): string[] {
  const gaps: string[] = []
  if (!finding.subject_area) gaps.push('Subjek Pemeriksaan')
  if (!finding.finding_category) gaps.push('Kategori Temuan')
  if (!finding.criteria_text) gaps.push('Kriteria')
  if (!finding.risk_type) gaps.push('Jenis Risiko')
  if (!finding.risk_rating) gaps.push('Tingkat Risiko')
  if (!finding.condition_text) gaps.push('Kondisi')
  if (!finding.impact_quantity || finding.impact_quantity <= 0) gaps.push('Jumlah (Dampak)')
  if (!finding.impact_potential_risk) gaps.push('Potensi Risiko (Dampak)')
  if (!finding.attachments || finding.attachments.length === 0) gaps.push('Lampiran (minimal 1 file)')
  return gaps
}

// Stage 2 gate: before recording the auditee's response to the recommendation,
// Penyebab and Rekomendasi must each have at least one category filled in.
function hasCauseAndRecommendation(finding: Finding): boolean {
  const hasCause = !!(finding.cause_kebijakan || finding.cause_sistem || finding.cause_sdm || finding.cause_eksternal)
  const hasRec = !!(finding.rec_kebijakan || finding.rec_sistem || finding.rec_sdm || finding.rec_eksternal)
  return hasCause && hasRec
}

export function FindingsTab({ project }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Finding | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<Finding | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Finding | null>(null)
  const [auditeeResponseTarget, setAuditeeResponseTarget] = useState<Finding | null>(null)

  const isAuditor = user?.role === 'auditor'
  const isAdmin = user?.role === 'admin'
  const isApprover = ['spv', 'dept_head', 'div_head'].includes(user?.role ?? '')
  const canCreate = isAuditor || isAdmin

  const { data: findingsRes, isLoading } = useQuery({
    queryKey: ['findings', project.id],
    queryFn: () => findingsService.list(project.id),
  })

  const findingsList = findingsRes?.data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: findingsService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['findings', project.id] }),
  })

  const submitMutation = useMutation({
    mutationFn: findingsService.submit,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['findings', project.id] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      alert(msg ?? 'Gagal submit untuk review')
    },
  })

  const handleSubmitReview = (finding: Finding) => {
    const gaps = getFindingGaps(finding)
    if (gaps.length > 0) {
      alert(`Lengkapi field berikut sebelum submit untuk review:\n- ${gaps.join('\n- ')}`)
      return
    }
    submitMutation.mutate(finding.id)
  }

  const stats = {
    total: findingsList.length,
    draft: findingsList.filter((f) => f.status === 'draft').length,
    inReview: findingsList.filter((f) => ['submitted', 'approved_spv', 'approved_dept_head'].includes(f.status)).length,
    approved: findingsList.filter((f) => f.status === 'final_approved' || f.status === 'auditee_responded').length,
    high: findingsList.filter((f) => f.risk_rating === 'high').length,
    totalLoss: findingsList.reduce((sum, f) => sum + (f.impact_loss_value || 0), 0),
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
          <h2 className="text-base font-semibold text-gray-900">Finding Management — Laporan Hasil Audit</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats.total} temuan · {stats.high} risiko tinggi
            {stats.totalLoss > 0 && ` · Total potensi kerugian ${formatCurrency(stats.totalLoss)}`}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditTarget(null); setShowCreateModal(true) }} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Tambah Temuan
          </Button>
        )}
      </div>

      {/* Stats */}
      {findingsList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Draft', value: stats.draft, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: 'Dalam Review', value: stats.inReview, color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: 'Final Approved', value: stats.approved, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Risiko Tinggi', value: stats.high, color: 'text-red-700', bg: 'bg-red-50' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center border border-gray-100`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {findingsList.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Belum ada temuan untuk project ini.</p>
            {canCreate && (
              <Button className="mt-3" onClick={() => { setEditTarget(null); setShowCreateModal(true) }}>
                Buat Temuan Pertama
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {findingsList.map((finding, idx) => {
            const pendingApproval = finding.approval_requests?.find((ar) => ar.status === 'pending')
            const isMyTurnToApprove = isApprover && !!pendingApproval && pendingApproval.current_approver_id === user?.id
            return (
            <FindingCard
              key={finding.id}
              no={idx + 1}
              finding={finding}
              expanded={expandedId === finding.id}
              onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
              canEdit={(canCreate && ['draft', 'need_revision', 'final_approved'].includes(finding.status) && finding.created_by_id === user?.id) || isAdmin}
              canDelete={canCreate && finding.status === 'draft' && (finding.created_by_id === user?.id || isAdmin)}
              canSubmit={(isAuditor || isAdmin) && (finding.status === 'draft' || finding.status === 'need_revision') && finding.created_by_id === user?.id}
              canApprove={isMyTurnToApprove}
              canReject={isMyTurnToApprove}
              canAuditeeResponse={(isAuditor || isAdmin) && ['final_approved', 'auditee_responded'].includes(finding.status) && hasCauseAndRecommendation(finding)}
              canUploadAttachment={canCreate}
              onEdit={() => { setEditTarget(finding); setShowCreateModal(true) }}
              onDelete={() => { if (confirm('Hapus temuan ini?')) deleteMutation.mutate(finding.id) }}
              onSubmit={() => handleSubmitReview(finding)}
              onApprove={() => setApproveTarget(finding)}
              onReject={() => setRejectTarget(finding)}
              onAuditeeResponse={() => setAuditeeResponseTarget(finding)}
            />
            )
          })}
        </div>
      )}

      {showCreateModal && (
        <FindingFormModal
          project={project}
          finding={editTarget}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['findings', project.id] })
          }}
        />
      )}

      {approveTarget && (
        <ApproveModal
          finding={approveTarget}
          onClose={() => setApproveTarget(null)}
          onSuccess={() => {
            setApproveTarget(null)
            queryClient.invalidateQueries({ queryKey: ['findings', project.id] })
          }}
        />
      )}

      {rejectTarget && (
        <RejectModal
          finding={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onSuccess={() => {
            setRejectTarget(null)
            queryClient.invalidateQueries({ queryKey: ['findings', project.id] })
          }}
        />
      )}

      {auditeeResponseTarget && (
        <AuditeeResponseModal
          finding={auditeeResponseTarget}
          onClose={() => setAuditeeResponseTarget(null)}
          onSuccess={() => {
            setAuditeeResponseTarget(null)
            queryClient.invalidateQueries({ queryKey: ['findings', project.id] })
          }}
        />
      )}
    </div>
  )
}

function FieldBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function CauseRecGrid({ title, values }: { title: string; values: { kebijakan?: string; sistem?: string; sdm?: string; eksternal?: string } }) {
  const entries = FINDING_CAUSE_CATEGORIES.map((cat) => ({
    label: cat.label,
    value: values[cat.key as keyof typeof values],
  })).filter((e) => e.value)

  if (entries.length === 0) return null

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {entries.map((e) => (
          <div key={e.label} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
            <p className="text-[11px] font-semibold text-gray-500 mb-0.5">{e.label}</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function FormSection({
  step, title, required, action, children,
}: {
  step?: number
  title: React.ReactNode
  required?: boolean
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          {step !== undefined && (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold shrink-0">
              {step}
            </span>
          )}
          <h3 className="text-sm font-semibold text-gray-800">
            {title}
            {required && <span className="text-red-500 ml-1">*</span>}
          </h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function CategoryEntriesEditor({
  step, label, addLabel, entries, onChange,
}: {
  step?: number
  label: string
  addLabel: string
  entries: CategoryEntry[]
  onChange: (entries: CategoryEntry[]) => void
}) {
  const usedCategories = entries.map((e) => e.category)
  const availableCategories = FINDING_CAUSE_CATEGORIES.filter((c) => !usedCategories.includes(c.key))

  const addEntry = () => {
    if (availableCategories.length === 0) return
    onChange([...entries, { category: availableCategories[0].key, text: '' }])
  }

  const updateEntry = (idx: number, patch: Partial<CategoryEntry>) => {
    onChange(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)))
  }

  const removeEntry = (idx: number) => {
    onChange(entries.filter((_, i) => i !== idx))
  }

  return (
    <FormSection
      step={step}
      title={label}
      action={
        availableCategories.length > 0 && (
          <Button type="button" size="sm" variant="outline" className="text-xs gap-1 px-2 py-1" onClick={addEntry}>
            <Plus className="w-3.5 h-3.5" />
            {addLabel}
          </Button>
        )
      }
    >
      {entries.length === 0 && (
        <p className="text-xs text-gray-400">Belum ada {label.toLowerCase()}. Klik "{addLabel}" untuk menambahkan.</p>
      )}
      <div className="space-y-2">
        {entries.map((entry, idx) => {
          const rowOptions = [
            FINDING_CAUSE_CATEGORIES.find((c) => c.key === entry.category)!,
            ...availableCategories,
          ]
          return (
            <div key={entry.category} className="flex gap-2 items-start bg-gray-50 rounded-lg p-2.5 border border-gray-100">
              <div className="w-32 shrink-0">
                <Select
                  value={entry.category}
                  onChange={(e) => updateEntry(idx, { category: e.target.value as CategoryKey })}
                  options={rowOptions.map((c) => ({ value: c.key, label: c.label }))}
                />
              </div>
              <Textarea
                className="flex-1"
                rows={2}
                value={entry.text}
                onChange={(e) => updateEntry(idx, { text: e.target.value })}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 px-2 py-1 shrink-0"
                onClick={() => removeEntry(idx)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )
        })}
      </div>
    </FormSection>
  )
}

const APPROVAL_HISTORY_PAGE_SIZE = 5

function ApprovalHistorySection({ findingId, status }: { findingId: string; status: string }) {
  const [page, setPage] = useState(1)

  const { data } = useQuery({
    queryKey: ['finding-approval-history', findingId],
    queryFn: () => findingsService.get(findingId),
  })

  const histories = (data?.data?.data?.approval_requests ?? [])
    .flatMap((ar) => ar.histories ?? [])
    .sort((a, b) => new Date(b.action_at).getTime() - new Date(a.action_at).getTime())

  if (histories.length === 0) return null

  const totalPages = Math.max(1, Math.ceil(histories.length / APPROVAL_HISTORY_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = histories.slice(
    (currentPage - 1) * APPROVAL_HISTORY_PAGE_SIZE,
    currentPage * APPROVAL_HISTORY_PAGE_SIZE
  )

  return (
    <div className="border-t border-gray-100 pt-3">
      <p className="text-xs font-medium text-gray-500 mb-1.5">
        Riwayat Approval
        {status === 'need_revision' && (
          <span className="ml-1.5 text-red-600 font-semibold">— lihat catatan revisi di bawah</span>
        )}
      </p>
      <div className="space-y-1.5">
        {paged.map((h) => (
          <div
            key={h.id}
            className={`text-xs rounded-lg p-2.5 border ${
              h.action === 'approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-medium text-gray-700">{h.approver?.name}</span>
              <span className={h.action === 'approved' ? 'text-green-600' : 'text-red-600'}>
                {h.action === 'approved' ? 'Disetujui' : 'Ditolak'} · {formatDate(h.action_at)}
              </span>
            </div>
            {h.comments && <p className="text-gray-700 mt-1 whitespace-pre-wrap">{h.comments}</p>}
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs px-2 py-1"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </Button>
          <span className="text-xs text-gray-400">Halaman {currentPage} dari {totalPages}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs px-2 py-1"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}
    </div>
  )
}

interface FindingCardProps {
  no: number
  finding: Finding
  expanded: boolean
  onToggle: () => void
  canEdit: boolean
  canDelete: boolean
  canSubmit: boolean
  canApprove: boolean
  canReject: boolean
  canAuditeeResponse: boolean
  canUploadAttachment: boolean
  onEdit: () => void
  onDelete: () => void
  onSubmit: () => void
  onApprove: () => void
  onReject: () => void
  onAuditeeResponse: () => void
}

function FindingCard({
  no, finding, expanded, onToggle,
  canEdit, canDelete, canSubmit, canApprove, canReject, canAuditeeResponse, canUploadAttachment,
  onEdit, onDelete, onSubmit, onApprove, onReject, onAuditeeResponse,
}: FindingCardProps) {
  const needsReview = canApprove
  const hasAuditeeRec = finding.auditee_rec_kebijakan || finding.auditee_rec_sistem || finding.auditee_rec_sdm || finding.auditee_rec_eksternal
  const needsRecommendation = finding.status === 'final_approved' && !hasCauseAndRecommendation(finding)

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${needsReview ? 'border-yellow-300' : 'border-gray-200'}`}>
      {/* Header row */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-gray-400 w-6 shrink-0">#{no}</span>
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            finding.risk_rating === 'high' ? 'bg-orange-500' :
            finding.risk_rating === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
          }`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-gray-900 text-sm truncate">{finding.finding_category || 'Tanpa Kategori'}</p>
              {finding.risk_type && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full shrink-0">
                  {finding.risk_type}
                </span>
              )}
              {needsReview && (
                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  PERLU REVIEW
                </span>
              )}
              {finding.status === 'need_revision' && (
                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  PERLU REVISI
                </span>
              )}
              {needsRecommendation && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  LENGKAPI PENYEBAB & REKOMENDASI
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {finding.subject_area || 'Tanpa subjek pemeriksaan'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FINDING_RISK_RATING_COLORS[finding.risk_rating] ?? 'bg-gray-100 text-gray-600'}`}>
            {FINDING_RISK_RATING_LABELS[finding.risk_rating] ?? finding.risk_rating}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FINDING_STATUS_COLORS[finding.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {FINDING_STATUS_LABELS[finding.status] ?? finding.status}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
          <FieldBlock label="Kriteria" value={finding.criteria_text} />
          <FieldBlock label="Jenis Risiko" value={finding.risk_type} />
          <FieldBlock label="Kondisi" value={finding.condition_text} />

          {(finding.impact_quantity > 0 || finding.impact_loss_value > 0 || finding.impact_potential_risk) && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Dampak</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 text-center">
                  <p className="text-[11px] text-gray-500">Jumlah</p>
                  <p className="text-sm font-semibold text-gray-900">{finding.impact_quantity || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 text-center">
                  <p className="text-[11px] text-gray-500">Nilai Kerugian</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(finding.impact_loss_value)}</p>
                </div>
              </div>
              <FieldBlock label="Potensi Risiko" value={finding.impact_potential_risk} />
            </div>
          )}

          <FieldBlock label="Tanggapan Auditee Terhadap Kondisi" value={finding.auditee_response_condition} />

          <CauseRecGrid
            title="Penyebab"
            values={{
              kebijakan: finding.cause_kebijakan,
              sistem: finding.cause_sistem,
              sdm: finding.cause_sdm,
              eksternal: finding.cause_eksternal,
            }}
          />

          <CauseRecGrid
            title="Rekomendasi"
            values={{
              kebijakan: finding.rec_kebijakan,
              sistem: finding.rec_sistem,
              sdm: finding.rec_sdm,
              eksternal: finding.rec_eksternal,
            }}
          />

          {hasAuditeeRec && (
            <CauseRecGrid
              title="Tanggapan Auditee Terhadap Rekomendasi"
              values={{
                kebijakan: finding.auditee_rec_kebijakan,
                sistem: finding.auditee_rec_sistem,
                sdm: finding.auditee_rec_sdm,
                eksternal: finding.auditee_rec_eksternal,
              }}
            />
          )}

          {(finding.auditee_pic || finding.deadline_date) && (
            <div className="flex gap-4 text-sm">
              {finding.auditee_pic && (
                <span className="text-gray-600">PIC Auditee: <strong className="text-gray-900">{finding.auditee_pic}</strong></span>
              )}
              {finding.deadline_date && (
                <span className="text-gray-600">Deadline: <strong className="text-gray-900">{formatDate(finding.deadline_date)}</strong></span>
              )}
            </div>
          )}

          {finding.checklist_execution?.audit_checklist && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-0.5">Terkait Checklist</p>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                {finding.checklist_execution.audit_checklist.title}
              </span>
            </div>
          )}

          {/* Attachments / Lampiran */}
          <FindingAttachments finding={finding} canUpload={canUploadAttachment} />

          {/* Riwayat Approval — paling bawah karena ini info referensi, bukan yang utama dibaca */}
          <ApprovalHistorySection findingId={finding.id} status={finding.status} />

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-gray-100">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                {finding.status === 'final_approved' ? 'Lengkapi Penyebab & Rekomendasi' : 'Edit'}
              </Button>
            )}
            {canSubmit && (
              <Button size="sm" onClick={onSubmit} className="gap-1">
                <Send className="w-3.5 h-3.5" />
                Submit untuk Review
              </Button>
            )}
            {canApprove && (
              <Button size="sm" onClick={onApprove} className="gap-1 bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve
              </Button>
            )}
            {canReject && (
              <Button size="sm" variant="outline" onClick={onReject} className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </Button>
            )}
            {canAuditeeResponse && (
              <Button size="sm" variant="outline" onClick={onAuditeeResponse} className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50">
                <MessageSquare className="w-3.5 h-3.5" />
                Input Respons Auditee
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:bg-red-50 border-red-200"
                onClick={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FindingAttachments({ finding, canUpload }: { finding: Finding; canUpload: boolean }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  const { data: attRes } = useQuery({
    queryKey: ['finding-attachments', finding.id],
    queryFn: () => findingsService.listAttachments(finding.id),
  })

  const attachments = attRes?.data?.data ?? finding.attachments ?? []

  const uploadMutation = useMutation({
    mutationFn: (payload: FindingAttachmentUploadPayload) => findingsService.uploadAttachment(finding.id, payload),
    onSuccess: () => {
      setShowUpload(false)
      setTitle('')
      setFile(null)
      queryClient.invalidateQueries({ queryKey: ['finding-attachments', finding.id] })
      queryClient.invalidateQueries({ queryKey: ['findings', finding.audit_project_id] })
    },
    onError: () => setError('Gagal mengupload lampiran. Periksa konfigurasi Google Drive atau coba lagi.'),
  })

  const deleteMutation = useMutation({
    mutationFn: findingsService.deleteAttachment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finding-attachments', finding.id] })
      queryClient.invalidateQueries({ queryKey: ['findings', finding.audit_project_id] })
    },
  })

  const handleUpload = () => {
    setError('')
    if (!title.trim()) { setError('Label lampiran wajib diisi'); return }
    if (!file) { setError('File wajib dipilih'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Ukuran file maksimal 20MB'); return }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      uploadMutation.mutate({
        title: title.trim(),
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
        file_data: base64,
      })
    }
    reader.onerror = () => setError('Gagal membaca file')
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
          <Paperclip className="w-3.5 h-3.5" />
          Lampiran ({attachments.length})
        </p>
        {canUpload && (
          <Button size="sm" variant="outline" className="text-xs px-2 py-1 gap-1" onClick={() => setShowUpload(true)}>
            <Upload className="w-3.5 h-3.5" />
            Tambah Lampiran
          </Button>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((a: FindingAttachment) => (
            <div key={a.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{a.title}</p>
                  <p className="text-[11px] text-gray-400">{a.file_name} · {formatFileSize(a.file_size)} · {a.uploaded_by?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={a.drive_file_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="px-2 py-1 text-xs gap-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
                {canUpload && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="px-2 py-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { if (confirm('Hapus lampiran ini?')) deleteMutation.mutate(a.id) }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Label lampiran, mis. Lampiran 5 - Bukti Opname" />
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 bg-white transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <span className="text-sm text-gray-700">{file.name} ({formatFileSize(file.size)})</span>
            ) : (
              <span className="text-xs text-gray-400">Klik untuk pilih file (maks. 20MB)</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowUpload(false); setError('') }}>Batal</Button>
            <Button size="sm" onClick={handleUpload} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Upload
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface FindingFormModalProps {
  project: AuditProject
  finding: Finding | null
  onClose: () => void
  onSuccess: () => void
}

function FindingFormModal({ project, finding, onClose, onSuccess }: FindingFormModalProps) {
  const [subjectArea, setSubjectArea] = useState(finding?.subject_area ?? '')
  const [findingCategory, setFindingCategory] = useState(finding?.finding_category ?? '')
  const [criteriaText, setCriteriaText] = useState(finding?.criteria_text ?? '')
  const [riskType, setRiskType] = useState(finding?.risk_type ?? '')
  const [riskRating, setRiskRating] = useState<string>(finding?.risk_rating ?? 'medium')
  const [conditionText, setConditionText] = useState(finding?.condition_text ?? '')
  const [impactQuantity, setImpactQuantity] = useState(finding?.impact_quantity?.toString() ?? '')
  const [impactLossValue, setImpactLossValue] = useState(finding?.impact_loss_value?.toString() ?? '')
  const [impactPotentialRisk, setImpactPotentialRisk] = useState(finding?.impact_potential_risk ?? '')
  const [auditeeResponseCondition, setAuditeeResponseCondition] = useState(finding?.auditee_response_condition ?? '')
  const [causeEntries, setCauseEntries] = useState<CategoryEntry[]>(() => fieldsToEntries({
    kebijakan: finding?.cause_kebijakan,
    sistem: finding?.cause_sistem,
    sdm: finding?.cause_sdm,
    eksternal: finding?.cause_eksternal,
  }))
  const [recEntries, setRecEntries] = useState<CategoryEntry[]>(() => fieldsToEntries({
    kebijakan: finding?.rec_kebijakan,
    sistem: finding?.rec_sistem,
    sdm: finding?.rec_sdm,
    eksternal: finding?.rec_eksternal,
  }))
  const [auditeePIC, setAuditeePIC] = useState(finding?.auditee_pic ?? '')
  const [deadlineDate, setDeadlineDate] = useState(finding?.deadline_date?.slice(0, 10) ?? '')
  const [executionId, setExecutionId] = useState(finding?.checklist_execution_id ?? '')
  const [error, setError] = useState('')

  // Once a finding is final_approved, the condition/impact baseline is locked —
  // only Penyebab, Rekomendasi, PIC, and deadline may still be edited (LHA stage 2).
  const isRecommendationOnly = finding?.status === 'final_approved'

  const { data: execRes } = useQuery({
    queryKey: ['checklist-executions', project.id],
    queryFn: () => api.get<ApiResponse<ChecklistExecution[]>>(`/projects/${project.id}/checklist-executions`),
    enabled: !finding,
  })

  const executions = execRes?.data?.data ?? []
  const executionOptions = [
    { value: '', label: '— Tidak terkait checklist —' },
    ...executions
      .filter((e) => e.exception_found || e.potential_finding)
      .map((e) => ({ value: e.id, label: e.audit_checklist.title })),
  ]

  const categoryOptions = [
    { value: '', label: '— Pilih kategori temuan —' },
    ...FINDING_CATEGORY_OPTIONS.map((c) => ({ value: c, label: c })),
  ]

  const riskTypeOptions = [
    { value: '', label: '— Pilih jenis risiko —' },
    ...FINDING_RISK_TYPE_OPTIONS.map((c) => ({ value: c, label: c })),
  ]

  const createMutation = useMutation({
    mutationFn: (data: FindingPayload) => findingsService.create(project.id, data),
    onSuccess,
    onError: () => setError('Gagal membuat temuan'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FindingPayload) => findingsService.update(finding!.id, data),
    onSuccess,
    onError: () => setError('Gagal menyimpan perubahan'),
  })

  const handleSubmit = () => {
    setError('')
    if (!isRecommendationOnly) {
      if (!subjectArea.trim()) { setError('Subjek pemeriksaan wajib diisi'); return }
      if (!findingCategory) { setError('Kategori temuan wajib dipilih'); return }
      if (!criteriaText.trim()) { setError('Kriteria wajib diisi'); return }
      if (!riskType) { setError('Jenis risiko wajib dipilih'); return }
      if (!riskRating) { setError('Tingkat risiko wajib dipilih'); return }
      if (!conditionText.trim()) { setError('Kondisi wajib diisi'); return }
    }

    const causeFields = entriesToFields(causeEntries)
    const recFields = entriesToFields(recEntries)

    const payload: FindingPayload = {
      subject_area: subjectArea,
      finding_category: findingCategory,
      criteria_text: criteriaText,
      risk_type: riskType,
      risk_rating: riskRating,
      condition_text: conditionText,
      impact_quantity: impactQuantity ? Number(impactQuantity) : undefined,
      impact_loss_value: impactLossValue ? Number(impactLossValue) : undefined,
      impact_potential_risk: impactPotentialRisk,
      auditee_response_condition: auditeeResponseCondition,
      cause_kebijakan: causeFields.kebijakan,
      cause_sistem: causeFields.sistem,
      cause_sdm: causeFields.sdm,
      cause_eksternal: causeFields.eksternal,
      rec_kebijakan: recFields.kebijakan,
      rec_sistem: recFields.sistem,
      rec_sdm: recFields.sdm,
      rec_eksternal: recFields.eksternal,
      auditee_pic: auditeePIC,
      deadline_date: deadlineDate || undefined,
    }

    if (finding) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate({ ...payload, checklist_execution_id: executionId || undefined })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={isRecommendationOnly ? 'Lengkapi Penyebab & Rekomendasi' : finding ? 'Edit Temuan' : 'Buat Temuan Baru'}
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
        )}

        {isRecommendationOnly && (
          <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
            Temuan ini sudah final approved — kondisi & dampak terkunci. Lengkapi Penyebab dan Rekomendasi di bawah sebelum mencatat tanggapan auditee.
          </div>
        )}

        {isRecommendationOnly ? (
          <>
            {/* Ringkasan kondisi yang sudah final approved (read-only) */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ringkasan Temuan — Tahap 1–3 (Terkunci)</p>
              <p className="font-medium text-gray-900">{findingCategory}</p>
              {subjectArea && <p className="text-gray-600">{subjectArea}</p>}
              <p className="text-gray-700 whitespace-pre-wrap">{conditionText}</p>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-1">
                <span>Jumlah: <strong className="text-gray-700">{impactQuantity || 0}</strong></span>
                <span>Nilai Kerugian: <strong className="text-gray-700">{impactLossValue ? `Rp${Number(impactLossValue).toLocaleString('id-ID')}` : '—'}</strong></span>
              </div>
            </div>

            {/* Tanggapan Auditee atas Kondisi */}
            <FormSection step={4} title="Tanggapan Auditee Terhadap Kondisi">
              <Textarea
                value={auditeeResponseCondition}
                onChange={(e) => setAuditeeResponseCondition(e.target.value)}
                rows={2}
                placeholder="Tanggapan auditee saat kondisi disampaikan..."
              />
            </FormSection>

            {/* Penyebab */}
            <CategoryEntriesEditor
              step={5}
              label="Penyebab"
              addLabel="Tambah Penyebab"
              entries={causeEntries}
              onChange={setCauseEntries}
            />

            {/* Rekomendasi */}
            <CategoryEntriesEditor
              step={6}
              label="Rekomendasi"
              addLabel="Tambah Rekomendasi"
              entries={recEntries}
              onChange={setRecEntries}
            />

            {/* PIC & Deadline */}
            <FormSection step={7} title="PIC & Deadline">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIC Auditee</label>
                  <Input value={auditeePIC} onChange={(e) => setAuditeePIC(e.target.value)} placeholder="Nama PIC penyelesaian" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline Penyelesaian</label>
                  <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
                </div>
              </div>
            </FormSection>
          </>
        ) : (
          <>
            {/* Informasi Umum — stage 1: ini saja yang perlu diisi auditor untuk submit review */}
            <FormSection step={1} title="Informasi Umum">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subjek Pemeriksaan <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={subjectArea}
                  onChange={(e) => setSubjectArea(e.target.value)}
                  rows={2}
                  placeholder="mis. PT Asuransi Sinar Mas Kantor Pusat IT, area/unit yang diperiksa..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategori Temuan <span className="text-red-500">*</span>
                  </label>
                  <Select value={findingCategory} onChange={(e) => setFindingCategory(e.target.value)} options={categoryOptions} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jenis Risiko <span className="text-red-500">*</span>
                  </label>
                  <Select value={riskType} onChange={(e) => setRiskType(e.target.value)} options={riskTypeOptions} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tingkat Risiko <span className="text-red-500">*</span>
                  </label>
                  <Select value={riskRating} onChange={(e) => setRiskRating(e.target.value)} options={RISK_OPTIONS} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kriteria <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={criteriaText}
                  onChange={(e) => setCriteriaText(e.target.value)}
                  rows={2}
                  placeholder="Referensi SOP/SE/POJK yang menjadi acuan..."
                />
              </div>
              {!finding && executionOptions.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Terkait Checklist (opsional)</label>
                  <Select value={executionId} onChange={(e) => setExecutionId(e.target.value)} options={executionOptions} />
                </div>
              )}
            </FormSection>

            {/* Kondisi */}
            <FormSection step={2} title="Kondisi" required>
              <Textarea
                value={conditionText}
                onChange={(e) => setConditionText(e.target.value)}
                rows={4}
                placeholder="Apa yang ditemukan auditor, hasil observasi, dan bukti pendukung..."
              />
            </FormSection>

            {/* Dampak */}
            <FormSection step={3} title="Dampak">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jumlah <span className="text-red-500">*</span>
                  </label>
                  <Input type="number" min="0" value={impactQuantity} onChange={makeNonNegativeHandler(setImpactQuantity)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nilai Kerugian (Rp)</label>
                  <Input type="number" min="0" value={impactLossValue} onChange={makeNonNegativeHandler(setImpactLossValue)} placeholder="0" />
                  <p className="text-xs text-gray-400 mt-1">Boleh kosong/0 jika tidak ada kerugian finansial.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Potensi Risiko</label>
                <Textarea
                  value={impactPotentialRisk}
                  onChange={(e) => setImpactPotentialRisk(e.target.value)}
                  rows={2}
                  placeholder="1. Aset hilang. 2. Pencatatan tidak akurat..."
                />
              </div>
            </FormSection>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white pb-1 -mx-1 px-1">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {finding ? 'Simpan Perubahan' : 'Buat Temuan'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ApproveModal({ finding, onClose, onSuccess }: { finding: Finding; onClose: () => void; onSuccess: () => void }) {
  const [comments, setComments] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => findingsService.approve(finding.id, comments),
    onSuccess,
    onError: () => setError('Gagal menyetujui temuan'),
  })

  return (
    <Modal open onClose={onClose} title="Setujui Temuan">
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        <p className="text-sm text-gray-600">
          Setujui temuan: <strong>{finding.finding_category}</strong>?
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (opsional)</label>
          <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} placeholder="Catatan approval..." />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-green-600 hover:bg-green-700">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Setujui
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function RejectModal({ finding, onClose, onSuccess }: { finding: Finding; onClose: () => void; onSuccess: () => void }) {
  const [comments, setComments] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => findingsService.reject(finding.id, comments),
    onSuccess,
    onError: () => setError('Gagal menolak temuan'),
  })

  const handleSubmit = () => {
    if (!comments.trim()) { setError('Alasan penolakan wajib diisi'); return }
    mutation.mutate()
  }

  return (
    <Modal open onClose={onClose} title="Tolak Temuan">
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        <p className="text-sm text-gray-600">
          Tolak temuan: <strong>{finding.finding_category}</strong>? Temuan akan dikembalikan ke auditor untuk direvisi.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alasan Penolakan <span className="text-red-500">*</span>
          </label>
          <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} placeholder="Tuliskan alasan penolakan..." />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending} className="bg-red-600 hover:bg-red-700">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Tolak
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function AuditeeResponseModal({ finding, onClose, onSuccess }: { finding: Finding; onClose: () => void; onSuccess: () => void }) {
  const recCategories = FINDING_CAUSE_CATEGORIES.filter((c) => {
    const recKey = `rec_${c.key}` as keyof Finding
    return !!finding[recKey]
  })

  const [responses, setResponses] = useState<Record<CategoryKey, string>>(() => {
    const initial: Record<CategoryKey, string> = { kebijakan: '', sistem: '', sdm: '', eksternal: '' }
    recCategories.forEach((c) => {
      const key = `auditee_rec_${c.key}` as keyof Finding
      initial[c.key] = (finding[key] as string) ?? ''
    })
    return initial
  })
  const [auditeePIC, setAuditeePIC] = useState(finding.auditee_pic ?? '')
  const [deadlineDate, setDeadlineDate] = useState(finding.deadline_date?.slice(0, 10) ?? '')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => findingsService.recordAuditeeResponse(finding.id, {
      auditee_rec_kebijakan: responses.kebijakan,
      auditee_rec_sistem: responses.sistem,
      auditee_rec_sdm: responses.sdm,
      auditee_rec_eksternal: responses.eksternal,
      auditee_pic: auditeePIC,
      deadline_date: deadlineDate || undefined,
    } as FindingAuditeeResponsePayload),
    onSuccess,
    onError: () => setError('Gagal menyimpan respons auditee'),
  })

  const handleSubmit = () => {
    if (Object.values(responses).every((v) => !v.trim())) {
      setError('Isi minimal satu tanggapan rekomendasi')
      return
    }
    mutation.mutate()
  }

  return (
    <Modal open onClose={onClose} title="Input Tanggapan Auditee atas Rekomendasi" size="lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        <p className="text-sm text-gray-500">Temuan: <strong className="text-gray-900">{finding.finding_category}</strong></p>

        {recCategories.length === 0 ? (
          <p className="text-sm text-gray-400">Temuan ini belum memiliki rekomendasi.</p>
        ) : (
          <div className="space-y-3">
            {recCategories.map((c) => (
              <div key={c.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{c.label}</label>
                <Textarea
                  value={responses[c.key]}
                  onChange={(e) => setResponses((prev) => ({ ...prev, [c.key]: e.target.value }))}
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIC Auditee</label>
            <Input value={auditeePIC} onChange={(e) => setAuditeePIC(e.target.value)} placeholder="Nama PIC" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deadline Penyelesaian</label>
            <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Simpan Tanggapan
          </Button>
        </div>
      </div>
    </Modal>
  )
}
