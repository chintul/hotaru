import type { Metadata } from 'next'
import AdminShell from '@/components/admin/AdminShell'
import AdminGate from '@/components/AdminGate'

export const metadata: Metadata = { title: 'Админ' }

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  )
}
