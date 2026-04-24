import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEstoque } from '../hooks/useEstoque';
import { Search, Plus, Minus, X, Boxes } from 'lucide-react';
import type { TipoMovimentacao } from '../types';

type ModalData = { varianteId: string; nome: string; tipo: 'Entrada' | 'Saída' } | null;

export default function Estoque() {
  const { items, registrarMovimentacao } = useEstoque();
  const [search, setSearch] = useState('');
  const [modalData, setModalData] = useState<ModalData>(null);
  const [quantidade, setQuantidade] = useState<number | ''>('');
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState('');

  const filteredItems = items.filter((item) =>
    item.nome.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    if (modalData) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalData]);

  const openModal = (varianteId: string, nome: string, tipo: 'Entrada' | 'Saída') => {
    setModalData({ varianteId, nome, tipo });
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
      modalData.tipo as TipoMovimentacao,
      Number(quantidade),
      observacao
    );

    if (success) {
      closeModal();
    } else {
      setError(modalData.tipo === 'Saída' ? 'Quantidade de saída maior que o saldo atual.' : 'Quantidade inválida.');
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

      <div className="search-bar">
        <Search size={18} color="var(--color-text-tertiary)" />
        <input
          type="text"
          placeholder="Buscar por modelo, cor ou tamanho..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredItems.length === 0 ? (
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
        <div className="surface table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Produto (Variação)</th>
                <th style={{ textAlign: 'center' }}>Qtd Atual</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isZero = item.saldo === 0;
                let statusBadge = <span className="badge badge-success">Normal</span>;
                if (isZero) statusBadge = <span className="badge badge-gray">Zerado</span>;
                else if (item.isLow) statusBadge = <span className="badge badge-danger">Baixo</span>;

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.nome}</div>
                      <div className="text-xs text-secondary">
                        Entradas: {item.entradas} | Saídas: {item.saidas}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.125rem', color: item.isLow || isZero ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                      {item.saldo}
                    </td>
                    <td style={{ textAlign: 'center' }}>{statusBadge}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ color: 'var(--color-success-text)', borderColor: 'var(--color-success-text)' }}
                          title="Registrar entrada"
                          onClick={() => openModal(item.id, item.nome, 'Entrada')}
                        >
                          <Plus size={14} /> Entrada
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ color: 'var(--color-danger-text)', borderColor: 'var(--color-danger-text)' }}
                          title="Registrar saída"
                          onClick={() => openModal(item.id, item.nome, 'Saída')}
                        >
                          <Minus size={14} /> Saída
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Registrar Movimentação ── */}
      {modalData && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-content modal-sm">
            <div className="modal-header">
              <div>
                <p className="modal-title">Registrar {modalData.tipo}</p>
                <p className="modal-subtitle">{modalData.nome}</p>
              </div>
              <button className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleMovimentacao}>
              <div className="modal-body">
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
                  className={`btn ${modalData.tipo === 'Entrada' ? 'btn-primary' : 'btn-danger'}`}
                >
                  {modalData.tipo === 'Entrada' ? <Plus size={15} /> : <Minus size={15} />}
                  Confirmar {modalData.tipo}
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
