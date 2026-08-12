import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { jsonResponse, optionsResponse } from "../_shared/auth.ts"

type Body = {
  weekId?: string
  imagePath?: string
  extractionId?: string
}

type AiDay = {
  weekday?: number
  date?: string
  items?: string[]
  label?: string
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const openaiKey = Deno.env.get("OPENAI_API_KEY")
    const visionModel = Deno.env.get("OPENAI_VISION_MODEL") || "gpt-4o-mini"

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Serviço indisponível" }, 500)
    }
    if (!openaiKey) {
      return jsonResponse({
        error: "IA não configurada. Defina o secret OPENAI_API_KEY no Supabase.",
      }, 503)
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return jsonResponse({ error: "Não autenticado" }, 401)

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData.user) return jsonResponse({ error: "Não autenticado" }, 401)

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle()

    if (!profile || profile.role !== "admin" || !profile.is_active) {
      return jsonResponse({ error: "Apenas administradores" }, 403)
    }

    const body = (await req.json()) as Body
    const weekId = String(body.weekId ?? "").trim()
    const imagePath = String(body.imagePath ?? "").trim()
    if (!weekId || !imagePath) {
      return jsonResponse({ error: "weekId e imagePath são obrigatórios" }, 400)
    }

    const { data: week, error: weekError } = await admin
      .from("weeks")
      .select("id, start_date, end_date")
      .eq("id", weekId)
      .maybeSingle()
    if (weekError || !week) return jsonResponse({ error: "Semana não encontrada" }, 404)

    const { data: weekDays, error: daysError } = await admin
      .from("week_days")
      .select("id, weekday, date")
      .eq("week_id", weekId)
      .order("date", { ascending: true })
    if (daysError) throw daysError

    const { data: imageBlob, error: downloadError } = await admin.storage
      .from("menu-images")
      .download(imagePath)
    if (downloadError || !imageBlob) {
      return jsonResponse({ error: "Não foi possível ler a imagem enviada" }, 400)
    }

    const bytes = new Uint8Array(await imageBlob.arrayBuffer())
    const base64 = encodeBase64(bytes)
    const mime = imageBlob.type || guessMime(imagePath)

    const { data: extraction, error: insertError } = await admin
      .from("menu_extractions")
      .insert({
        week_id: weekId,
        image_path: imagePath,
        status: "pending_review",
        created_by: profile.id,
      })
      .select("*")
      .single()
    if (insertError) throw insertError

    const systemPrompt = [
      "Você extrai cardápios semanais de fotos de restaurantes brasileiros.",
      "Responda APENAS JSON válido no formato:",
      '{"days":[{"weekday":1,"date":"YYYY-MM-DD","items":["prato1","prato2"],"label":"Segunda"}]}',
      "weekday: 1=segunda ... 7=domingo (ISO).",
      "items: lista curta de pratos/acompanhamentos legíveis.",
      "Se não tiver certeza da data, omita date e use weekday.",
      "Não invente dias vazios. Ignore textos que não sejam cardápio.",
    ].join(" ")

    const userPrompt = [
      `Semana do sistema: ${week.start_date} a ${week.end_date}.`,
      `Dias ativos: ${JSON.stringify(weekDays ?? [])}.`,
      "Use esses dias como referência principal.",
    ].join("\n")

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: visionModel,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      await admin
        .from("menu_extractions")
        .update({
          status: "failed",
          error_message: `Falha no provider de IA (${openaiRes.status})`,
        })
        .eq("id", extraction.id)
      console.error("openai error", errText.slice(0, 500))
      return jsonResponse({
        error: "Não foi possível ler o cardápio agora. Você pode cadastrar manualmente.",
        extractionId: extraction.id,
      }, 502)
    }

    const openaiJson = await openaiRes.json()
    const content = openaiJson?.choices?.[0]?.message?.content
    let parsed: { days?: AiDay[] }
    try {
      parsed = JSON.parse(String(content ?? "{}"))
    } catch {
      await admin
        .from("menu_extractions")
        .update({ status: "failed", error_message: "Resposta da IA inválida" })
        .eq("id", extraction.id)
      return jsonResponse({
        error: "A IA retornou um formato inválido. Cadastre o cardápio manualmente.",
        extractionId: extraction.id,
      }, 502)
    }

    const days = Array.isArray(parsed.days) ? parsed.days : []
    const normalized = days.map((day) => ({
      weekday: day.weekday != null ? Number(day.weekday) : null,
      date: day.date ? String(day.date) : null,
      label: day.label ? String(day.label) : null,
      items: Array.isArray(day.items)
        ? day.items.map((item) => String(item).trim()).filter(Boolean)
        : [],
    })).filter((day) => day.items.length > 0)

    await admin
      .from("menu_extractions")
      .update({
        status: "pending_review",
        result_json: { days: normalized },
        error_message: null,
      })
      .eq("id", extraction.id)

    return jsonResponse({
      extractionId: extraction.id,
      imagePath,
      weekId,
      weekDays: weekDays ?? [],
      days: normalized,
    })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: "Falha interna ao extrair cardápio" }, 500)
  }
})

function encodeBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function guessMime(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}
