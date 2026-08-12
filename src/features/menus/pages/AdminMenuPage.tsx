import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createMenuCatalogItem,
  deleteMenuCatalogItem,
  extractMenuFromImage,
  fetchMenuCatalog,
  fetchMenusForWeek,
  fetchWeek,
  markMenuExtractionApplied,
  uploadMenuImage,
  upsertMenuDay,
  type MenuCatalogItem,
  type MenuDayWithItems,
} from '@/features/menus/api'
import { MenuDayEditor } from '@/features/menus/components/MenuDayEditor'
import { mapExtractionToWeekDays } from '@/lib/menus/mapExtraction'
import { ensureBaseItems, serializeMenuLines, type MenuCatalogCategory } from '@/lib/menus/presets'
import { formatDateRangeBR, weekdayName } from '@/lib/dates'
import { useAuth } from '@/features/auth/AuthProvider'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import { ErrorBanner, LoadingState, SuccessBanner } from '@/components/common/PageStates'
import type { Week } from '@/types'

export function AdminMenuPage() {
  const { weekId = '' } = useParams()
  const { profile } = useAuth()
  const [week, setWeek] = useState<Week | null>(null)
  const [rows, setRows] = useState<MenuDayWithItems[]>([])
  const [drafts, setDrafts] = useState<Record<string, string[]>>({})
  const [catalog, setCatalog] = useState<MenuCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [extractionId, setExtractionId] = useState<string | null>(null)
  const [ignored, setIgnored] = useState<
    Array<{ reason: string; items: string[]; weekday?: number | null; date?: string | null }>
  >([])
  const [reviewReady, setReviewReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const nextWeek = await fetchWeek(weekId)
        if (cancelled) return
        if (!nextWeek) {
          setError('Semana não encontrada')
          setWeek(null)
          setRows([])
          return
        }
        const [menus, catalogRows] = await Promise.all([
          fetchMenusForWeek(weekId),
          fetchMenuCatalog(),
        ])
        if (cancelled) return
        setWeek(nextWeek)
        setRows(menus)
        setCatalog(catalogRows)
        setDrafts(
          Object.fromEntries(menus.map((row) => [row.weekDay.id, row.items.map((item) => item.name)])),
        )
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar cardápio')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [weekId])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const nextWeek = await fetchWeek(weekId)
      if (!nextWeek) {
        setError('Semana não encontrada')
        setWeek(null)
        setRows([])
        return
      }
      const menus = await fetchMenusForWeek(weekId)
      setWeek(nextWeek)
      setRows(menus)
      setDrafts(
        Object.fromEntries(menus.map((row) => [row.weekDay.id, row.items.map((item) => item.name)])),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar cardápio')
    } finally {
      setLoading(false)
    }
  }

  function setDayItems(weekDayId: string, items: string[]) {
    setDrafts((prev) => ({ ...prev, [weekDayId]: items }))
  }

  async function handleAddCatalogItem(category: MenuCatalogCategory, name: string) {
    setCatalogBusy(true)
    setError(null)
    try {
      const created = await createMenuCatalogItem({
        category,
        name,
        createdBy: profile?.id ?? null,
      })
      setCatalog((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    } finally {
      setCatalogBusy(false)
    }
  }

  async function handleRemoveCatalogItem(id: string) {
    setCatalogBusy(true)
    setError(null)
    try {
      await deleteMenuCatalogItem(id)
      setCatalog((prev) => prev.filter((row) => row.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover item do catálogo')
    } finally {
      setCatalogBusy(false)
    }
  }

  function applyBaseToAllDays() {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const row of rows) {
        next[row.weekDay.id] = ensureBaseItems(prev[row.weekDay.id] ?? [])
      }
      return next
    })
    setSuccess('Base (Arroz + Feijão) aplicada em todos os dias. Revise e salve cada dia.')
  }

  async function saveDay(weekDayId: string) {
    setSavingId(weekDayId)
    setError(null)
    setSuccess(null)
    try {
      const items = drafts[weekDayId] ?? []
      await upsertMenuDay({
        weekDayId,
        items,
        rawText: serializeMenuLines(items),
        confirmed: true,
      })
      setSuccess('Cardápio salvo.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar cardápio')
    } finally {
      setSavingId(null)
    }
  }

  async function onUploadAndExtract(file: File | null) {
    if (!file || !week) return
    setExtracting(true)
    setError(null)
    setSuccess(null)
    setIgnored([])
    setReviewReady(false)
    try {
      const path = await uploadMenuImage({ weekId: week.id, file })
      setImagePath(path)
      const result = await extractMenuFromImage({ weekId: week.id, imagePath: path })
      setExtractionId(result.extractionId)
      const mapped = mapExtractionToWeekDays({
        weekDays: rows.map((row) => ({
          id: row.weekDay.id,
          weekday: row.weekDay.weekday,
          date: row.weekDay.date,
        })),
        extracted: result.days,
      })
      setIgnored(mapped.ignored)
      setDrafts((prev) => {
        const next = { ...prev }
        for (const day of mapped.mapped) {
          next[day.weekDayId] = day.items
        }
        return next
      })
      setReviewReady(true)
      setSuccess('Extração pronta. Revise os itens antes de confirmar.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível ler a foto. Cadastre o cardápio manualmente.',
      )
      setReviewReady(false)
    } finally {
      setExtracting(false)
    }
  }

  async function confirmAllMapped() {
    setConfirmingAll(true)
    setError(null)
    setSuccess(null)
    try {
      for (const row of rows) {
        const items = drafts[row.weekDay.id] ?? []
        if (items.length === 0) continue
        await upsertMenuDay({
          weekDayId: row.weekDay.id,
          items,
          rawText: serializeMenuLines(items),
          confirmed: true,
        })
      }
      if (extractionId) {
        await markMenuExtractionApplied(extractionId)
      }
      setSuccess('Cardápio confirmado e salvo.')
      setReviewReady(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar cardápio')
    } finally {
      setConfirmingAll(false)
    }
  }

  if (loading) return <LoadingState label="Carregando cardápio…" />

  if (!week) {
    return (
      <div className="space-y-3">
        <ErrorBanner>{error || 'Semana não encontrada'}</ErrorBanner>
        <Link to="/admin" className="text-brand-700 hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/admin/semana/${week.id}`} className="text-sm font-medium text-brand-700 hover:underline">
          ← Semana
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">
          Cardápio · {formatDateRangeBR(week.start_date, week.end_date)}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Monte o dia com a base e os itens cadastrados. Use + para criar carboidrato, proteína ou
          complemento — fica salvo para as próximas semanas.
        </p>
      </div>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {success ? <SuccessBanner>{success}</SuccessBanner> : null}

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">Cadastro rápido</h2>
          <button
            type="button"
            onClick={applyBaseToAllDays}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50"
          >
            Aplicar base em todos os dias
          </button>
        </div>
        <p className="text-sm text-ink-muted">
          Arroz e feijão quase sempre entram. Cadastre os demais itens uma vez; depois é só marcar
          no dia.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-ink">Importar foto (opcional)</h2>
        <p className="text-sm text-ink-muted">
          Se a IA estiver configurada, a foto vira rascunho para revisão. Sem IA, use só o cadastro
          manual.
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={extracting}
          onChange={(event) => void onUploadAndExtract(event.target.files?.[0] ?? null)}
        />
        {extracting ? <p className="text-sm text-ink-muted">Lendo imagem com IA…</p> : null}
        {imagePath ? (
          <p className="text-xs text-ink-muted">Imagem armazenada: {imagePath}</p>
        ) : null}
        {reviewReady ? (
          <button
            type="button"
            disabled={confirmingAll}
            onClick={() => void confirmAllMapped()}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {confirmingAll ? 'Confirmando…' : 'Confirmar cardápio revisado'}
          </button>
        ) : null}
        {ignored.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">Dias detectados fora da semana ativa (ignorados):</p>
            <ul className="mt-2 space-y-1">
              {ignored.map((entry, index) => (
                <li key={`${entry.weekday}-${index}`}>
                  {entry.weekday ? weekdayName(entry.weekday) : entry.date || 'Dia'} —{' '}
                  {entry.items.join(', ')}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="space-y-4">
        {rows.map(({ weekDay, menuDay, items }) => {
          const dayItems = drafts[weekDay.id] ?? []
          return (
            <section
              key={weekDay.id}
              className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-ink">
                    {weekdayName(weekDay.weekday)} — {weekDay.date.slice(8)}/{weekDay.date.slice(5, 7)}
                  </h2>
                  <p className="text-sm text-ink-muted">
                    {dayItems.length > 0 ? `${dayItems.length} item(ns)` : 'Sem itens'}
                    {items.length > 0 && menuDay?.confirmed ? ' · salvo' : ''}
                  </p>
                </div>
                <StatusBadge tone={menuDay?.confirmed ? 'success' : 'warning'}>
                  {menuDay?.confirmed ? 'Confirmado' : 'Pendente'}
                </StatusBadge>
              </div>

              <MenuDayEditor
                items={dayItems}
                catalog={catalog}
                catalogBusy={catalogBusy}
                onChange={(next) => setDayItems(weekDay.id, next)}
                onAddCatalogItem={handleAddCatalogItem}
                onRemoveCatalogItem={handleRemoveCatalogItem}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingId === weekDay.id}
                  onClick={() => void saveDay(weekDay.id)}
                  className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {savingId === weekDay.id ? 'Salvando…' : 'Salvar cardápio do dia'}
                </button>
                <Link
                  to={`/admin/dia/${weekDay.id}`}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50"
                >
                  Abrir dia
                </Link>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
