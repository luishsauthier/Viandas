export function jsonResponse(body: unknown, status = 200, origin = '*'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}

export function optionsResponse(origin = '*'): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}

export function phoneToAuthEmail(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '')
  return `${digits}@phone.viandas.local`
}

export function normalizePhoneToE164(input: string, defaultCountry = '55'): string {
  const digits = input.replace(/\D/g, '')
  if (!digits) {
    throw new Error('Telefone inválido')
  }

  let normalized = digits
  if (normalized.startsWith('0')) {
    normalized = normalized.slice(1)
  }
  if (!normalized.startsWith(defaultCountry)) {
    normalized = `${defaultCountry}${normalized}`
  }

  const e164 = `+${normalized}`
  if (!/^\+[1-9][0-9]{7,14}$/.test(e164)) {
    throw new Error('Telefone inválido')
  }
  return e164
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function createRawActivationToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function getAppBaseUrl(fallback?: string): string {
  const fromEnv = Deno.env.get('APP_BASE_URL')
  return (fromEnv || fallback || '').replace(/\/$/, '')
}
