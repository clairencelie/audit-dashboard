import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { masterDataService } from '@/services/masterData'
import { getInitials } from '@/lib/utils'
import { Plus, Search, UserCheck, UserX } from 'lucide-react'
import type { User } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  role_id: z.string().min(1, 'Role wajib dipilih'),
  position: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  auditor: 'bg-blue-100 text-blue-700',
  spv: 'bg-green-100 text-green-700',
  dept_head: 'bg-orange-100 text-orange-700',
  div_head: 'bg-red-100 text-red-700',
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => masterDataService.listUsers({ search, limit: 50 }),
  })

  const { data: rolesRes } = useQuery({
    queryKey: ['roles'],
    queryFn: () => masterDataService.listRoles(),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => masterDataService.createUser(data),
    onSuccess: () => {
      reset()
      setShowCreate(false)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      masterDataService.updateUser(id, { is_active: isActive } as Partial<User>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const users = data?.data ?? []
  const roleOptions = rolesRes?.data?.map((r) => ({ value: r.id, label: r.name })) ?? []

  return (
    <div>
      <TopBar breadcrumbs={[{ label: 'Master Data' }, { label: 'Users' }]} title="Manajemen User" />

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Tambah User
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Jabatan</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[user.role?.name] ?? 'bg-gray-100 text-gray-600'}`}>
                        {user.role?.name}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{user.position || '—'}</td>
                    <td className="px-6 py-3">
                      {user.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <UserCheck className="w-3.5 h-3.5" /> Aktif
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <UserX className="w-3.5 h-3.5" /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        size="sm"
                        variant={user.is_active ? 'ghost' : 'secondary'}
                        onClick={() => toggleActive.mutate({ id: user.id, isActive: !user.is_active })}
                      >
                        {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && (
              <div className="text-center py-12 text-gray-400">
                <p>Tidak ada user ditemukan</p>
              </div>
            )}
          </Card>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tambah User Baru" size="md">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input label="Nama Lengkap" required error={errors.name?.message} {...register('name')} />
          <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
          <Input label="Password" type="password" required error={errors.password?.message} {...register('password')} />
          <Select
            label="Role"
            required
            options={roleOptions}
            placeholder="Pilih Role"
            error={errors.role_id?.message}
            {...register('role_id')}
          />
          <Input label="Jabatan" {...register('position')} />
          {mutation.error && (
            <p className="text-sm text-red-600">Gagal membuat user. Email mungkin sudah digunakan.</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button type="submit" loading={mutation.isPending}>Simpan</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
