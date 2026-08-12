import { NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, History, LayoutDashboard, LogOut, UserRound, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'

const employeeLinks = [
  { to: '/pedido', label: 'Pedido', icon: ClipboardList },
  { to: '/minha-semana', label: 'Minha semana', icon: Wallet },
  { to: '/meu-historico', label: 'Histórico', icon: History },
  { to: '/minha-conta', label: 'Conta', icon: UserRound },
] as const

function linkClassName({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
    isActive ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-brand-50 hover:text-ink',
  ].join(' ')
}

type EmployeeLayoutProps = {
  children: ReactNode
}

export function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/80 bg-surface-elevated/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-brand-600 uppercase">
                Controle de Viandas
              </p>
              <h1 className="truncate text-base font-bold text-ink sm:text-lg">
                {profile ? `Olá, ${profile.name}` : 'Área do funcionário'}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50"
                  title="Voltar ao painel administrativo"
                >
                  <LayoutDashboard className="size-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Modo admin</span>
                </button>
              ) : null}
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
            aria-label="Navegação do funcionário"
          >
            {employeeLinks.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={linkClassName}>
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
