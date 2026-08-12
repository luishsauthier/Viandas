import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { maskPhoneBR, maskPin } from '@/lib/phone'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> & {
  value?: string
  onValueChange?: (value: string) => void
}

const inputClassName =
  'w-full rounded-xl border border-border bg-white px-3 py-2.5 outline-none ring-brand-500 focus:ring-2'

export function PhoneInput({
  value = '',
  onValueChange,
  className,
  ...props
}: BaseProps) {
  return (
    <input
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete={props.autoComplete ?? 'tel'}
      placeholder={props.placeholder ?? '(51) 99999-9999'}
      className={className ?? inputClassName}
      value={value}
      onChange={(event) => onValueChange?.(maskPhoneBR(event.target.value))}
    />
  )
}

type PinInputProps = BaseProps & {
  confirm?: boolean
}

export function PinInput({
  value = '',
  onValueChange,
  className,
  confirm = false,
  ...props
}: PinInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        inputMode="numeric"
        autoComplete={confirm ? 'new-password' : (props.autoComplete ?? 'current-password')}
        maxLength={6}
        placeholder={props.placeholder ?? '••••••'}
        className={`${className ?? inputClassName} pr-12 tracking-[0.3em]`}
        value={value}
        onChange={(event) => onValueChange?.(maskPin(event.target.value))}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-ink-muted hover:bg-brand-50 hover:text-ink"
        aria-label={visible ? 'Ocultar PIN' : 'Mostrar PIN'}
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}
