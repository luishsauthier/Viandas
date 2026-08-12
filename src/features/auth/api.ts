import { FunctionsHttpError } from '@supabase/supabase-js'
import { getAppBaseUrl, supabase } from '@/lib/supabase'

type EdgeError = { error?: string }

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const client = supabase
  if (!client) {
    throw new Error('Supabase não configurado. Verifique o arquivo .env')
  }

  const response = await client.functions.invoke(name, { body })

  if (response.error) {
    if (response.error instanceof FunctionsHttpError) {
      try {
        const payload = (await response.error.context.json()) as EdgeError
        throw new Error(payload.error || response.error.message, { cause: response.error })
      } catch (err) {
        if (err instanceof Error && err.message !== response.error.message) throw err
        throw new Error(response.error.message, { cause: err })
      }
    }
    const dataError = (response.data as EdgeError | null)?.error
    throw new Error(dataError || response.error.message, { cause: response.error })
  }

  const data = response.data as T & EdgeError
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(data.error)
  }
  return data
}

export async function invokeBootstrapAdmin(input: {
  name: string
  phone: string
  pin: string
  is_participant?: boolean
}) {
  return invokeFunction<{
    profileId: string
    session?: {
      access_token: string
      refresh_token: string
    }
  }>('bootstrap-admin', {
    ...input,
    confirm: 'CREATE_FIRST_ADMIN',
    appBaseUrl: getAppBaseUrl(),
  })
}

export async function invokeCreateEmployee(input: {
  name: string
  phone: string
  role?: 'admin' | 'employee'
  is_participant?: boolean
  is_active?: boolean
}) {
  return invokeFunction<{
    profileId: string
    inviteUrl: string
    inviteMessage: string
    expiresAt: string
  }>('create-employee', {
    ...input,
    appBaseUrl: getAppBaseUrl(),
  })
}

export async function invokeCreateActivation(input: {
  profileId: string
  resetCredentials?: boolean
}) {
  return invokeFunction<{
    profileId: string
    inviteUrl: string
    inviteMessage: string
    expiresAt: string
  }>('create-activation', {
    ...input,
    appBaseUrl: getAppBaseUrl(),
  })
}

export async function invokeActivateUser(input: {
  token: string
  pin: string
  pinConfirm: string
}) {
  return invokeFunction<{
    activated?: boolean
    error?: string
    session?: {
      access_token: string
      refresh_token: string
    }
  }>('activate-user', input)
}

export async function invokeDeleteEmployee(input: { profileId: string }) {
  return invokeFunction<{ deleted: boolean; profileId: string }>('delete-employee', input)
}
