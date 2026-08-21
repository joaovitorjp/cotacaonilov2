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
  name: "list_fornecedores",
  title: "Listar fornecedores",
  description: "Lista os fornecedores cadastrados pelo usuário autenticado.",
  inputSchema: {
    estado: z.enum(["MT", "GO"]).optional(),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ estado, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = sb(ctx)
      .from("fornecedores")
      .select(
        "id,nome,nome_representante,whatsapp,email,codigo_estado,codigo_interno_ciss_mt,codigo_interno_ciss_go,codigo_interno_consinco_mt,codigo_interno_consinco_go",
      )
      .eq("user_id", ctx.getUserId())
      .limit(limit);
    if (estado) q = q.eq("codigo_estado", estado);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }], structuredContent: { rows: data ?? [] } };
  },
});
