export type CategoriaProduto = 'Calçados' | 'Bolsas' | 'Bijuterias';

export interface Produto {
  id: string;
  tipo: CategoriaProduto;
  modelo: string;
  precoCompra: number;
  precoVenda: number;
  ativo: boolean;
  criadoEm: string; /* ISO string */
  atualizadoEm: string;
}

export interface Variante {
  id: string;
  produtoId: string;
  cor: string; // Vazio para único
  tamanho: string; // Vazio para único
  estoqueMinimo: number;
  skuInterno?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type TipoMovimentacao = 'Entrada' | 'Saída' | 'Ajuste Manual';

export interface Movimentacao {
  id: string;
  varianteId: string;
  tipoMovimentacao: TipoMovimentacao;
  quantidade: number;
  observacao: string;
  dataHora: string; /* ISO string */
  usuarioId?: string;
}

export interface ResumoEstoque {
  varianteId: string;
  totalEntradas: number;
  totalSaidas: number;
  saldoAtual: number;
}
