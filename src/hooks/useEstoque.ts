import { useQuery, useQueryClient } from '@tanstack/react-query'
import { produtoRepository } from '../repositories/produto.repository'
import { varianteRepository } from '../repositories/variante.repository'
import { movimentacaoRepository } from '../repositories/movimentacao.repository'
import { QUERY_KEYS } from '../lib/queryKeys'
import type { Produto, Variante, TipoMovimentacao } from '../types'

export type EstoqueItem = Variante & {
  product: Produto
  nome: string
  saldo: number
  entradas: number
  saidas: number
  isLow: boolean
}

export function useEstoque() {
  const queryClient = useQueryClient()

  const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
    queryKey: QUERY_KEYS.produtos,
    queryFn: () => produtoRepository.listarAtivos(),
  })

  const produtoIds = produtos.map((p) => p.id)

  const { data: variantes = [], isLoading: loadingVariantes } = useQuery({
    queryKey: QUERY_KEYS.variantes(produtoIds),
    queryFn: () => varianteRepository.listarPorProdutos(produtoIds),
    enabled: produtoIds.length > 0,
  })

  const varianteIds = variantes.map((v) => v.id)

  const { data: saldosArray = [], isLoading: loadingSaldos } = useQuery({
    queryKey: QUERY_KEYS.saldos(varianteIds),
    queryFn: () => movimentacaoRepository.buscarSaldos(varianteIds),
    enabled: varianteIds.length > 0,
  })

  const saldosMap = new Map(saldosArray.map((s) => [s.varianteId, s]))

  const items: EstoqueItem[] = variantes
    .map((variant) => {
      const product = produtos.find((p) => p.id === variant.produtoId)
      if (!product) return null

      const saldoData = saldosMap.get(variant.id) ?? { saldo: 0, entradas: 0, saidas: 0 }

      let nome = `${product.tipo} ${product.modelo}`
      if (variant.cor) nome += ` - ${variant.cor}`
      if (variant.tamanho) nome += ` (Tam: ${variant.tamanho})`

      return {
        ...variant,
        product,
        nome,
        saldo: saldoData.saldo,
        entradas: saldoData.entradas,
        saidas: saldoData.saidas,
        isLow: saldoData.saldo <= (variant.estoqueMinimo || 2),
      }
    })
    .filter((item): item is EstoqueItem => item !== null)

  const registrarMovimentacao = async (
    varianteId: string,
    tipo: TipoMovimentacao,
    quantidade: number,
    observacao = ''
  ): Promise<boolean> => {
    try {
      if (tipo === 'Saída') {
        const [saldoAtual] = await movimentacaoRepository.buscarSaldos([varianteId])
        if (!saldoAtual || saldoAtual.saldo < quantidade) return false
      }

      await movimentacaoRepository.registrar(varianteId, tipo, quantidade, observacao)

      queryClient.invalidateQueries({ queryKey: ['saldos'] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.movimentacoes })

      return true
    } catch {
      return false
    }
  }

  return {
    items,
    isLoading: loadingProdutos || loadingVariantes || loadingSaldos,
    registrarMovimentacao,
  }
}
