import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { StatusBadge } from '@/components/common/PlaceholderPage'

export function HomePage() {
  const { loading, isAuthenticated, isAdmin } = useAuth()

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-muted">Carregando…</div>
  }

  if (isAuthenticated) {
    return <Navigate to={isAdmin ? '/admin' : '/pedido'} replace />
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
      <section className="rounded-3xl border border-border bg-surface-elevated/95 p-8 shadow-sm sm:p-10">
        <p className="text-sm font-semibold tracking-[0.16em] text-brand-600 uppercase">
          Controle de Viandas
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Pedidos semanais com controle simples
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
          Cardápio, pedidos do dia, cobrança semanal e PIX em um só lugar.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {!isSupabaseConfigured ? (
            <StatusBadge tone="warning">Configuração pendente</StatusBadge>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Entrar
          </Link>
          <Link
            to="/setup"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-50"
          >
            Criar primeiro admin
          </Link>
        </div>
      </section>
    </div>
  )
}
