import AdminShell from '@/components/admin/AdminShell'
import AdminGate from '@/components/AdminGate'

export const metadata = { title: 'Админ' }

export default function AdminLayout({ children }) {
  return (
    <AdminShell>
      <AdminGate>{children}</AdminGate>
    </AdminShell>
  )
}
