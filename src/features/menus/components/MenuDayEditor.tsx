import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { MenuCatalogItem } from '@/features/menus/api'
import {
  ensureBaseItems,
  hasMenuItem,
  MENU_BASE_ITEMS,
  MENU_CATALOG_GROUPS,
  type MenuCatalogCategory,
  removeMenuItem,
  toggleMenuItem,
} from '@/lib/menus/presets'

type MenuDayEditorProps = {
  items: string[]
  onChange: (items: string[]) => void
  catalog: MenuCatalogItem[]
  onAddCatalogItem: (category: MenuCatalogCategory, name: string) => Promise<void>
  onRemoveCatalogItem?: (id: string) => Promise<void>
  catalogBusy?: boolean
}

export function MenuDayEditor({
  items,
  onChange,
  catalog,
  onAddCatalogItem,
  onRemoveCatalogItem,
  catalogBusy = false,
}: MenuDayEditorProps) {
  const [addingCategory, setAddingCategory] = useState<MenuCatalogCategory | null>(null)
  const [draftName, setDraftName] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function submitNewItem() {
    if (!addingCategory) return
    setLocalError(null)
    try {
      const name = draftName.trim()
      await onAddCatalogItem(addingCategory, name)
      onChange(toggleMenuItem(items, name))
      setDraftName('')
      setAddingCategory(null)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao salvar item')
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(ensureBaseItems(items))}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-brand-50"
        >
          Aplicar base (Arroz + Feijão)
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-brand-50"
        >
          Limpar
        </button>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(removeMenuItem(items, item))}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              title="Remover do dia"
            >
              {item} ×
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          Nenhum item ainda — use a base e os chips cadastrados.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Base</p>
        <div className="flex flex-wrap gap-2">
          {MENU_BASE_ITEMS.map((preset) => {
            const selected = hasMenuItem(items, preset)
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(toggleMenuItem(items, preset))}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-medium',
                  selected
                    ? 'bg-brand-600 text-white'
                    : 'border border-border bg-white hover:bg-brand-50',
                ].join(' ')}
              >
                {preset}
              </button>
            )
          })}
        </div>
      </div>

      {MENU_CATALOG_GROUPS.map((group) => {
        const groupItems = catalog.filter((row) => row.category === group.id)
        return (
          <div key={group.id} className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {groupItems.map((row) => {
                const selected = hasMenuItem(items, row.name)
                return (
                  <div key={row.id} className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onChange(toggleMenuItem(items, row.name))}
                      className={[
                        'rounded-lg px-3 py-1.5 text-sm font-medium',
                        selected
                          ? 'bg-brand-600 text-white'
                          : 'border border-border bg-white hover:bg-brand-50',
                      ].join(' ')}
                    >
                      {row.name}
                    </button>
                    {onRemoveCatalogItem ? (
                      <button
                        type="button"
                        title="Remover do catálogo"
                        disabled={catalogBusy}
                        onClick={() => void onRemoveCatalogItem(row.id)}
                        className="rounded-md px-1.5 text-xs text-ink-muted hover:bg-red-50 hover:text-danger"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                )
              })}
              <button
                type="button"
                disabled={catalogBusy}
                onClick={() => {
                  setLocalError(null)
                  setDraftName('')
                  setAddingCategory(group.id)
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-brand-50 hover:text-ink"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>

            {addingCategory === group.id ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  autoFocus
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 sm:max-w-xs"
                  placeholder={`Novo ${group.label.toLowerCase()}`}
                  value={draftName}
                  disabled={catalogBusy}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void submitNewItem()
                    }
                    if (event.key === 'Escape') {
                      setAddingCategory(null)
                      setDraftName('')
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={catalogBusy || !draftName.trim()}
                    onClick={() => void submitNewItem()}
                    className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    disabled={catalogBusy}
                    onClick={() => {
                      setAddingCategory(null)
                      setDraftName('')
                    }}
                    className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-brand-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}

      {localError ? <p className="text-sm text-danger">{localError}</p> : null}
    </div>
  )
}
