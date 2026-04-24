import { useProdutos } from '../hooks/useProdutos';
import { useMovimentacoes } from '../hooks/useMovimentacoes';
import { Search, TrendingUp, TrendingDown, ArrowRightLeft, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

export default function Movimentacoes() {
  const { produtos, variantes } = useProdutos();
  const { movimentacoes } = useMovimentacoes();
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');

  const getVariantName = (varianteId: string) => {
    const variant = variantes.find((v) => v.id === varianteId);
    if (!variant) return 'Desconhecido';
    const product = produtos.find((p) => p.id === variant.produtoId);
    if (!product) return 'Desconhecido';

    let name = `${product.tipo} ${product.modelo}`;
    if (variant.cor) name += ` — ${variant.cor}`;
    if (variant.tamanho) name += ` (Tam: ${variant.tamanho})`;
    return name;
  };

  const filteredMovimentacoes = movimentacoes.filter((mov) => {
    if (filtroTipo !== 'Todos' && mov.tipoMovimentacao !== filtroTipo) return false;
    const nome = getVariantName(mov.varianteId).toLowerCase();
    const isObservacaoMatch = mov.observacao?.toLowerCase().includes(search.toLowerCase());
    return nome.includes(search.toLowerCase()) || isObservacaoMatch;
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Movimentações</h2>
          <p className="page-subtitle">Histórico de todas as entradas e saídas</p>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-bar">
          <Search size={18} color="var(--color-text-tertiary)" />
          <input
            type="text"
            placeholder="Buscar por produto ou observação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-select">
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="Todos">Todos os Tipos</option>
            <option value="Entrada">Entradas</option>
            <option value="Saída">Saídas</option>
            <option value="Ajuste Manual">Ajustes Manuais</option>
          </select>
        </div>
      </div>

      {filteredMovimentacoes.length === 0 ? (
        <div className="surface">
          <div className="empty-state">
            <div className="empty-state-icon"><ArrowLeftRight size={28} /></div>
            <p className="empty-state-title">Nenhuma movimentação encontrada</p>
            <p className="empty-state-desc">
              {search || filtroTipo !== 'Todos'
                ? 'Tente outros filtros de busca.'
                : 'As movimentações registradas no estoque aparecerão aqui.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="surface table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '36px' }}></th>
                <th>Data/Hora</th>
                <th>Produto</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Quantidade</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovimentacoes.map((mov) => (
                <tr key={mov.id}>
                  <td style={{ paddingRight: 0 }}>
                    {mov.tipoMovimentacao === 'Entrada' ? (
                      <TrendingUp size={18} color="var(--color-success)" />
                    ) : mov.tipoMovimentacao === 'Saída' ? (
                      <TrendingDown size={18} color="var(--color-danger)" />
                    ) : (
                      <ArrowRightLeft size={18} color="var(--color-warning)" />
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{format(new Date(mov.dataHora), 'dd/MM/yyyy', { locale: ptBR })}</div>
                    <div className="text-xs text-secondary">{format(new Date(mov.dataHora), 'HH:mm', { locale: ptBR })}</div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{getVariantName(mov.varianteId)}</td>
                  <td>
                    {mov.tipoMovimentacao === 'Entrada' ? (
                      <span className="badge badge-success">Entrada</span>
                    ) : mov.tipoMovimentacao === 'Saída' ? (
                      <span className="badge badge-danger">Saída</span>
                    ) : (
                      <span className="badge badge-warning">Ajuste</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: mov.tipoMovimentacao === 'Entrada' ? 'var(--color-success)' : mov.tipoMovimentacao === 'Saída' ? 'var(--color-danger)' : 'var(--color-primary)',
                      }}
                    >
                      {mov.tipoMovimentacao === 'Entrada' ? '+' : mov.tipoMovimentacao === 'Saída' ? '-' : ''}{mov.quantidade}
                    </span>
                  </td>
                  <td className="text-secondary text-sm">{mov.observacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
