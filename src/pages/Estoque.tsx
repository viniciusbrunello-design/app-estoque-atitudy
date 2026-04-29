import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEstoque, type EstoqueItem } from '../hooks/useEstoque';
import { Search, Plus, Minus, X, Boxes, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import type { TipoMovimentacao, CategoriaProduto } from '../types';
import './Estoque.css';

type ModalData = { varianteId: string; nome: string } | null;

export default function Estoque() {
  const { items, registrarMovimentacao } = useEstoque();
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'Todos' | CategoriaProduto>('Todos');
  const [modalData, setModalData] = useState<ModalData>(null);
  const [modalTipo, setModalTipo] = useState<'Entrada' | 'Saída'>('Entrada');
  const [quantidade, setQuantidade] = useState<number | ''>('');
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState('');

  const filteredItems = items.filter((item) => {
    if (filtroTipo !== 'Todos' && item.product.tipo !== filtroTipo) return false;
    return item.nome.toLowerCase().includes(search.toLowerCase());
  });

  const grouped = useMemo(() => {
    const byProduct = new Map<string, { product: EstoqueItem['product']; items: EstoqueItem[] }>();
    for (const item of filteredItems) {
      const pid = item.product.id;
      if (!byProduct.has(pid)) {
        byProduct.set(pid, { product: item.product, items: [] });
      }
      byProduct.get(pid)!.items.push(item);
    }
    return [...byProduct.values()];
  }, [filteredItems]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    if (modalData) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalData]);

  const openModal = (varianteId: string, nome: string, tipo: 'Entrada' | 'Saída' = 'Entrada') => {
    setModalData({ varianteId, nome });
    setModalTipo(tipo);
    setQuantidade('');
    setObservacao('');
    setError('');
  };

  const closeModal = () => {
    setModalData(null);
    setQuantidade('');
    setObservacao('');
    setError('');
  };

  const handleMovimentacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalData || !quantidade) return;

    const success = await registrarMovimentacao(
      modalData.varianteId,
      modalTipo as TipoMovimentacao,
      Number(quantidade),
      observacao
    );

    if (success) {
      toast.success(`${modalTipo} registrada com sucesso!`);
      closeModal();
    } else {
      setError(modalTipo === 'Saída' ? 'Quantidade maior que o saldo atual.' : 'Quantidade inválida.');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Estoque</h2>
          <p className="page-subtitle">Controle de unidades por variação</p>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-bar">
          <Search size={18} color="var(--color-text-tertiary)" />
          <input
            type="text"
            placeholder="Buscar por modelo, cor ou tamanho..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-select">
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}>
            <option value="Todos">Todas as Categorias</option>
            <option value="Calçados">Calçados</option>
            <option value="Bolsas">Bolsas</option>
            <option value="Bijuterias">Bijuterias</option>
          </select>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="surface">
          <div className="empty-state">
            <div className="empty-state-icon"><Boxes size={28} /></div>
            <p className="empty-state-title">Nenhum item encontrado</p>
            <p className="empty-state-desc">
              {search ? 'Tente uma busca diferente.' : 'Cadastre produtos e variantes para gerenciar o estoque.'}
            </p>
          </div>
        </div>
      ) : (
        grouped.map(({ product, items: variants }) => {
          const totalProduto = variants.reduce((s, v) => s + v.saldo, 0);
          const hasLow = variants.some((v) => v.isLow && v.saldo > 0);
          const hasZero = variants.some((v) => v.saldo === 0);

          // Group by color
          const byCor = new Map<string, EstoqueItem[]>();
          for (const v of variants) {
            const key = v.cor || '—';
            if (!byCor.has(key)) byCor.set(key, []);
            byCor.get(key)!.push(v);
          }

          return (
            <div key={product.id} className="surface produto-card">
              <div className="produto-card-header">
                <div className="produto-card-info">
                  <span className="badge badge-primary">{product.tipo}</span>
                  <h3 className="produto-card-title">{product.modelo}</h3>
                  {(hasLow || hasZero) && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-warning-text)', fontWeight: 500 }}>
                      {hasZero ? '⚠ Alguns tamanhos zerados' : '⚠ Estoque baixo'}
                    </span>
                  )}
                </div>
                <div className="produto-card-total">
                  <span className="produto-card-total-num">{totalProduto}</span>
                  <span className="produto-card-total-label">unidades</span>
                </div>
              </div>

              {product.tipo === 'Calçados' ? (
                <div className="produto-cor-list">
                  {[...byCor.entries()].map(([cor, variantList]) => (
                    <div key={cor} className="produto-cor-row">
                      {cor !== '—' && <span className="produto-cor-label">{cor}</span>}
                      <div className="tamanho-chips">
                        {variantList
                          .sort((a, b) =>
                            (a.tamanho || '').localeCompare(b.tamanho || '', undefined, { numeric: true })
                          )
                          .map((v) => (
                            <button
                              key={v.id}
                              className={`tamanho-chip ${v.saldo === 0 ? 'chip-zero' : v.isLow ? 'chip-low' : 'chip-ok'}`}
                              onClick={() => openModal(v.id, v.nome)}
                              title={`${v.nome}: ${v.saldo} unid. — clique para registrar movimentação`}
                            >
                              <span className="chip-size">{v.tamanho || '—'}</span>
                              <span className="chip-qty">{v.saldo}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="produto-cor-list">
                  {[...byCor.entries()].map(([cor, variantList]) => {
                    const v = variantList[0];
                    return (
                      <div key={cor} className="produto-simple-row">
                        <span className="produto-cor-name">{cor !== '—' ? cor : 'Padrão'}</span>
                        <div className="produto-simple-actions">
                          <span className={`produto-saldo ${v.saldo === 0 ? 'saldo-zero' : v.isLow ? 'saldo-low' : 'saldo-ok'}`}>
                            {v.saldo} unid.
                          </span>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ color: 'var(--color-success-text)', borderColor: 'var(--color-success-text)' }}
                            title="Registrar entrada"
                            onClick={() => openModal(v.id, v.nome, 'Entrada')}
                          >
                            <Plus size={13} />
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ color: 'var(--color-danger-text)', borderColor: 'var(--color-danger-text)' }}
                            title="Registrar saída"
                            onClick={() => openModal(v.id, v.nome, 'Saída')}
                          >
                            <Minus size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Modal: Registrar Movimentação ── */}
      {modalData && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-content modal-sm">
            <div className="modal-header">
              <div>
                <p className="modal-title">Registrar Movimentação</p>
                <p className="modal-subtitle">{modalData.nome}</p>
              </div>
              <button className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleMovimentacao}>
              <div className="modal-body">
                <div className="tipo-toggle">
                  <button
                    type="button"
                    className={`tipo-toggle-btn ${modalTipo === 'Entrada' ? 'active-entrada' : ''}`}
                    onClick={() => { setModalTipo('Entrada'); setError(''); }}
                  >
                    <TrendingUp size={15} /> Entrada
                  </button>
                  <button
                    type="button"
                    className={`tipo-toggle-btn ${modalTipo === 'Saída' ? 'active-saida' : ''}`}
                    onClick={() => { setModalTipo('Saída'); setError(''); }}
                  >
                    <TrendingDown size={15} /> Saída
                  </button>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <div className="form-group">
                  <label className="form-label">Quantidade *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    className="form-control"
                    value={quantidade}
                    onChange={(e) => { setError(''); setQuantidade(e.target.value ? Number(e.target.value) : ''); }}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Observação (Opcional)</label>
                  <textarea
                    className="form-control"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={3}
                    placeholder="Ex: Compra fornecedor X, Venda cliente Y..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button
                  type="submit"
                  className={`btn ${modalTipo === 'Entrada' ? 'btn-primary' : 'btn-danger'}`}
                >
                  {modalTipo === 'Entrada' ? <Plus size={15} /> : <Minus size={15} />}
                  Confirmar {modalTipo}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
