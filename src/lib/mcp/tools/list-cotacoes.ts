import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_cotacoes",
  title: "Listar cotações",
  description: "Lista as cotações (listas) do usuário autenticado. Filtra opcionalmente por status.",
  inputSchema: {
    status: z.enum(["aberta", "finalizada"]).optional().describe("Filtrar por status."),
    limit: z.number().int().min(1).max(100).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = sb(ctx).from("listas").select("id,nome,status,created_at,produtos").eq("user_id", ctx.getUserId()).order("created_at", { ascending: false }).limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      status: r.status,
      created_at: r.created_at,
      produtos_count: Array.isArray(r.produtos) ? r.produtos.length : 0,
    }));
    return { content: [{ type: "text", text: JSON.stringify(rows) }], structuredContent: { rows } };
  },
});
