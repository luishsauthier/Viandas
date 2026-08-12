import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { jsonResponse, optionsResponse } from "../_shared/auth.ts"

type Body = {
  profileId?: string
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

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle()

    if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      return jsonResponse({ error: "Apenas administradores" }, 403)
    }

    const body = (await req.json()) as Body
    const profileId = String(body.profileId ?? "").trim()
    if (!profileId) return jsonResponse({ error: "profileId obrigatório" }, 400)

    if (profileId === callerProfile.id) {
      return jsonResponse({ error: "Você não pode excluir a própria conta" }, 400)
    }

    const { data: target } = await admin
      .from("profiles")
      .select("id, name, role, is_active")
      .eq("id", profileId)
      .maybeSingle()

    if (!target) return jsonResponse({ error: "Funcionário não encontrado" }, 404)

    if (target.role === "admin") {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true)
      if ((count ?? 0) <= 1) {
        return jsonResponse({ error: "Não é possível excluir o único admin ativo" }, 400)
      }
    }

    const [{ count: ordersCount }, { count: paymentsCount }, { count: accountsCount }, { count: creditCount }] =
      await Promise.all([
        admin.from("orders").select("*", { count: "exact", head: true }).eq("profile_id", profileId),
        admin.from("payments").select("*", { count: "exact", head: true }).eq("profile_id", profileId),
        admin.from("weekly_accounts").select("*", { count: "exact", head: true }).eq("profile_id", profileId),
        admin.from("credit_ledger").select("*", { count: "exact", head: true }).eq("profile_id", profileId),
      ])

    const hasHistory =
      (ordersCount ?? 0) > 0 ||
      (paymentsCount ?? 0) > 0 ||
      (accountsCount ?? 0) > 0 ||
      (creditCount ?? 0) > 0

    if (hasHistory) {
      return jsonResponse({
        error:
          "Este funcionário já possui histórico. Prefira inativar em vez de excluir.",
      }, 409)
    }

    await admin.from("activation_tokens").delete().eq("profile_id", profileId)

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(profileId)
    if (deleteAuthError) {
      return jsonResponse({ error: deleteAuthError.message }, 400)
    }

    await admin.from("audit_logs").insert({
      actor_id: callerProfile.id,
      action: "employee_deleted",
      entity_type: "profile",
      entity_id: profileId,
      metadata: { name: target.name, role: target.role },
    })

    return jsonResponse({ deleted: true, profileId })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: "Erro interno" }, 500)
  }
})
