import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processarMensagem } from "../_shared/ai.ts";

const TG = (token: string) => `https://api.telegram.org/bot${token}`;

async function sendTelegramMessage(token: string, chatId: number, text: string) {
  await fetch(`${TG(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function transcribeWithGroq(groqKey: string, audioBlob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", new File([audioBlob], "audio.ogg", { type: "audio/ogg" }));
  form.append("model", "whisper-large-v3");
  form.append("language", "pt");
  form.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.text as string).trim();
}

Deno.serve(async (req: Request) => {
  try {
    const update = await req.json();
    const msg = update?.message;
    if (!msg) return new Response("ok");

    const chatId: number = msg.chat.id;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const groqKey = Deno.env.get("GROQ_API_KEY")!;
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let mensagem = "";

    if (msg.text) {
      mensagem = msg.text as string;
    } else if (msg.voice || msg.audio) {
      const fileId: string = msg.voice?.file_id ?? msg.audio?.file_id;
      const infoRes = await fetch(`${TG(botToken)}/getFile?file_id=${fileId}`);
      const { result } = await infoRes.json();
      const audioRes = await fetch(
        `https://api.telegram.org/file/bot${botToken}/${result.file_path}`,
      );
      const audioBlob = await audioRes.blob();
      mensagem = await transcribeWithGroq(groqKey, audioBlob);
    } else {
      await sendTelegramMessage(botToken, chatId, "Por favor, envie uma mensagem de texto ou áudio de voz.");
      return new Response("ok");
    }

    if (!mensagem.trim()) {
      await sendTelegramMessage(botToken, chatId, "Não consegui entender o áudio. Pode tentar de novo?");
      return new Response("ok");
    }

    // Load conversation history for this Telegram chat (last 15 messages)
    const { data: historico } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("canal", "telegram")
      .eq("chat_id", String(chatId))
      .order("criado_em", { ascending: false })
      .limit(15);

    const historicoOrdenado = (historico ?? []).reverse();

    // Process with AI
    const resposta = await processarMensagem(openrouterKey, supabase, mensagem, historicoOrdenado);

    // Save both messages to history
    await supabase.from("chat_messages").insert([
      { role: "user", content: mensagem, canal: "telegram", chat_id: String(chatId) },
      { role: "assistant", content: resposta, canal: "telegram", chat_id: String(chatId) },
    ]);

    // Reply on Telegram
    await sendTelegramMessage(botToken, chatId, resposta);

    return new Response("ok");
  } catch (err) {
    console.error("telegram-webhook error:", err);
    return new Response("ok"); // Always return 200 to Telegram
  }
});
