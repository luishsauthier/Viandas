import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  createRawActivationToken,
  getAppBaseUrl,
  jsonResponse,
  normalizePhoneToE164,
  optionsResponse,
  phoneToAuthEmail,
  sha256Hex,
} from "../_shared/auth.ts"

type CreateBody = {
  name?: string
  phone?: string
  role?: "admin" | "employee"
  is_participant?: boolean
  is_active?: boolean
  appBaseUrl?: string
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Serviço indisponível" }, 500)
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return jsonResponse({ error: "Não autenticado" }, 401)

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData.user) return jsonResponse({ error: "Não autenticado" }, 401)

    const { data: callerProfile, error: callerProfileError } = await admin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle()

    if (callerProfileError || !callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      return jsonResponse({ error: "Apenas administradores" }, 403)
    }

    const body = (await req.json()) as CreateBody
    const name = String(body.name ?? "").trim()
    const role = body.role === "admin" ? "admin" : "employee"
    const isParticipant = body.is_participant ?? true
    const isActive = body.is_active ?? true
    const appBaseUrl = String(body.appBaseUrl ?? getAppBaseUrl()).replace(/\/$/, "")

    if (!name) return jsonResponse({ error: "Nome obrigatório" }, 400)
    if (!appBaseUrl) return jsonResponse({ error: "APP_BASE_URL não configurada" }, 400)

    let phone: string
    try {
      phone = normalizePhoneToE164(String(body.phone ?? ""))
    } catch {
      return jsonResponse({ error: "Telefone inválido" }, 400)
    }

    const email = phoneToAuthEmail(phone)
    const tempPassword = createRawActivationToken()

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { phone, name, role },
    })

    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message ?? "Falha ao criar usuário" }, 400)
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      name,
      phone,
      role,
      is_participant: isParticipant,
      is_active: isActive,
      activated_at: null,
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return jsonResponse({ error: profileError.message }, 400)
    }

    const rawToken = createRawActivationToken()
    const hashedToken = await sha256Hex(rawToken)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

    const { error: tokenError } = await admin.from("activation_tokens").insert({
      profile_id: created.user.id,
      hashed_token: hashedToken,
      expires_at: expiresAt,
      created_by: callerProfile.id,
    })

    if (tokenError) {
      return jsonResponse({ error: tokenError.message }, 400)
    }

    const inviteUrl = `${appBaseUrl}/primeiro-acesso/${rawToken}`
    const inviteMessage = `Olá, ${name}! Seu acesso ao Controle de Viandas:\n${inviteUrl}\n\nO link expira em 72 horas.`

    return jsonResponse({
      profileId: created.user.id,
      inviteUrl,
      inviteMessage,
      expiresAt,
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: "Erro interno" }, 500)
  }
})
