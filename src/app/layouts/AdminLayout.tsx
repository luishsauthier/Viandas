import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/funcionarios', label: 'Funcionários', icon: Users, end: false },
  { to: '/admin/pagamentos', label: 'Pagamentos', icon: CreditCard, end: false },
  { to: '/admin/historico', label: 'Histórico', icon: History, end: false },
  { to: '/admin/auditoria', label: 'Auditoria', icon: ClipboardList, end: false },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings, end: false },
] as const

function linkClassName({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-brand-50 hover:text-ink',
  ].join(' ')
}

type AdminLayoutProps = {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/80 bg-surface-elevated/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-brand-600 p-2 text-white">
              <CalendarDays className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-brand-600 uppercase">
                Controle de Viandas
              </p>
              <h1 className="text-lg font-bold text-ink">
                {profile ? `Admin · ${profile.name}` : 'Painel administrativo'}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <nav className="flex flex-wrap gap-1" aria-label="Navegação administrativa">
              {adminLinks.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={linkClassName}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-brand-50 hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden />
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">{children}</main>
    </div>
  )
}
