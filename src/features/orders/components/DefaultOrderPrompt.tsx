type DefaultOrderPromptProps = {
  summary: string
  busy?: boolean
  onAccept: () => void
  onDismiss: () => void
}

export function DefaultOrderPrompt({
  summary,
  busy = false,
  onAccept,
  onDismiss,
}: DefaultOrderPromptProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="default-order-title"
        className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-5 shadow-lg"
      >
        <h2 id="default-order-title" className="text-lg font-semibold text-ink">
          Definir pedido padrão?
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Você confirmou <strong className="text-ink">{summary}</strong> nas últimas 3 vezes.
          Quer usar isso como pedido padrão?
        </p>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Mesmo com padrão definido, você ainda precisa abrir o app todos os dias e confirmar o
          pedido. Nada é enviado automaticamente.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
          >
            Agora não
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Salvando…' : 'Sim, definir padrão'}
          </button>
        </div>
      </div>
    </div>
  )
}
