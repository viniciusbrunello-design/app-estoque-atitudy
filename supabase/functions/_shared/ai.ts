import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient>;
type Message = { role: string; content: string };

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "low" | "high" } };

type VisionMessage = { role: string; content: string | ContentPart[] };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

// ======================== SYSTEM PROMPTS ========================

const ROUTER_PROMPT = `
Você é Lucas, gerente de estoque de uma loja de calçados e acessórios femininos.
Analise a mensagem e retorne APENAS este JSON: {"rota": "Produto" | "Estoque" | "Consulta" | "Indefinido"}

**Produto** — cadastrar novo produto ou atualizar dados gerais:
- Ex: "Sandália gladiadora cores azul e preto, do 34 ao 39, vendo a 89 reais"
- Ex: "O preço da gladiadora mudou para 95 reais"
- Ex: "A gladiadora também tem a cor nude"

**Estoque** — informar quantidades específicas por tamanho e/ou cor:
- Ex: "Da gladiadora preta tenho: dois 35, um 36, três 37"
- Ex: "Entrou mais 5 bolsas tiracolo caramelo"
- Ex: "A gladiadora azul 36 agora são 4 pares"

**Consulta** — perguntas sobre disponibilidade, preços ou relatórios:
- Ex: "Quantos pares da gladiadora preta 37 tem?"
- Ex: "Qual o preço da bolsa tiracolo?"
- Ex: "Mostra o estoque baixo"

**Indefinido** — mensagem confusa, incompleta ou fora de contexto
`.trim();

const PRODUTO_PROMPT = `
Você extrai informações de produtos de uma loja de calçados, bolsas e bijuterias femininas.

Tipos (identifique pelas palavras-chave):
- "Calçados": sandália, sapato, scarpin, tamanco, rasteira, salto, sapatilha, bota, ankle boot, tênis
- "Bolsas": bolsa, mochila, carteira, necessaire, clutch, tiracolo
- "Bijuterias": brinco, colar, pulseira, anel, bracelete, pingente

Retorne APENAS JSON:
{
  "tipo": "Calçados" | "Bolsas" | "Bijuterias",
  "modelo": "Nome capitalizado do produto",
  "cores": ["array de cores normalizadas"],
  "tamanhos": "string: '34 ao 39', '35, 36, 37', 'Único'",
  "preco_venda": número ou null,
  "preco_compra": número ou null,
  "dados_completos": true se tem tipo + modelo + 1 cor + preco_venda,
  "campos_faltantes": ["nomes amigáveis dos campos ausentes"]
}

Regras:
- Normalize cores: "preta" → "Preto", "azulzinha" → "Azul", capitalize
- Calçados: range de tamanhos ("34 ao 39"); Bolsas/Bijuterias: "Único"
- preco_compra: detecte "paguei", "custou", "comprei por"
- Se for atualização ("o preço mudou", "errei a cor"), extraia só o que foi mencionado
`.trim();

const ESTOQUE_PROMPT = `
Você extrai dados de contagem de estoque de uma loja de calçados e acessórios femininos.

Retorne APENAS JSON:
{
  "modelo": "Nome normalizado do produto",
  "cor": "Cor específica normalizada ou null",
  "tipo_contagem": "tamanhos" | "unidades",
  "tamanhos": {"33":0,"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0,"41":0},
  "unidades": número ou null,
  "dados_completos": boolean,
  "campos_faltantes": ["campos que faltam em português"]
}

Regras:
- "tamanhos": quando mencionar numeração (calçados) | "unidades": total sem tamanho (bolsas/bijuterias)
- Preencha apenas os tamanhos mencionados, o resto fica 0
- Normalize: "gladiadora" → "Sandália Gladiadora", "tiracolo" → "Bolsa Tiracolo"
- Normalize cores: "preta" → "Preto", "pretinha" → "Preto", capitalize
- Converta números por extenso: "dois" → 2, "três" → 3
- dados_completos = true se tem modelo + cor + pelo menos 1 quantidade > 0
`.trim();

// ======================== LLM CALL ========================

async function callLLM(
  apiKey: string,
  systemPrompt: string,
  messages: Message[],
  jsonMode = false,
  imagemUrl?: string,
): Promise<string> {
  let visionMessages: VisionMessage[] = messages.map((m) => ({ ...m }));

  if (imagemUrl) {
    const lastIdx = visionMessages.length - 1;
    const lastMsg = visionMessages[lastIdx];
    if (lastMsg.role === "user") {
      const parts: ContentPart[] = [];
      if ((lastMsg.content as string).trim()) {
        parts.push({ type: "text", text: lastMsg.content as string });
      }
      parts.push({ type: "image_url", image_url: { url: imagemUrl, detail: "low" } });
      visionMessages[lastIdx] = { role: "user", content: parts };
    }
  }

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = {
    model: MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...visionMessages],
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://estoqueatitudy.app",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}

// ======================== HELPERS ========================

function parseTamanhos(tamanhosStr: string | null): string[] {
  if (!tamanhosStr) return [""];
  const s = tamanhosStr.trim().toLowerCase();
  if (s === "único" || s === "unico" || s === "") return [""];

  const rangeMatch = s.match(/(\d+)\s+a[o]?\s+(\d+)/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    return Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
  }

  const parts = s.split(/[,\s]+/).map((t) => t.trim()).filter((t) => /^\d+$/.test(t));
  return parts.length > 0 ? parts : [""];
}

// ======================== HANDLERS ========================

async function handleProduto(
  apiKey: string,
  supabase: SupabaseClient,
  messages: Message[],
): Promise<string> {
  const raw = await callLLM(apiKey, PRODUTO_PROMPT, messages, true);
  const d = JSON.parse(raw);

  if (!d.dados_completos) {
    const faltam = (d.campos_faltantes as string[] ?? []).join(", ");
    return `Entendi! Mas faltam algumas informações: ${faltam}. Pode me informar?`;
  }

  const tamanhos = parseTamanhos(d.tamanhos);
  const cores: string[] = d.cores?.length ? d.cores : [""];

  const { data: existing } = await supabase
    .from("produtos")
    .select("id, modelo, preco_venda, preco_compra")
    .ilike("modelo", `%${d.modelo}%`)
    .eq("ativo", true)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, number> = {};
    if (d.preco_venda != null) updates.preco_venda = d.preco_venda;
    if (d.preco_compra != null) updates.preco_compra = d.preco_compra;

    if (Object.keys(updates).length > 0) {
      await supabase.from("produtos").update(updates).eq("id", existing.id);
    }

    return `✅ ${existing.modelo} atualizado!\n\nPreço de venda: R$ ${Number(d.preco_venda ?? existing.preco_venda).toFixed(2)}`;
  }

  const { data: novoProduto, error } = await supabase
    .from("produtos")
    .insert({
      tipo: d.tipo,
      modelo: d.modelo,
      preco_venda: d.preco_venda ?? 0,
      preco_compra: d.preco_compra ?? 0,
      ativo: true,
    })
    .select()
    .single();

  if (error) throw error;

  const variantesData = cores.flatMap((cor: string) =>
    tamanhos.map((tamanho: string) => ({
      produto_id: novoProduto.id,
      cor,
      tamanho,
    }))
  );

  await supabase.from("variantes").insert(variantesData);

  const linhas = [
    `✅ ${d.modelo} cadastrado com sucesso!`,
    ``,
    `📦 Tipo: ${d.tipo}`,
    cores[0] ? `🎨 Cores: ${cores.join(", ")}` : null,
    d.tamanhos && d.tamanhos !== "Único" ? `📐 Tamanhos: ${d.tamanhos}` : null,
    `💰 Preço de venda: R$ ${Number(d.preco_venda ?? 0).toFixed(2)}`,
    d.preco_compra != null ? `💸 Preço de compra: R$ ${Number(d.preco_compra).toFixed(2)}` : null,
    ``,
    `${variantesData.length} variação(ões) criada(s).`,
  ].filter((l) => l !== null);

  return linhas.join("\n");
}

async function handleEstoque(
  apiKey: string,
  supabase: SupabaseClient,
  messages: Message[],
): Promise<string> {
  const raw = await callLLM(apiKey, ESTOQUE_PROMPT, messages, true);
  const d = JSON.parse(raw);

  if (!d.dados_completos) {
    const faltam = (d.campos_faltantes as string[] ?? []).join(", ");
    return `Preciso de mais informações: ${faltam}. Pode completar?`;
  }

  const { data: produto } = await supabase
    .from("produtos")
    .select("id, modelo, tipo")
    .ilike("modelo", `%${d.modelo}%`)
    .eq("ativo", true)
    .maybeSingle();

  if (!produto) {
    return `Produto "${d.modelo}" não encontrado no catálogo. Cadastre-o primeiro informando: nome, cores, tamanhos e preço de venda.`;
  }

  const cor = d.cor ?? "";
  const resultados: string[] = [];

  const atualizarVariante = async (tamanho: string, novaQty: number) => {
    let { data: variante } = await supabase
      .from("variantes")
      .select("id")
      .eq("produto_id", produto.id)
      .eq("cor", cor)
      .eq("tamanho", tamanho)
      .maybeSingle();

    if (!variante) {
      const { data: nova } = await supabase
        .from("variantes")
        .insert({ produto_id: produto.id, cor, tamanho })
        .select()
        .single();
      variante = nova;
    }

    const { data: saldoRow } = await supabase
      .from("vw_saldo_estoque")
      .select("saldo_atual")
      .eq("variante_id", variante!.id)
      .maybeSingle();

    const saldoAtual = saldoRow?.saldo_atual ?? 0;
    const diff = novaQty - saldoAtual;

    if (diff !== 0) {
      await supabase.from("movimentacoes").insert({
        variante_id: variante!.id,
        tipo_movimentacao: diff > 0 ? "Entrada" : "Saída",
        quantidade: Math.abs(diff),
        observacao: "Registro via Assistente",
      });
    }

    return diff;
  };

  if (d.tipo_contagem === "tamanhos") {
    for (const [tamanho, qty] of Object.entries(d.tamanhos)) {
      const novaQty = qty as number;
      if (novaQty === 0) continue;
      const diff = await atualizarVariante(tamanho, novaQty);
      const sinal = diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : "=";
      resultados.push(`Tam. ${tamanho}: ${novaQty} par(es)  (${sinal})`);
    }
  } else {
    const novaQty = (d.unidades ?? 0) as number;
    await atualizarVariante("", novaQty);
    resultados.push(`${novaQty} unidade(s)`);
  }

  if (resultados.length === 0) {
    return `O estoque de ${produto.modelo}${cor ? ` (${cor})` : ""} já estava correto.`;
  }

  const corLabel = cor ? ` — ${cor}` : "";
  return `✅ Estoque atualizado!\n\n📦 ${produto.modelo}${corLabel}\n${resultados.join("\n")}`;
}

async function handleConsulta(
  apiKey: string,
  supabase: SupabaseClient,
  messages: Message[],
): Promise<string> {
  const [{ data: produtos }, { data: variantes }, { data: saldos }] = await Promise.all([
    supabase.from("produtos").select("id, tipo, modelo, preco_venda").eq("ativo", true).order("modelo"),
    supabase.from("variantes").select("id, produto_id, cor, tamanho"),
    supabase.from("vw_saldo_estoque").select("variante_id, saldo_atual"),
  ]);

  const saldoMap = new Map((saldos ?? []).map((s) => [s.variante_id, s.saldo_atual]));

  let contexto = "=== CATÁLOGO E ESTOQUE ===\n";
  for (const p of produtos ?? []) {
    const pvs = (variantes ?? []).filter((v) => v.produto_id === p.id);
    contexto += `\n${p.modelo} (${p.tipo}) — R$ ${Number(p.preco_venda).toFixed(2)}\n`;
    for (const v of pvs) {
      const saldo = saldoMap.get(v.id) ?? 0;
      const desc = [v.cor, v.tamanho].filter(Boolean).join(" / ") || "Único";
      contexto += `  • ${desc}: ${saldo} unid.\n`;
    }
  }

  if (!produtos?.length) {
    contexto += "(Nenhum produto cadastrado ainda)\n";
  }

  const consultaPrompt =
    `Você é Lucas, gerente de estoque amigável de uma loja de calçados e acessórios femininos.\n` +
    `Responda a pergunta do usuário baseado nos dados abaixo. Seja direto e use emojis com moderação.\n\n${contexto}`;

  return await callLLM(apiKey, consultaPrompt, messages, false);
}

async function handleFoto(
  apiKey: string,
  supabase: SupabaseClient,
  messages: Message[],
  imagemUrl: string,
): Promise<string> {
  const { data: produtos } = await supabase
    .from("produtos")
    .select("id, modelo, tipo")
    .eq("ativo", true)
    .order("modelo");

  if (!produtos?.length) {
    return "Não há produtos cadastrados ainda. Cadastre um produto primeiro antes de adicionar fotos.";
  }

  const listaProdutos = produtos.map((p) => `- ${p.modelo} (${p.tipo})`).join("\n");

  const fotoPrompt =
    `Você é Lucas, gerente de estoque de uma loja de calçados e acessórios femininos.\n` +
    `O usuário enviou uma foto de um produto. Analise a imagem e o texto para identificar de qual produto cadastrado se trata.\n\n` +
    `Produtos cadastrados:\n${listaProdutos}\n\n` +
    `Retorne APENAS JSON:\n` +
    `{"produto_identificado": "nome exato do produto da lista ou null", "confianca": "alta" | "media" | "baixa"}`;

  const raw = await callLLM(apiKey, fotoPrompt, messages, true, imagemUrl);
  const d = JSON.parse(raw);

  if (!d.produto_identificado || d.confianca === "baixa") {
    return (
      `Recebi a foto, mas não consegui identificar o produto com certeza. 🤔\n\n` +
      `Produtos cadastrados:\n${listaProdutos}\n\n` +
      `Envie novamente a foto mencionando o produto. Ex: "Foto da Sandália Gladiadora"`
    );
  }

  const produto = produtos.find(
    (p) =>
      p.modelo.toLowerCase().includes(d.produto_identificado.toLowerCase()) ||
      d.produto_identificado.toLowerCase().includes(p.modelo.toLowerCase()),
  );

  if (!produto) {
    return (
      `Produto "${d.produto_identificado}" não encontrado no catálogo.\n\n` +
      `Produtos disponíveis:\n${listaProdutos}`
    );
  }

  const { error } = await supabase
    .from("produtos")
    .update({ foto_url: imagemUrl })
    .eq("id", produto.id);

  if (error) return "Erro ao salvar a foto. Tente novamente.";

  return `✅ Foto adicionada com sucesso!\n\n📦 Produto: ${produto.modelo}\n\nA imagem já aparece no catálogo de produtos.`;
}

// ======================== MAIN ENTRY ========================

export async function processarMensagem(
  openrouterKey: string,
  supabase: SupabaseClient,
  mensagem: string,
  historico: Message[],
  imagemUrl?: string,
): Promise<string> {
  const messages: Message[] = [...historico, { role: "user", content: mensagem }];

  // Imagem presente → sempre rota de foto
  if (imagemUrl) {
    return handleFoto(openrouterKey, supabase, messages, imagemUrl);
  }

  const routeRaw = await callLLM(openrouterKey, ROUTER_PROMPT, messages, true);
  let rota = "Indefinido";
  try {
    rota = JSON.parse(routeRaw).rota ?? "Indefinido";
  } catch {
    // keep Indefinido
  }

  switch (rota) {
    case "Produto":
      return handleProduto(openrouterKey, supabase, messages);
    case "Estoque":
      return handleEstoque(openrouterKey, supabase, messages);
    case "Consulta":
      return handleConsulta(openrouterKey, supabase, messages);
    default:
      return "Não entendi bem 🤔\n\nPosso ajudar com:\n• Cadastrar produtos (nome, cores, tamanhos, preços)\n• Registrar estoque (quantidades por tamanho/cor)\n• Consultar disponibilidade e preços\n• Adicionar fotos aos produtos (envie a foto!)\n\nTente novamente!";
  }
}
