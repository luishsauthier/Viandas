import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  createRawActivationToken,
  getAppBaseUrl,
  jsonResponse,
  optionsResponse,
  sha256Hex,
} from "../_shared/auth.ts"

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

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle()

    if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      return jsonResponse({ error: "Apenas administradores" }, 403)
    }

    const body = await req.json()
    const profileId = String(body.profileId ?? "").trim()
    const resetCredentials = Boolean(body.resetCredentials ?? true)
    const appBaseUrl = String(body.appBaseUrl ?? getAppBaseUrl()).replace(/\/$/, "")

    if (!profileId) return jsonResponse({ error: "profileId obrigatório" }, 400)
    if (!appBaseUrl) return jsonResponse({ error: "APP_BASE_URL não configurada" }, 400)

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, name, phone, is_active, activated_at")
      .eq("id", profileId)
      .maybeSingle()

    if (profileError || !profile) {
      return jsonResponse({ error: "Funcionário não encontrado" }, 404)
    }

    if (!resetCredentials && profile.activated_at) {
      return jsonResponse({
        error: "Conta já ativada. Use redefinir acesso para gerar novo convite.",
      }, 400)
    }

    // Invalida tokens anteriores não usados
    await admin
      .from("activation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .is("used_at", null)

    if (resetCredentials) {
      const tempPassword = createRawActivationToken()
      const { error: updateError } = await admin.auth.admin.updateUserById(profileId, {
        password: tempPassword,
      })
      if (updateError) {
        return jsonResponse({ error: updateError.message }, 400)
      }

      await admin
        .from("profiles")
        .update({ activated_at: null })
        .eq("id", profileId)

      try {
        await admin.auth.admin.signOut(profileId, "global")
      } catch (signOutError) {
        console.warn("Falha ao encerrar sessões", signOutError)
      }
    }

    const rawToken = createRawActivationToken()
    const hashedToken = await sha256Hex(rawToken)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

    const { error: tokenError } = await admin.from("activation_tokens").insert({
      profile_id: profileId,
      hashed_token: hashedToken,
      expires_at: expiresAt,
      created_by: callerProfile.id,
    })

    if (tokenError) {
      return jsonResponse({ error: tokenError.message }, 400)
    }

    const inviteUrl = `${appBaseUrl}/primeiro-acesso/${rawToken}`
    const inviteMessage = `Olá, ${profile.name}! Redefina seu acesso ao Controle de Viandas:\n${inviteUrl}\n\nO link expira em 72 horas.`

    return jsonResponse({
      profileId,
      inviteUrl,
      inviteMessage,
      expiresAt,
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: "Erro interno" }, 500)
  }
})
