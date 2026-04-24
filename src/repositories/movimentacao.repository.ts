import { z } from 'zod'
import { supabase } from '../lib/supabase'
import type { Movimentacao, TipoMovimentacao } from '../types'

// --- Validação ---

const registrarMovimentacaoSchema = z.object({
  varianteId: z.string().uuid('ID de variante inválido'),
  tipo: z.enum(['Entrada', 'Saída', 'Ajuste Manual']),
  quantidade: z.number().int().positive('Quantidade deve ser maior que zero'),
})

// --- Mapeamento DB → App ---

type MovimentacaoRow = {
  id: string
  variante_id: string
  tipo_movimentacao: string
  quantidade: number
  observacao: string | null
  data_hora: string
  usuario_id: string | null
}

type SaldoRow = {
  variante_id: string
  saldo_atual: number
  total_entradas: number
  total_saidas: number
}

function toMovimentacao(row: MovimentacaoRow): Movimentacao {
  return {
    id: row.id,
    varianteId: row.variante_id,
    tipoMovimentacao: row.tipo_movimentacao as TipoMovimentacao,
    quantidade: row.quantidade,
    observacao: row.observacao ?? '',
    dataHora: row.data_hora,
    usuarioId: row.usuario_id ?? undefined,
  }
}

// --- Tipos exportados ---

export type SaldoVariante = {
  varianteId: string
  saldo: number
  entradas: number
  saidas: number
}

// --- Repositório ---

export const movimentacaoRepository = {
  async listar(): Promise<Movimentacao[]> {
    const { data, error } = await supabase
      .from('movimentacoes')
      .select('*')
      .order('data_hora', { ascending: false })

    if (error) throw new Error(`Erro ao listar movimentações: ${error.message}`)
    return (data as MovimentacaoRow[]).map(toMovimentacao)
  },

  async registrar(
    varianteId: string,
    tipo: TipoMovimentacao,
    quantidade: number,
    observacao = ''
  ): Promise<Movimentacao> {
    registrarMovimentacaoSchema.parse({ varianteId, tipo, quantidade })

    const { data, error } = await supabase
      .from('movimentacoes')
      .insert({
        variante_id: varianteId,
        tipo_movimentacao: tipo,
        quantidade,
        observacao: observacao.trim() || null,
      })
      .select()
      .single()

    if (error) throw new Error(`Erro ao registrar movimentação: ${error.message}`)
    return toMovimentacao(data as MovimentacaoRow)
  },

  async buscarSaldos(varianteIds: string[]): Promise<SaldoVariante[]> {
    if (varianteIds.length === 0) return []

    const { data, error } = await supabase
      .from('vw_saldo_estoque')
      .select('*')
      .in('variante_id', varianteIds)

    if (error) throw new Error(`Erro ao buscar saldos: ${error.message}`)

    return (data as SaldoRow[]).map((row) => ({
      varianteId: row.variante_id,
      saldo: row.saldo_atual,
      entradas: row.total_entradas,
      saidas: row.total_saidas,
    }))
  },
}
