import { NavLink, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
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
    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
    isActive ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-brand-50 hover:text-ink',
  ].join(' ')
}

type AdminLayoutProps = {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/80 bg-surface-elevated/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-xl bg-brand-600 p-2 text-white">
                <CalendarDays className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.14em] text-brand-600 uppercase">
                  Controle de Viandas
                </p>
                <h1 className="truncate text-base font-bold text-ink sm:text-lg">
                  {profile ? `Admin · ${profile.name}` : 'Painel administrativo'}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => navigate('/pedido')}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50"
                title="Abrir área do funcionário"
              >
                <UserRound className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Modo funcionário</span>
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-brand-50 hover:text-ink"
              >
                <LogOut className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>

          <nav
            className="-mx-1 mt-3 flex gap-1 overflow-x-auto border-t border-border/70 pt-3 pb-0.5"
            aria-label="Navegação administrativa"
          >
            {adminLinks.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClassName}>
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">{children}</main>
    </div>
  )
}
