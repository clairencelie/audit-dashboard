import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { masterDataService } from '@/services/masterData'
import { Plus, Building2 } from 'lucide-react'

export function AuditeeesPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['auditees'],
    queryFn: () => masterDataService.listAuditees(),
  })

  const { register, handleSubmit, reset } = useForm<{
    name: string
    type: string
    contact_person: string
    email: string
  }>()

  const mutation = useMutation({
    mutationFn: (data: { name: string; type: string; contact_person: string; email: string }) =>
      masterDataService.createAuditee(data),
    onSuccess: () => {
      reset()
      setShowCreate(false)
      queryClient.invalidateQueries({ queryKey: ['auditees'] })
    },
  })

  const auditees = data?.data ?? []

  return (
    <div>
      <TopBar breadcrumbs={[{ label: 'Master Data' }, { label: 'Auditees' }]} title="Manajemen Auditee" />

      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Tambah Auditee
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Auditee</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipe</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kontak</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {auditees.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-teal-600" />
                        </div>
                        <span className="font-medium text-gray-900">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-600 capitalize">{a.type || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">{a.contact_person || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">{a.email || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {a.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!auditees.length && (
              <div className="text-center py-12 text-gray-400">
                <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Belum ada auditee</p>
              </div>
            )}
          </Card>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tambah Auditee" size="md">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input label="Nama Auditee" required {...register('name')} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tipe</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('type')}>
              <option value="">— Pilih Tipe —</option>
              <option value="division">Divisi</option>
              <option value="department">Departemen</option>
              <option value="branch">Cabang</option>
              <option value="unit">Unit Kerja</option>
            </select>
          </div>
          <Input label="Contact Person" {...register('contact_person')} />
          <Input label="Email" type="email" {...register('email')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>Simpan</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
