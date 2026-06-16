import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { referenceDocsService } from '@/services/referenceDocs'
import type { ReferenceDocUploadPayload } from '@/services/referenceDocs'
import { formatDate } from '@/lib/utils'
import type { AuditProject, ReferenceDocument } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { Upload, Trash2, BookOpen, Loader2, File, ExternalLink } from 'lucide-react'

interface Props {
  project: AuditProject
}

const CATEGORIES = ['Regulasi', 'SOP', 'Standar Audit', 'Kebijakan', 'Lainnya'] as const

const CATEGORY_COLORS: Record<string, string> = {
  'Regulasi':      'bg-red-50 text-red-700 border-red-100',
  'SOP':           'bg-blue-50 text-blue-700 border-blue-100',
  'Standar Audit': 'bg-purple-50 text-purple-700 border-purple-100',
  'Kebijakan':     'bg-amber-50 text-amber-700 border-amber-100',
  'Lainnya':       'bg-gray-50 text-gray-600 border-gray-200',
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

export function ReferenceDocTab({ project }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const canUpload = user?.role === 'auditor' || user?.role === 'admin'

  const { data: docsRes, isLoading } = useQuery({
    queryKey: ['reference-docs', project.id],
    queryFn: () => referenceDocsService.list(project.id),
  })

  const docs = docsRes?.data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: referenceDocsService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reference-docs', project.id] }),
  })

  // Group by category
  const byCategory: Partial<Record<string, ReferenceDocument[]>> = {}
  docs.forEach((d) => {
    if (!byCategory[d.category]) byCategory[d.category] = []
    byCategory[d.category]!.push(d)
  })

  // Sort categories in defined order
  const orderedCategories = CATEGORIES.filter((c) => byCategory[c]?.length)

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
          <h2 className="text-base font-semibold text-gray-900">Dokumen Referensi</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {docs.length} dokumen · Regulasi, SOP, dan kriteria pemeriksaan
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => setShowModal(true)} className="gap-1.5">
            <Upload className="w-4 h-4" />
            Upload Dokumen
          </Button>
        )}
      </div>

      {docs.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">Belum ada dokumen referensi</p>
            <p className="text-gray-400 text-xs mt-1">
              Upload regulasi, SOP, atau standar audit yang menjadi kriteria pemeriksaan ini.
            </p>
            {canUpload && (
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                Upload Pertama
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {orderedCategories.map((category) => (
            <div key={category} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${CATEGORY_COLORS[category]}`}>
                  {category}
                </span>
                <span className="text-xs text-gray-400">{byCategory[category]!.length} dokumen</span>
              </div>
              <div className="divide-y divide-gray-50">
                {byCategory[category]!.map((doc) => {
                  const canDeleteThis = user?.role === 'admin' || doc.uploaded_by_id === user?.id
                  return (
                    <div key={doc.id} className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{fileIcon(doc.content_type ?? '')}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="inline-flex text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1.5 py-0.5 truncate max-w-[220px]">
                              {doc.title}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatFileSize(doc.file_size)} · {doc.uploaded_by?.name} · {formatDate(doc.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a href={doc.drive_file_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 text-xs px-2 py-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Buka di Drive
                          </Button>
                        </a>
                        {canUpload && canDeleteThis && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50 border-red-200 px-2 py-1"
                            onClick={() => {
                              if (confirm('Hapus dokumen referensi ini?')) deleteMutation.mutate(doc.id)
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <UploadModal
          project={project}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            queryClient.invalidateQueries({ queryKey: ['reference-docs', project.id] })
          }}
        />
      )}
    </div>
  )
}

interface UploadModalProps {
  project: AuditProject
  onClose: () => void
  onSuccess: () => void
}

function UploadModal({ project: _project, onClose, onSuccess }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('Regulasi')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: c }))

  const uploadMutation = useMutation({
    mutationFn: (payload: ReferenceDocUploadPayload) => referenceDocsService.upload(_project.id, payload),
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
      uploadMutation.mutate({
        title: title.trim(),
        category,
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
    <Modal open onClose={onClose} title="Upload Dokumen Referensi">
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kategori <span className="text-red-500">*</span>
          </label>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categoryOptions}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label Dokumen <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. PMK No.141 Tahun 2024, SOP Klaim Kebakaran"
          />
          <p className="text-xs text-gray-400 mt-1">Nama regulasi, nomor SOP, atau deskripsi singkat isi dokumen.</p>
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
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {uploadMutation.isPending ? 'Mengupload ke Drive...' : 'Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
