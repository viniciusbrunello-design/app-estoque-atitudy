export const QUERY_KEYS = {
  produtos: ['produtos'] as const,
  variantes: (produtoIds: string[]) => ['variantes', [...produtoIds].sort().join(',')] as const,
  saldos: (varianteIds: string[]) => ['saldos', [...varianteIds].sort().join(',')] as const,
  movimentacoes: ['movimentacoes'] as const,
}
