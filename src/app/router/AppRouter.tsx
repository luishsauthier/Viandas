import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayoutRoute } from '@/app/layouts/AdminLayoutRoute'
import { EmployeeLayoutRoute } from '@/app/layouts/EmployeeLayoutRoute'
import { RequireAdmin, RequireAuth } from '@/features/auth/guards'
import { FirstAccessPage } from '@/features/auth/pages/FirstAccessPage'
import { HomePage } from '@/features/auth/pages/HomePage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { MyAccountPage } from '@/features/auth/pages/MyAccountPage'
import { SetupAdminPage } from '@/features/auth/pages/SetupAdminPage'
import { MyHistoryPage } from '@/features/billing/pages/MyHistoryPage'
import { MyWeekPage } from '@/features/billing/pages/MyWeekPage'
import { AdminEmployeesPage } from '@/features/employees/pages/AdminEmployeesPage'
import { AdminEmployeeDetailPage } from '@/features/employees/pages/AdminEmployeeDetailPage'
import { AdminMenuPage } from '@/features/menus/pages/AdminMenuPage'
import { DailyOrderPage } from '@/features/orders/pages/DailyOrderPage'
import { AdminPaymentsPage } from '@/features/payments/pages/AdminPaymentsPage'
import { AdminSettingsPage } from '@/features/settings/pages/AdminSettingsPage'
import { AdminDashboardPage } from '@/features/weeks/pages/AdminDashboardPage'
import { AdminDayPage } from '@/features/weeks/pages/AdminDayPage'
import { AdminHistoryPage } from '@/features/weeks/pages/AdminHistoryPage'
import { AdminAuditPage } from '@/features/weeks/pages/AdminAuditPage'
import { AdminWeekPage } from '@/features/weeks/pages/AdminWeekPage'

export function AppRouter() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

  return (
    <BrowserRouter basename={basename || undefined}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupAdminPage />} />
        <Route path="/primeiro-acesso/:token" element={<FirstAccessPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<EmployeeLayoutRoute />}>
            <Route path="/pedido" element={<DailyOrderPage />} />
            <Route path="/minha-semana" element={<MyWeekPage />} />
            <Route path="/minha-semana/:weekId" element={<MyWeekPage />} />
            <Route path="/meu-historico" element={<MyHistoryPage />} />
            <Route path="/minha-conta" element={<MyAccountPage />} />
          </Route>
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayoutRoute />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="semana/:weekId" element={<AdminWeekPage />} />
            <Route path="dia/:weekDayId" element={<AdminDayPage />} />
            <Route path="cardapio/:weekId" element={<AdminMenuPage />} />
            <Route path="funcionarios" element={<AdminEmployeesPage />} />
            <Route path="funcionarios/:profileId" element={<AdminEmployeeDetailPage />} />
            <Route path="pagamentos" element={<AdminPaymentsPage />} />
            <Route path="historico" element={<AdminHistoryPage />} />
            <Route path="auditoria" element={<AdminAuditPage />} />
            <Route path="configuracoes" element={<AdminSettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
