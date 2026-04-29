import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processarMensagem } from "../_shared/ai.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { mensagem, historico = [], imagemUrl } = await req.json();

    if (!mensagem?.trim() && !imagemUrl) {
      return new Response(JSON.stringify({ error: "mensagem vazia" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const resposta = await processarMensagem(openrouterKey, supabase, mensagem ?? '', historico, imagemUrl);

    return new Response(JSON.stringify({ resposta }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-chat error:", err);
    return new Response(
      JSON.stringify({ resposta: "Erro interno. Tente novamente em instantes." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
