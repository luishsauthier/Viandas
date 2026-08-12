import { Outlet } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'

export function AdminLayoutRoute() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}
