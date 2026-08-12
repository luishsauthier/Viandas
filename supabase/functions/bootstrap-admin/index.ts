import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  getAppBaseUrl,
  jsonResponse,
  normalizePhoneToE164,
  optionsResponse,
  phoneToAuthEmail,
} from "../_shared/auth.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Serviço indisponível" }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { count, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")

    if (countError) {
      return jsonResponse({ error: "Falha ao verificar administradores" }, 500)
    }
    if ((count ?? 0) > 0) {
      return jsonResponse({ error: "Já existe um administrador. Use o login normal." }, 403)
    }

    const body = await req.json()
    const name = String(body.name ?? "").trim()
    const pin = String(body.pin ?? "").trim()
    const confirm = String(body.confirm ?? "").trim()
    const appBaseUrl = String(body.appBaseUrl ?? getAppBaseUrl()).replace(/\/$/, "")

    if (confirm !== "CREATE_FIRST_ADMIN") {
      return jsonResponse({ error: "Confirmação inválida" }, 400)
    }
    if (!name) return jsonResponse({ error: "Nome obrigatório" }, 400)
    if (!/^\d{6}$/.test(pin)) return jsonResponse({ error: "PIN deve ter 6 dígitos" }, 400)

    let phone: string
    try {
      phone = normalizePhoneToE164(String(body.phone ?? ""))
    } catch {
      return jsonResponse({ error: "Telefone inválido" }, 400)
    }

    const email = phoneToAuthEmail(phone)
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { phone, name, role: "admin" },
    })

    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message ?? "Falha ao criar usuário" }, 400)
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      name,
      phone,
      role: "admin",
      is_participant: Boolean(body.is_participant ?? false),
      is_active: true,
      activated_at: new Date().toISOString(),
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return jsonResponse({ error: profileError.message }, 400)
    }

    const { data: sessionData, error: signInError } = await admin.auth.signInWithPassword({
      email,
      password: pin,
    })

    if (signInError || !sessionData.session) {
      return jsonResponse({
        error: "Admin criado, mas falha ao autenticar. Faça login manualmente.",
        profileId: created.user.id,
        appBaseUrl,
      }, 201)
    }

    return jsonResponse({
      profileId: created.user.id,
      session: sessionData.session,
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: "Erro interno" }, 500)
  }
})
