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
      estoqueMinimo,
    }: {
      produto: { tipo: CategoriaProduto; modelo: string; precoCompra: number; precoVenda: number; ativo: boolean }
      variantesData: { cor: string; tamanho: string }[]
      estoqueMinimo: number
    }) => {
      const novoProduto = await produtoRepository.criar(produto)
      await varianteRepository.criarEmLote(
        variantesData.map((v) => ({ produtoId: novoProduto.id, ...v, estoqueMinimo }))
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.produtos })
      queryClient.invalidateQueries({ queryKey: ['variantes'] })
    },
  })

  const updateProdutoMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: { modelo: string; precoCompra: number; precoVenda: number; estoqueMinimo: number }
    }) => {
      await produtoRepository.atualizar(id, {
        modelo: data.modelo,
        precoCompra: data.precoCompra,
        precoVenda: data.precoVenda,
      })
      await varianteRepository.atualizarMinimosPorProduto(id, data.estoqueMinimo)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.produtos })
      queryClient.invalidateQueries({ queryKey: ['variantes'] })
      queryClient.invalidateQueries({ queryKey: ['saldos'] })
    },
  })

  const archiveProdutoMutation = useMutation({
    mutationFn: (id: string) => produtoRepository.arquivar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.produtos })
      queryClient.invalidateQueries({ queryKey: ['variantes'] })
    },
  })

  const addVariantesMutation = useMutation({
    mutationFn: ({
      produtoId,
      variantesData,
      estoqueMinimo,
    }: {
      produtoId: string
      variantesData: { cor: string; tamanho: string }[]
      estoqueMinimo: number
    }) =>
      varianteRepository.criarEmLote(
        variantesData.map((v) => ({ produtoId, ...v, estoqueMinimo }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variantes'] })
      queryClient.invalidateQueries({ queryKey: ['saldos'] })
    },
  })

  return {
    produtos,
    variantes,
    isLoading: loadingProdutos || loadingVariantes,
    addProduto: (
      produto: { tipo: CategoriaProduto; modelo: string; precoCompra: number; precoVenda: number; ativo: boolean },
      variantesData: { cor: string; tamanho: string }[],
      estoqueMinimo: number
    ) => addProdutoMutation.mutateAsync({ produto, variantesData, estoqueMinimo }),
    updateProduto: (
      id: string,
      data: { modelo: string; precoCompra: number; precoVenda: number; estoqueMinimo: number }
    ) => updateProdutoMutation.mutateAsync({ id, data }),
    archiveProduto: (id: string) => archiveProdutoMutation.mutateAsync(id),
    addVariantesProduto: (
      produtoId: string,
      variantesData: { cor: string; tamanho: string }[],
      estoqueMinimo: number
    ) => addVariantesMutation.mutateAsync({ produtoId, variantesData, estoqueMinimo }),
    isAdding: addProdutoMutation.isPending,
    isUpdating: updateProdutoMutation.isPending,
    isAddingVariantes: addVariantesMutation.isPending,
  }
}
