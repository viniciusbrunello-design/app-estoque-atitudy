import { useProdutos } from '../hooks/useProdutos';
import { useEstoque } from '../hooks/useEstoque';
import { useMovimentacoes } from '../hooks/useMovimentacoes';
import { Package, Boxes, AlertTriangle, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const { produtos, variantes } = useProdutos();
  const { items } = useEstoque();
  const { movimentacoes } = useMovimentacoes();

  const totalStock = items.reduce((sum, item) => sum + item.saldo, 0);
  const lowStockItems = items.filter((item) => item.isLow);

  const recentMovements = [...movimentacoes]
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .slice(0, 5);

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

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Resumo da sua operação</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="surface kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
            <Package size={22} />
          </div>
          <div>
            <p className="kpi-label">Total de Produtos</p>
            <p className="kpi-value">{produtos.length}</p>
          </div>
        </div>

        <div className="surface kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
            <Boxes size={22} />
          </div>
          <div>
            <p className="kpi-label">Unidades em Estoque</p>
            <p className="kpi-value">{totalStock}</p>
          </div>
        </div>

        <div className="surface kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="kpi-label">Estoque Baixo</p>
            <p className="kpi-value">{lowStockItems.length}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Low Stock Items */}
        <div className="surface">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text-main)' }}>
            Atenção: Estoque Baixo
          </h3>
          {lowStockItems.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Todos os itens estão com estoque saudável.
            </p>
          ) : (
            <div className="table-container">
              <table className="table">
                <tbody>
                  {lowStockItems.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td><span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{item.nome}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="badge badge-danger">{item.saldo} unid.</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Movements */}
        <div className="surface">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text-main)' }}>
            Últimas Movimentações
          </h3>
          {recentMovements.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Nenhuma movimentação registrada ainda.
            </p>
          ) : (
            <div className="table-container">
              <table className="table">
                <tbody>
                  {recentMovements.map((mov) => (
                    <tr key={mov.id}>
                      <td style={{ width: '36px', paddingRight: 0 }}>
                        {mov.tipoMovimentacao === 'Entrada' ? (
                          <TrendingUp size={18} color="var(--color-success)" />
                        ) : mov.tipoMovimentacao === 'Saída' ? (
                          <TrendingDown size={18} color="var(--color-danger)" />
                        ) : (
                          <ArrowRightLeft size={18} color="var(--color-warning)" />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{getVariantName(mov.varianteId)}</div>
                        <div className="text-xs text-secondary">
                          {format(new Date(mov.dataHora), 'dd/MM HH:mm', { locale: ptBR })}
                        </div>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
