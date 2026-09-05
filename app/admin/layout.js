import AdminShell from '@/components/admin/AdminShell'
import AdminGate from '@/components/AdminGate'

export const metadata = { title: 'Админ' }

/**
 * The gate wraps the SHELL, not just the page body. A non-admin should never
 * see the sidebar, the breadcrumb or the pending-order count — those leak how
 * the business is doing even when the tables behind them are empty.
 */
export default function AdminLayout({ children }) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  )
}
