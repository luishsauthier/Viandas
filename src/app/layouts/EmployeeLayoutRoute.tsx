import { Outlet } from 'react-router-dom'
import { EmployeeLayout } from './EmployeeLayout'

export function EmployeeLayoutRoute() {
  return (
    <EmployeeLayout>
      <Outlet />
    </EmployeeLayout>
  )
}
