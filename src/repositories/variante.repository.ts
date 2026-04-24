import { supabase } from '../lib/supabase'
import type { Variante } from '../types'

// --- Mapeamento DB → App ---

type VarianteRow = {
  id: string
  produto_id: string
  cor: string
  tamanho: string
  estoque_minimo: number
  sku_interno?: string | null
  criado_em: string
  atualizado_em: string
}

function toVariante(row: VarianteRow): Variante {
  return {
    id: row.id,
    produtoId: row.produto_id,
    cor: row.cor,
    tamanho: row.tamanho,
    estoqueMinimo: row.estoque_minimo,
    skuInterno: row.sku_interno ?? undefined,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

// --- Repositório ---

export const varianteRepository = {
  async listarPorProdutos(produtoIds: string[]): Promise<Variante[]> {
    if (produtoIds.length === 0) return []

    const { data, error } = await supabase
      .from('variantes')
      .select('*')
      .in('produto_id', produtoIds)
      .order('criado_em', { ascending: true })

    if (error) throw new Error(`Erro ao listar variantes: ${error.message}`)
    return (data as VarianteRow[]).map(toVariante)
  },

  async criarEmLote(
    variantesData: { produtoId: string; cor: string; tamanho: string }[]
  ): Promise<Variante[]> {
    if (variantesData.length === 0) return []

    const rows = variantesData.map((v) => ({
      produto_id: v.produtoId,
      cor: v.cor.trim(),
      tamanho: v.tamanho.trim(),
    }))

    const { data, error } = await supabase
      .from('variantes')
      .insert(rows)
      .select()

    if (error) throw new Error(`Erro ao criar variantes: ${error.message}`)
    return (data as VarianteRow[]).map(toVariante)
  },
}
