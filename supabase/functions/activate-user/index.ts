import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  jsonResponse,
  optionsResponse,
  phoneToAuthEmail,
  sha256Hex,
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
    const body = await req.json()
    const token = String(body.token ?? "").trim()
    const pin = String(body.pin ?? "").trim()
    const pinConfirm = String(body.pinConfirm ?? "").trim()

    if (!token || token.length < 32) {
      return jsonResponse({ error: "Convite inválido" }, 400)
    }
    if (!/^\d{6}$/.test(pin)) {
      return jsonResponse({ error: "PIN deve ter 6 dígitos" }, 400)
    }
    if (pin !== pinConfirm) {
      return jsonResponse({ error: "Confirmação de PIN não confere" }, 400)
    }

    const hashedToken = await sha256Hex(token)
    const { data: activation, error: tokenError } = await admin
      .from("activation_tokens")
      .select("id, profile_id, expires_at, used_at")
      .eq("hashed_token", hashedToken)
      .maybeSingle()

    if (tokenError || !activation) {
      return jsonResponse({ error: "Convite inválido" }, 400)
    }
    if (activation.used_at) {
      return jsonResponse({ error: "Convite já utilizado" }, 400)
    }
    if (new Date(activation.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: "Convite expirado" }, 400)
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, name, phone, is_active")
      .eq("id", activation.profile_id)
      .maybeSingle()

    if (profileError || !profile) {
      return jsonResponse({ error: "Cadastro não encontrado" }, 404)
    }
    if (!profile.is_active) {
      return jsonResponse({ error: "Funcionário inativo. Fale com o administrador." }, 403)
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(profile.id, {
      password: pin,
      email_confirm: true,
    })
    if (passwordError) {
      return jsonResponse({ error: passwordError.message }, 400)
    }

    const nowIso = new Date().toISOString()
    const { error: markUsedError } = await admin
      .from("activation_tokens")
      .update({ used_at: nowIso })
      .eq("id", activation.id)

    if (markUsedError) {
      return jsonResponse({ error: markUsedError.message }, 400)
    }

    // Invalida outros tokens abertos do mesmo perfil
    await admin
      .from("activation_tokens")
      .update({ used_at: nowIso })
      .eq("profile_id", profile.id)
      .is("used_at", null)

    const { error: activateProfileError } = await admin
      .from("profiles")
      .update({ activated_at: nowIso })
      .eq("id", profile.id)

    if (activateProfileError) {
      return jsonResponse({ error: activateProfileError.message }, 400)
    }

    const email = phoneToAuthEmail(profile.phone)
    const { data: sessionData, error: signInError } = await admin.auth.signInWithPassword({
      email,
      password: pin,
    })

    if (signInError || !sessionData.session) {
      return jsonResponse({
        activated: true,
        message: "PIN definido. Faça login com telefone e PIN.",
      }, 200)
    }

    return jsonResponse({
      activated: true,
      session: sessionData.session,
      profile: {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
      },
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: "Erro interno" }, 500)
  }
})
