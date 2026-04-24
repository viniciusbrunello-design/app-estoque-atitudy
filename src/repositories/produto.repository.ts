import { z } from 'zod'
import { supabase } from '../lib/supabase'
import type { Produto, CategoriaProduto } from '../types'

// --- Validação ---

const criarProdutoSchema = z.object({
  tipo: z.enum(['Calçados', 'Bolsas', 'Bijuterias']),
  modelo: z.string().min(2, 'Modelo deve ter ao menos 2 caracteres').max(100),
  precoCompra: z.number().min(0, 'Preço de compra não pode ser negativo'),
  precoVenda: z.number().min(0, 'Preço de venda não pode ser negativo'),
})

// --- Mapeamento DB → App (snake_case → camelCase) ---

type ProdutoRow = {
  id: string
  tipo: string
  modelo: string
  preco_compra: number
  preco_venda: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

function toProduto(row: ProdutoRow): Produto {
  return {
    id: row.id,
    tipo: row.tipo as CategoriaProduto,
    modelo: row.modelo,
    precoCompra: Number(row.preco_compra),
    precoVenda: Number(row.preco_venda),
    ativo: row.ativo,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

// --- Repositório ---

export const produtoRepository = {
  async listarAtivos(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('criado_em', { ascending: false })

    if (error) throw new Error(`Erro ao listar produtos: ${error.message}`)
    return (data as ProdutoRow[]).map(toProduto)
  },

  async criar(produto: Omit<Produto, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Produto> {
    criarProdutoSchema.parse(produto)

    const { data, error } = await supabase
      .from('produtos')
      .insert({
        tipo: produto.tipo,
        modelo: produto.modelo.trim(),
        preco_compra: produto.precoCompra,
        preco_venda: produto.precoVenda,
        ativo: true,
      })
      .select()
      .single()

    if (error) throw new Error(`Erro ao criar produto: ${error.message}`)
    return toProduto(data as ProdutoRow)
  },

  async atualizar(
    id: string,
    data: { modelo: string; precoCompra: number; precoVenda: number }
  ): Promise<Produto> {
    z.object({
      modelo: z.string().min(2, 'Modelo deve ter ao menos 2 caracteres').max(100),
      precoCompra: z.number().min(0, 'Preço de compra não pode ser negativo'),
      precoVenda: z.number().min(0, 'Preço de venda não pode ser negativo'),
    }).parse(data)

    const { data: result, error } = await supabase
      .from('produtos')
      .update({
        modelo: data.modelo.trim(),
        preco_compra: data.precoCompra,
        preco_venda: data.precoVenda,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Erro ao atualizar produto: ${error.message}`)
    return toProduto(result as ProdutoRow)
  },

  async arquivar(id: string): Promise<void> {
    const { error } = await supabase
      .from('produtos')
      .update({ ativo: false })
      .eq('id', id)

    if (error) throw new Error(`Erro ao arquivar produto: ${error.message}`)
  },
}
