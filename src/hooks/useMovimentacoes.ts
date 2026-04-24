import { useQuery } from '@tanstack/react-query'
import { movimentacaoRepository } from '../repositories/movimentacao.repository'
import { QUERY_KEYS } from '../lib/queryKeys'

export function useMovimentacoes() {
  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.movimentacoes,
    queryFn: () => movimentacaoRepository.listar(),
  })

  return { movimentacoes, isLoading }
}
