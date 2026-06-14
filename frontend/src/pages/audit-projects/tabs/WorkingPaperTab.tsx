import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { workingPapersService } from '@/services/workingPapers'
import { formatDate } from '@/lib/utils'
import type { AuditProject, WorkingPaper, AuditChecklist, AuditProgram, ApiResponse } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/axios'
import { Upload, Trash2, FileText, Loader2, Download, File } from 'lucide-react'

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
  if (contentType.includes('image')) return '🖼️'
  return '📎'
}

export function WorkingPaperTab({ project }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  const apiBase = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:8090'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Working Papers</h2>
          <p className="text-xs text-gray-500 mt-0.5">{papers.length} dokumen</p>
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
                  apiBase={apiBase}
                  canDelete={canUpload}
                  currentUserId={user?.id}
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
                apiBase={apiBase}
                canDelete={canUpload}
                currentUserId={user?.id}
                onDelete={(id) => {
                  if (confirm('Hapus working paper ini?')) deleteMutation.mutate(id)
                }}
              />
            </div>
          )}
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
  apiBase: string
  canDelete: boolean
  currentUserId?: string
  onDelete: (id: string) => void
}

function PaperList({ papers, apiBase, canDelete, currentUserId, onDelete }: PaperListProps) {
  return (
    <div className="divide-y divide-gray-50">
      {papers.map((paper) => (
        <div key={paper.id} className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl" title={paper.content_type}>
              {fileIcon(paper.content_type ?? '')}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{paper.title}</p>
              <p className="text-xs text-gray-400 truncate">
                {paper.file_name} · {formatFileSize(paper.file_size)} · {paper.uploaded_by?.name} · {formatDate(paper.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`${apiBase}${paper.file_url}`}
              target="_blank"
              rel="noopener noreferrer"
              download={paper.file_name}
            >
              <Button size="sm" variant="outline" className="gap-1 text-xs px-2 py-1">
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
            </a>
            {canDelete && (paper.uploaded_by_id === currentUserId || true) && (
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
      ))}
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
    mutationFn: (formData: FormData) => workingPapersService.upload(project.id, formData),
    onSuccess,
    onError: () => setError('Gagal mengupload file'),
  })

  const handleSubmit = () => {
    setError('')
    if (!title.trim()) { setError('Judul wajib diisi'); return }
    if (!file) { setError('File wajib dipilih'); return }

    const MAX_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_SIZE) { setError('Ukuran file maksimal 20MB'); return }

    const formData = new FormData()
    formData.append('title', title.trim())
    formData.append('file', file)
    if (checklistId) formData.append('audit_checklist_id', checklistId)

    uploadMutation.mutate(formData)
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
            Judul Dokumen <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. KKP Pengujian Transaksi Klaim Q1 2025"
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
                <p className="text-xs mt-1">PDF, Excel, Word, Image — Maks. 20MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.zip"
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
            Upload
          </Button>
        </div>
      </div>
    </Modal>
  )
}
