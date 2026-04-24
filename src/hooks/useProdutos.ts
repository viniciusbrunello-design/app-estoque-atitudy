import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { produtoRepository } from '../repositories/produto.repository'
import { varianteRepository } from '../repositories/variante.repository'
import { QUERY_KEYS } from '../lib/queryKeys'
import type { CategoriaProduto } from '../types'

export function useProdutos() {
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

  const addProdutoMutation = useMutation({
    mutationFn: async ({
      produto,
      variantesData,
    }: {
      produto: { tipo: CategoriaProduto; modelo: string; precoCompra: number; precoVenda: number; ativo: boolean }
      variantesData: { cor: string; tamanho: string }[]
    }) => {
      const novoProduto = await produtoRepository.criar(produto)
      await varianteRepository.criarEmLote(
        variantesData.map((v) => ({ produtoId: novoProduto.id, ...v }))
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.produtos })
      queryClient.invalidateQueries({ queryKey: ['variantes'] })
    },
  })

  const updateProdutoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { modelo: string; precoCompra: number; precoVenda: number } }) =>
      produtoRepository.atualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.produtos })
    },
  })

  const archiveProdutoMutation = useMutation({
    mutationFn: (id: string) => produtoRepository.arquivar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.produtos })
      queryClient.invalidateQueries({ queryKey: ['variantes'] })
    },
  })

  return {
    produtos,
    variantes,
    isLoading: loadingProdutos || loadingVariantes,
    addProduto: (
      produto: { tipo: CategoriaProduto; modelo: string; precoCompra: number; precoVenda: number; ativo: boolean },
      variantesData: { cor: string; tamanho: string }[]
    ) => addProdutoMutation.mutateAsync({ produto, variantesData }),
    updateProduto: (id: string, data: { modelo: string; precoCompra: number; precoVenda: number }) =>
      updateProdutoMutation.mutateAsync({ id, data }),
    archiveProduto: (id: string) => archiveProdutoMutation.mutateAsync(id),
    isAdding: addProdutoMutation.isPending,
    isUpdating: updateProdutoMutation.isPending,
  }
}
