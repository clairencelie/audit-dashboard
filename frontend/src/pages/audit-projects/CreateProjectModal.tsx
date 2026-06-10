import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { masterDataService } from '@/services/masterData'
import { auditProjectsService } from '@/services/auditProjects'

const schema = z.object({
  title: z.string().min(1, 'Judul wajib diisi'),
  audit_theme: z.string().optional(),
  auditee_id: z.string().min(1, 'Auditee wajib dipilih'),
  auditor_id: z.string().min(1, 'Auditor wajib dipilih'),
  spv_id: z.string().min(1, 'SPV wajib dipilih'),
  dept_head_id: z.string().optional(),
  div_head_id: z.string().optional(),
  priority: z.string().optional(),
  risk_level: z.string().optional(),
  planned_start_date: z.string().optional(),
  planned_end_date: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateProjectModal({ open, onClose, onSuccess }: Props) {
  const { data: auditees } = useQuery({
    queryKey: ['auditees'],
    queryFn: () => masterDataService.listAuditees(),
    enabled: open,
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => masterDataService.listUsers({ limit: 100 }),
    enabled: open,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => auditProjectsService.create(data as Parameters<typeof auditProjectsService.create>[0]),
    onSuccess: () => {
      reset()
      onSuccess()
    },
  })

  const auditeeOptions = auditees?.data?.map((a) => ({ value: a.id, label: a.name })) ?? []
  const auditorOptions =
    users?.data?.filter((u) => u.role?.name === 'auditor').map((u) => ({ value: u.id, label: u.name })) ?? []
  const spvOptions =
    users?.data?.filter((u) => u.role?.name === 'spv').map((u) => ({ value: u.id, label: u.name })) ?? []
  const deptHeadOptions =
    users?.data?.filter((u) => u.role?.name === 'dept_head').map((u) => ({ value: u.id, label: u.name })) ?? []
  const divHeadOptions =
    users?.data?.filter((u) => u.role?.name === 'div_head').map((u) => ({ value: u.id, label: u.name })) ?? []

  return (
    <Modal open={open} onClose={onClose} title="Buat Audit Project Baru" size="lg">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Input
          label="Judul Project"
          placeholder="cth. Audit Divisi Klaim Q1 2025"
          required
          error={errors.title?.message}
          {...register('title')}
        />

        <Input
          label="Tema Audit"
          placeholder="cth. Compliance, Operasional, IT"
          {...register('audit_theme')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Auditee"
            required
            options={auditeeOptions}
            placeholder="Pilih Auditee"
            error={errors.auditee_id?.message}
            {...register('auditee_id')}
          />

          <Select
            label="Auditor PIC"
            required
            options={auditorOptions}
            placeholder="Pilih Auditor"
            error={errors.auditor_id?.message}
            {...register('auditor_id')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Supervisor (SPV)"
            required
            options={spvOptions}
            placeholder="Pilih SPV"
            error={errors.spv_id?.message}
            {...register('spv_id')}
          />

          <Select
            label="Kepala Bagian"
            options={[{ value: '', label: '— Opsional —' }, ...deptHeadOptions]}
            {...register('dept_head_id')}
          />
        </div>

        <Select
          label="Kepala Divisi"
          options={[{ value: '', label: '— Opsional —' }, ...divHeadOptions]}
          {...register('div_head_id')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Prioritas"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ]}
            {...register('priority')}
          />

          <Select
            label="Risk Level"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ]}
            {...register('risk_level')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Rencana Mulai"
            type="date"
            {...register('planned_start_date')}
          />
          <Input
            label="Rencana Selesai"
            type="date"
            {...register('planned_end_date')}
          />
        </div>

        {mutation.error && (
          <p className="text-sm text-red-600">Gagal membuat project. Silakan coba lagi.</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Buat Project
          </Button>
        </div>
      </form>
    </Modal>
  )
}
