import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import api from '@/lib/axios'
import { formatDateTime } from '@/lib/utils'
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react'
import type { ApprovalRequest } from '@/types'

export function ApprovalsPage() {
  const queryClient = useQueryClient()
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string; type: string }>({
    open: false, id: '', type: '',
  })
  const [rejectComment, setRejectComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['approvals-pending'],
    queryFn: async () => {
      const res = await api.get('/approvals/pending')
      return res.data.data as ApprovalRequest[]
    },
  })

  const approveMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      if (type === 'audit_program') {
        return api.post(`/audit-programs/${id}/approve`, { comments: '' })
      }
      throw new Error('Unknown entity type')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals-pending'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, type, comments }: { id: string; type: string; comments: string }) => {
      if (type === 'audit_program') {
        return api.post(`/audit-programs/${id}/reject`, { comments })
      }
      throw new Error('Unknown entity type')
    },
    onSuccess: () => {
      setRejectModal({ open: false, id: '', type: '' })
      setRejectComment('')
      queryClient.invalidateQueries({ queryKey: ['approvals-pending'] })
    },
  })

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
          <div className="space-y-3">
            {approvals.map((approval) => (
              <Card key={approval.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 capitalize">
                        {approval.entity_type?.replace(/_/g, ' ')} — Stage: {approval.approval_stage?.replace(/_/g, ' ').toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Diajukan oleh <strong>{approval.requested_by?.name}</strong> pada{' '}
                        {formatDateTime(approval.submitted_at)}
                      </p>
                      {approval.histories?.length ? (
                        <div className="mt-2 space-y-1">
                          {approval.histories.map((h) => (
                            <p key={h.id} className="text-xs text-gray-400">
                              {h.action === 'approved' ? '✅' : '❌'} {h.approver?.name}: {h.comments || '—'}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        setRejectModal({ open: true, id: approval.entity_id, type: approval.entity_type })
                      }
                    >
                      <XCircle className="w-4 h-4" />
                      Tolak
                    </Button>
                    <Button
                      size="sm"
                      loading={approveMutation.isPending}
                      onClick={() =>
                        approveMutation.mutate({ id: approval.entity_id, type: approval.entity_type })
                      }
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, id: '', type: '' })}
        title="Tolak Permintaan"
        size="sm"
      >
        <div className="space-y-4">
          <Textarea
            label="Alasan Penolakan"
            required
            placeholder="Jelaskan alasan penolakan..."
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRejectModal({ open: false, id: '', type: '' })}>
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={!rejectComment}
              loading={rejectMutation.isPending}
              onClick={() =>
                rejectMutation.mutate({
                  id: rejectModal.id,
                  type: rejectModal.type,
                  comments: rejectComment,
                })
              }
            >
              Tolak
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
