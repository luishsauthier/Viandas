import { useEffect, useState } from 'react'
import { formatPhoneBR } from '@/lib/phone'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchActiveMealTypes, updateMyDefaultOrder } from '@/features/orders/api'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import type { MealType } from '@/types'

export function MyAccountPage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [mealTypes, setMealTypes] = useState<MealType[]>([])
  const [mealTypeId, setMealTypeId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const meals = await fetchActiveMealTypes()
      setMealTypes(meals)
    })()
  }, [])

  useEffect(() => {
    if (!profile) return
    setMealTypeId(profile.default_meal_type_id ?? '')
    setQuantity(profile.default_quantity || 1)
  }, [profile])

  if (!profile) {
    return <p className="text-ink-muted">Perfil não encontrado.</p>
  }

  async function saveDefault() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateMyDefaultOrder({
        defaultMealTypeId: mealTypeId || null,
        defaultQuantity: quantity,
      })
      await refreshProfile()
      setSuccess('Pedido padrão atualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-ink">Minha conta</h1>
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-ink-muted">Nome:</span> {profile.name}
        </p>
        <p>
          <span className="text-ink-muted">Telefone:</span> {formatPhoneBR(profile.phone)}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <StatusBadge>{profile.role === 'admin' ? 'Administrador' : 'Funcionário'}</StatusBadge>
          <StatusBadge tone={profile.is_participant ? 'success' : 'neutral'}>
            {profile.is_participant ? 'Participa dos pedidos' : 'Não participa'}
          </StatusBadge>
        </div>
      </div>

      {profile.is_participant ? (
        <div className="space-y-3 border-t border-border pt-4">
          <h2 className="font-semibold text-ink">Pedido padrão</h2>
          <p className="text-sm text-ink-muted">
            Atalho na tela do dia. Nunca cria pedido automaticamente.
          </p>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Tipo</span>
            <select
              className="w-full rounded-xl border border-border px-3 py-2.5"
              value={mealTypeId}
              onChange={(event) => setMealTypeId(event.target.value)}
            >
              <option value="">Nenhum</option>
              {mealTypes.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Quantidade</span>
            <input
              type="number"
              min={1}
              max={10}
              className="w-full rounded-xl border border-border px-3 py-2.5"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {success ? <p className="text-sm text-brand-800">{success}</p> : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDefault()}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar pedido padrão'}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50"
      >
        Sair
      </button>
    </section>
  )
}
