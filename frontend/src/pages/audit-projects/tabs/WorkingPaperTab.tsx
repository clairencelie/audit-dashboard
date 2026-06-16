import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { workingPapersService } from '@/services/workingPapers'
import type { WorkingPaperUploadPayload } from '@/services/workingPapers'
import { formatDate } from '@/lib/utils'
import type { AuditProject, WorkingPaper, AuditChecklist, AuditProgram, ApiResponse } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/axios'
import { Upload, Trash2, FileText, Loader2, File, ExternalLink, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'

interface Props {
  project: AuditProject
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(contentType: string) {
  if (contentType.includes('pdf')) return '📄'
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return '📊'
  if (contentType.includes('word') || contentType.includes('document')) return '📝'
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return '📑'
  if (contentType.includes('image')) return '🖼️'
  if (contentType.includes('video')) return '🎬'
  if (contentType.includes('audio')) return '🎵'
  if (contentType.includes('zip') || contentType.includes('compressed') || contentType.includes('archive')) return '🗜️'
  if (contentType.includes('text')) return '📃'
  return '📎'
}

export function WorkingPaperTab({ project }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [logExpanded, setLogExpanded] = useState(false)

  const isAuditor = user?.role === 'auditor'
  const isAdmin = user?.role === 'admin'
  const canUpload = isAuditor || isAdmin

  const { data: papersRes, isLoading } = useQuery({
    queryKey: ['working-papers', project.id],
    queryFn: () => workingPapersService.list(project.id),
  })

  const papers = papersRes?.data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: workingPapersService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['working-papers', project.id] }),
  })

  // Group by checklist
  const byChecklist: Record<string, WorkingPaper[]> = {}
  const uncategorized: WorkingPaper[] = []
  papers.forEach((p) => {
    if (p.audit_checklist_id && p.audit_checklist) {
      const key = p.audit_checklist_id
      if (!byChecklist[key]) byChecklist[key] = []
      byChecklist[key].push(p)
    } else {
      uncategorized.push(p)
    }
  })

  // All papers sorted newest first for the log
  const sortedByDate = [...papers].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

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
          <h2 className="text-base font-semibold text-gray-900">Working Papers</h2>
          <p className="text-xs text-gray-500 mt-0.5">{papers.length} dokumen tersimpan di Google Drive</p>
        </div>
        {canUpload && (
          <Button onClick={() => setShowModal(true)} className="gap-1.5">
            <Upload className="w-4 h-4" />
            Upload Dokumen
          </Button>
        )}
      </div>

      {papers.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Belum ada working paper untuk project ini.</p>
            {canUpload && (
              <Button className="mt-3" onClick={() => setShowModal(true)}>
                Upload Pertama
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Grouped by checklist */}
          {Object.entries(byChecklist).map(([, checklistPapers]) => {
            const cl = checklistPapers[0].audit_checklist!
            return (
              <div key={cl.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                  <p className="text-sm font-semibold text-indigo-800">
                    Checklist #{cl.sequence_no}: {cl.title}
                  </p>
                </div>
                <PaperList
                  papers={checklistPapers}
                  canDelete={canUpload}
                  currentUserId={user?.id}
                  currentUserRole={user?.role}
                  onDelete={(id) => {
                    if (confirm('Hapus working paper ini?')) deleteMutation.mutate(id)
                  }}
                />
              </div>
            )
          })}

          {uncategorized.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">General / Tidak Terkait Checklist</p>
              </div>
              <PaperList
                papers={uncategorized}
                canDelete={canUpload}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                onDelete={(id) => {
                  if (confirm('Hapus working paper ini?')) deleteMutation.mutate(id)
                }}
              />
            </div>
          )}

          {/* Activity Log */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              onClick={() => setLogExpanded(!logExpanded)}
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">Log Upload</span>
                <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                  {papers.length} file
                </span>
              </div>
              {logExpanded
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />
              }
            </button>

            {logExpanded && (
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">#</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">Waktu Upload</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">Nama File</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">Label</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">Checklist</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">Diupload oleh</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">Ukuran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedByDate.map((p, i) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                          {formatDate(p.created_at)}
                        </td>
                        <td className="px-4 py-2.5">
                          <a
                            href={p.drive_file_url || p.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 min-w-0"
                          >
                            <span className="truncate max-w-[180px] block">{p.file_name}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 max-w-[160px]">
                          <span className="truncate block">{p.title}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                          {p.audit_checklist
                            ? `#${p.audit_checklist.sequence_no} ${p.audit_checklist.title}`
                            : <span className="text-gray-400">General</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap font-medium">
                          {p.uploaded_by?.name ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-right whitespace-nowrap">
                          {formatFileSize(p.file_size)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <UploadModal
          project={project}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            queryClient.invalidateQueries({ queryKey: ['working-papers', project.id] })
          }}
        />
      )}
    </div>
  )
}

interface PaperListProps {
  papers: WorkingPaper[]
  canDelete: boolean
  currentUserId?: string
  currentUserRole?: string
  onDelete: (id: string) => void
}

function PaperList({ papers, canDelete, currentUserId, currentUserRole, onDelete }: PaperListProps) {
  return (
    <div className="divide-y divide-gray-50">
      {papers.map((paper) => {
        const driveUrl = paper.drive_file_url || paper.file_url
        const isDrive = !!paper.drive_file_url
        const canDeleteThis = currentUserRole === 'admin' || paper.uploaded_by_id === currentUserId

        return (
          <div key={paper.id} className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl shrink-0" title={paper.content_type}>
                {fileIcon(paper.content_type ?? '')}
              </span>
              <div className="min-w-0">
                {/* Filename as primary */}
                <p className="text-sm font-medium text-gray-900 truncate">{paper.file_name}</p>
                {/* Title as label badge */}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="inline-flex items-center text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1.5 py-0.5 truncate max-w-[220px]">
                    {paper.title}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatFileSize(paper.file_size)} · {paper.uploaded_by?.name} · {formatDate(paper.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <a href={driveUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1 text-xs px-2 py-1">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isDrive ? 'Buka di Drive' : 'Download'}
                </Button>
              </a>
              {canDelete && canDeleteThis && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 border-red-200 px-2 py-1"
                  onClick={() => onDelete(paper.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface UploadModalProps {
  project: AuditProject
  onClose: () => void
  onSuccess: () => void
}

function UploadModal({ project, onClose, onSuccess }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [checklistId, setChecklistId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  const { data: programRes } = useQuery({
    queryKey: ['audit-program', project.id],
    queryFn: () => api.get<ApiResponse<AuditProgram[]>>(`/projects/${project.id}/audit-program`),
  })

  const programs = programRes?.data?.data ?? []
  const checklists: AuditChecklist[] = programs[0]?.checklists ?? []

  const checklistOptions = [
    { value: '', label: '— General (tidak terkait checklist) —' },
    ...checklists.map((c: AuditChecklist) => ({ value: c.id, label: `#${c.sequence_no} ${c.title}` })),
  ]

  const uploadMutation = useMutation({
    mutationFn: (payload: WorkingPaperUploadPayload) => workingPapersService.upload(project.id, payload),
    onSuccess,
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Gagal mengupload file. Periksa koneksi atau coba lagi.')
    },
  })

  const handleSubmit = () => {
    setError('')
    if (!title.trim()) { setError('Label dokumen wajib diisi'); return }
    if (!file) { setError('File wajib dipilih'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Ukuran file maksimal 20MB'); return }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      const payload: WorkingPaperUploadPayload = {
        title: title.trim(),
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
        file_data: base64,
      }
      if (checklistId) payload.audit_checklist_id = checklistId
      uploadMutation.mutate(payload)
    }
    reader.onerror = () => setError('Gagal membaca file')
    reader.readAsDataURL(file)
  }

  return (
    <Modal open onClose={onClose} title="Upload Working Paper">
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label Dokumen <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. KKP Pengujian Transaksi Klaim Q1 2025"
          />
          <p className="text-xs text-gray-400 mt-1">Deskripsi singkat isi dokumen, ditampilkan sebagai label.</p>
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
            File <span className="text-red-500">*</span>
          </label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                <File className="w-5 h-5 text-blue-500" />
                <span className="font-medium">{file.name}</span>
                <span className="text-gray-400">({formatFileSize(file.size)})</span>
              </div>
            ) : (
              <div className="text-gray-400">
                <Upload className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Klik untuk pilih file</p>
                <p className="text-xs mt-1">Semua tipe file didukung — Maks. 20MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="*/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFile(f)
            }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {uploadMutation.isPending ? 'Mengupload ke Drive...' : 'Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
