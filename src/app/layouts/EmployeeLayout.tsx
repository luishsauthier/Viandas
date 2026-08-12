import { NavLink } from 'react-router-dom'
import { ClipboardList, History, LogOut, UserRound, Wallet } from 'lucide-react'
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
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-brand-50 hover:text-ink',
  ].join(' ')
}

type EmployeeLayoutProps = {
  children: ReactNode
}

export function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/80 bg-surface-elevated/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-brand-600 uppercase">
              Controle de Viandas
            </p>
            <h1 className="text-lg font-bold text-ink">
              {profile ? `Olá, ${profile.name}` : 'Área do funcionário'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <nav className="flex flex-wrap gap-1" aria-label="Navegação do funcionário">
              {employeeLinks.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={linkClassName}>
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
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
