import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-ink-muted">Carregando…</div>
  )
}

export function RequireAuth() {
  const { loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function RequireAdmin() {
  const { loading, isAuthenticated, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!isAdmin) {
    return <Navigate to="/pedido" replace />
  }
  return <Outlet />
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, isAdmin } = useAuth()
  if (loading) return <LoadingScreen />
  if (isAuthenticated) {
    return <Navigate to={isAdmin ? '/admin' : '/pedido'} replace />
  }
  return children
}
