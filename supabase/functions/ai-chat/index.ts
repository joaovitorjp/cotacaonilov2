import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response("messages required", { status: 400, headers: corsHeaders });
    }

    // Load user context
    const [listasRes, fornRes, respRes, profileRes] = await Promise.all([
      supabase.from("listas").select("id,nome,status,produtos,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("fornecedores").select("nome,estado,whatsapp").eq("user_id", userId).limit(50),
      supabase.from("respostas").select("id,fornecedor,lista_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("profiles").select("nome,email").eq("user_id", userId).maybeSingle(),
    ]);

    const listas = listasRes.data ?? [];
    const fornecedores = fornRes.data ?? [];
    const respostas = respRes.data ?? [];
    const profile = profileRes.data;

    const abertas = listas.filter((l: any) => l.status !== "finalizada").length;
    const finalizadas = listas.filter((l: any) => l.status === "finalizada").length;

    const contextSummary = `
Você é o assistente de IA do sistema de Cotações Nilo. Você ajuda o usuário a entender o sistema e seus dados.

SOBRE O SISTEMA:
- Sistema de cotações de preços para fornecedores nas regiões Mato Grosso (MT) e Goiás (GO).
- Fluxo: importar planilha (.xls) de produtos -> gerar links UUID por fornecedor/estado -> fornecedores respondem preços online -> análise comparativa -> escolha de vencedores e exportação.
- Preços em R$ (BRL). Menor preço destacado em verde. Undercutting reduz até 5 centavos terminando em 5, 7 ou 9.
- Funcionalidades: importação .xls, geração de links em massa, análise de preços, PDF de comparação, exportação CSV de vencedores, markup por fornecedor, histórico de preços, notificações em tempo real, módulo de estoques.

DADOS DO USUÁRIO (${profile?.nome || profile?.email || "usuário"}):
- Cotações: ${listas.length} carregadas (${abertas} abertas, ${finalizadas} finalizadas)
- Fornecedores cadastrados: ${fornecedores.length}
- Respostas recebidas: ${respostas.length}

ÚLTIMAS COTAÇÕES:
${listas.slice(0, 10).map((l: any) => `- "${l.nome}" (${l.status}) - ${(l.produtos as any[])?.length ?? 0} produtos - ${new Date(l.created_at).toLocaleDateString("pt-BR")}`).join("\n") || "(nenhuma)"}

FORNECEDORES (amostra):
${fornecedores.slice(0, 15).map((f: any) => `- ${f.nome} (${f.estado || "?"})`).join("\n") || "(nenhum)"}

Responda de forma clara, objetiva e em português brasileiro. Use os dados acima quando relevante.
`.trim();

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500, headers: corsHeaders });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: contextSummary },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: text }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
