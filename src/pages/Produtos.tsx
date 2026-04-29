import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useProdutos } from '../hooks/useProdutos';
import { Plus, Search, Pencil, Archive, X, Package } from 'lucide-react';
import type { CategoriaProduto, Produto } from '../types';

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; produto: Produto }
  | { type: 'confirmArchive'; produto: Produto };

const INITIAL_FORM = {
  tipo: 'Calçados' as CategoriaProduto,
  modelo: '',
  precoCompra: '' as number | '',
  precoVenda: '' as number | '',
  estoqueMinimo: 2,
  coresStr: '',
  tamanhosStr: '',
};

function calcMargem(precoVenda: number, precoCompra: number): number {
  if (precoVenda <= 0) return 0;
  return ((precoVenda - precoCompra) / precoVenda) * 100;
}

function MargemBadge({ precoVenda, precoCompra }: { precoVenda: number; precoCompra: number }) {
  const m = calcMargem(precoVenda, precoCompra);
  const cls = m >= 40 ? 'badge-success' : m >= 20 ? 'badge-warning' : 'badge-danger';
  return <span className={`badge ${cls}`}>{m.toFixed(0)}%</span>;
}

export default function Produtos() {
  const { produtos, variantes, addProduto, updateProduto, archiveProduto, addVariantesProduto, isAdding, isUpdating, isAddingVariantes } = useProdutos();
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');

  // Estado para adicionar variantes no modal de edição
  const [novasCoresStr, setNovasCoresStr] = useState('');
  const [novosTamanhosStr, setNovosTamanhosStr] = useState('');
  const [variantError, setVariantError] = useState('');

  const isOpen = modal.type !== 'none';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const openAdd = () => {
    setForm(INITIAL_FORM);
    setFormError('');
    setModal({ type: 'add' });
  };

  const openEdit = (produto: Produto) => {
    const variantesProduto = variantes.filter((v) => v.produtoId === produto.id);
    const estoqueMinimo = variantesProduto[0]?.estoqueMinimo ?? 2;
    setForm({
      tipo: produto.tipo,
      modelo: produto.modelo,
      precoCompra: produto.precoCompra,
      precoVenda: produto.precoVenda,
      estoqueMinimo,
      coresStr: '',
      tamanhosStr: '',
    });
    setNovasCoresStr('');
    setNovosTamanhosStr('');
    setFormError('');
    setVariantError('');
    setModal({ type: 'edit', produto });
  };

  const closeModal = () => {
    setModal({ type: 'none' });
    setNovasCoresStr('');
    setNovosTamanhosStr('');
    setVariantError('');
  };

  const activeProducts = produtos.filter((p) =>
    p.modelo.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.modelo || form.precoCompra === '' || form.precoVenda === '') return;

    if (Number(form.precoVenda) < Number(form.precoCompra)) {
      setFormError('O preço de venda não pode ser menor que o preço de compra.');
      return;
    }

    const cores = form.coresStr.split(',').map((c) => c.trim()).filter(Boolean);
    const tamanhos = form.tamanhosStr.split(',').map((t) => t.trim()).filter(Boolean);
    if (cores.length === 0) cores.push('');
    if (tamanhos.length === 0) tamanhos.push('');

    const variantesData = cores.flatMap((cor) => tamanhos.map((tamanho) => ({ cor, tamanho })));

    await addProduto(
      { tipo: form.tipo, modelo: form.modelo, precoCompra: Number(form.precoCompra), precoVenda: Number(form.precoVenda), ativo: true },
      variantesData,
      form.estoqueMinimo
    );
    closeModal();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal.type !== 'edit') return;
    if (!form.modelo || form.precoCompra === '' || form.precoVenda === '') return;

    if (Number(form.precoVenda) < Number(form.precoCompra)) {
      setFormError('O preço de venda não pode ser menor que o preço de compra.');
      return;
    }

    await updateProduto(modal.produto.id, {
      modelo: form.modelo,
      precoCompra: Number(form.precoCompra),
      precoVenda: Number(form.precoVenda),
      estoqueMinimo: form.estoqueMinimo,
    });
    closeModal();
  };

  const handleAddVariantes = async () => {
    if (modal.type !== 'edit') return;
    const novasCores = novasCoresStr.split(',').map((c) => c.trim()).filter(Boolean);
    const novosTamanhos = novosTamanhosStr.split(',').map((t) => t.trim()).filter(Boolean);

    if (novasCores.length === 0 && novosTamanhos.length === 0) {
      setVariantError('Informe ao menos uma cor ou tamanho novo.');
      return;
    }

    const variantesProduto = variantes.filter((v) => v.produtoId === modal.produto.id);
    const coresExistentes = [...new Set(variantesProduto.map((v) => v.cor).filter(Boolean))];
    const tamanhosExistentes = [...new Set(variantesProduto.map((v) => v.tamanho).filter(Boolean))];

    let variantesData: { cor: string; tamanho: string }[] = [];

    if (modal.produto.tipo === 'Calçados') {
      const coresBase = novasCores.length > 0 ? novasCores : coresExistentes;
      const tamanhosBase = novosTamanhos.length > 0 ? novosTamanhos : tamanhosExistentes;
      variantesData = (coresBase.length > 0 ? coresBase : ['']).flatMap((cor) =>
        (tamanhosBase.length > 0 ? tamanhosBase : ['']).map((tamanho) => ({ cor, tamanho }))
      );
    } else {
      variantesData = (novasCores.length > 0 ? novasCores : ['']).map((cor) => ({ cor, tamanho: '' }));
    }

    setVariantError('');
    try {
      await addVariantesProduto(modal.produto.id, variantesData, form.estoqueMinimo);
      setNovasCoresStr('');
      setNovosTamanhosStr('');
    } catch {
      setVariantError('Erro ao adicionar. Verifique se as variantes já existem.');
    }
  };

  const handleArchive = async () => {
    if (modal.type !== 'confirmArchive') return;
    await archiveProduto(modal.produto.id);
    closeModal();
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Produtos</h2>
          <p className="page-subtitle">Catálogo completo da Atitudy</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      <div className="search-bar">
        <Search size={18} color="var(--color-text-tertiary)" />
        <input
          type="text"
          placeholder="Buscar produto por modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {activeProducts.length === 0 ? (
        <div className="surface">
          <div className="empty-state">
            <div className="empty-state-icon"><Package size={28} /></div>
            <p className="empty-state-title">Nenhum produto encontrado</p>
            <p className="empty-state-desc">
              {search ? 'Tente uma busca diferente.' : 'Cadastre o primeiro produto da Atitudy para começar.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="surface table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Modelo</th>
                <th>Variantes</th>
                <th>Margem</th>
                <th>Preço Venda</th>
                <th>Preço Compra</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {activeProducts.map((produto) => {
                const qtdVariantes = variantes.filter((v) => v.produtoId === produto.id).length;
                return (
                  <tr key={produto.id}>
                    <td><span className="badge badge-primary">{produto.tipo}</span></td>
                    <td><strong style={{ fontWeight: 500 }}>{produto.modelo}</strong></td>
                    <td><span className="text-secondary text-sm">{qtdVariantes} variação{qtdVariantes !== 1 ? 'ões' : ''}</span></td>
                    <td><MargemBadge precoVenda={produto.precoVenda} precoCompra={produto.precoCompra} /></td>
                    <td><strong style={{ fontWeight: 500 }}>R$ {produto.precoVenda.toFixed(2)}</strong></td>
                    <td className="text-secondary">R$ {produto.precoCompra.toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-secondary" title="Editar produto" onClick={() => openEdit(produto)}>
                          <Pencil size={14} /> Editar
                        </button>
                        <button className="btn btn-sm btn-ghost" title="Arquivar produto" onClick={() => setModal({ type: 'confirmArchive', produto })}>
                          <Archive size={14} />
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

      {/* ── Modal: Novo Produto ── */}
      {modal.type === 'add' && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <p className="modal-title">Cadastrar Produto</p>
                <p className="modal-subtitle">Preencha os dados e defina as variações</p>
              </div>
              <button className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}

                <div className="form-group">
                  <label className="form-label">Tipo *</label>
                  <select className="form-control" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as CategoriaProduto })}>
                    <option value="Calçados">Calçados</option>
                    <option value="Bolsas">Bolsas</option>
                    <option value="Bijuterias">Bijuterias</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Modelo *</label>
                  <input required type="text" className="form-control" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Ex: Tênis Street, Bolsa Couro..." />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Preço de Compra (R$) *</label>
                    <input required type="number" step="0.01" min="0" className="form-control" value={form.precoCompra} onChange={(e) => { setFormError(''); setForm({ ...form, precoCompra: e.target.value ? Number(e.target.value) : '' }); }} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preço de Venda (R$) *</label>
                    <input required type="number" step="0.01" min="0" className="form-control" value={form.precoVenda} onChange={(e) => { setFormError(''); setForm({ ...form, precoVenda: e.target.value ? Number(e.target.value) : '' }); }} placeholder="0,00" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Estoque Mínimo</label>
                  <input type="number" min="0" className="form-control" value={form.estoqueMinimo} onChange={(e) => setForm({ ...form, estoqueMinimo: Number(e.target.value) })} />
                  <span className="form-hint">Alerta de estoque baixo no dashboard quando atingir esta quantidade.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Cores (Opcional)</label>
                  <input type="text" className="form-control" value={form.coresStr} onChange={(e) => setForm({ ...form, coresStr: e.target.value })} placeholder="Ex: Preto, Branco, Nude" />
                  <span className="form-hint">Separe por vírgula. Deixe em branco para produto sem variação de cor.</span>
                </div>

                {form.tipo === 'Calçados' && (
                  <div className="form-group">
                    <label className="form-label">Tamanhos (Opcional)</label>
                    <input type="text" className="form-control" value={form.tamanhosStr} onChange={(e) => setForm({ ...form, tamanhosStr: e.target.value })} placeholder="Ex: 35, 36, 37, 38" />
                    <span className="form-hint">Separe por vírgula.</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isAdding}>
                  {isAdding ? 'Salvando...' : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal: Editar Produto ── */}
      {modal.type === 'edit' && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <p className="modal-title">Editar Produto</p>
                <p className="modal-subtitle">{modal.produto.tipo} — {modal.produto.modelo}</p>
              </div>
              <button className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}

                <div className="form-group">
                  <label className="form-label">Modelo *</label>
                  <input required type="text" className="form-control" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Preço de Compra (R$) *</label>
                    <input required type="number" step="0.01" min="0" className="form-control" value={form.precoCompra} onChange={(e) => { setFormError(''); setForm({ ...form, precoCompra: e.target.value ? Number(e.target.value) : '' }); }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preço de Venda (R$) *</label>
                    <input required type="number" step="0.01" min="0" className="form-control" value={form.precoVenda} onChange={(e) => { setFormError(''); setForm({ ...form, precoVenda: e.target.value ? Number(e.target.value) : '' }); }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Estoque Mínimo</label>
                  <input type="number" min="0" className="form-control" value={form.estoqueMinimo} onChange={(e) => setForm({ ...form, estoqueMinimo: Number(e.target.value) })} />
                  <span className="form-hint">Alerta de estoque baixo no dashboard quando atingir esta quantidade.</span>
                </div>

                {/* Variantes existentes */}
                {(() => {
                  const variantesProduto = variantes.filter((v) => v.produtoId === modal.produto.id);
                  const coresExistentes = [...new Set(variantesProduto.map((v) => v.cor).filter(Boolean))];
                  const tamanhosExistentes = [...new Set(variantesProduto.map((v) => v.tamanho).filter(Boolean))];
                  return (
                    <div className="variantes-section">
                      <p className="variantes-section-title">Variantes Existentes <span className="text-secondary text-sm">({variantesProduto.length})</span></p>
                      {variantesProduto.length === 0 ? (
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Nenhuma variante cadastrada.</p>
                      ) : (
                        <div className="variantes-tags">
                          {coresExistentes.length > 0 && (
                            <div className="variantes-row">
                              <span className="variantes-label">Cores:</span>
                              {coresExistentes.map((c) => <span key={c} className="badge badge-primary">{c}</span>)}
                            </div>
                          )}
                          {tamanhosExistentes.length > 0 && (
                            <div className="variantes-row">
                              <span className="variantes-label">Tamanhos:</span>
                              {tamanhosExistentes.sort().map((t) => <span key={t} className="badge badge-gray">{t}</span>)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Adicionar novas variantes */}
                <div className="variantes-section">
                  <p className="variantes-section-title">Adicionar Novas Variantes</p>

                  <div className="form-group">
                    <label className="form-label">Novas Cores</label>
                    <input
                      type="text"
                      className="form-control"
                      value={novasCoresStr}
                      onChange={(e) => { setVariantError(''); setNovasCoresStr(e.target.value); }}
                      placeholder="Ex: Caramelo, Vinho"
                    />
                    {modal.produto.tipo === 'Calçados' && (
                      <span className="form-hint">Será combinado com todos os tamanhos existentes.</span>
                    )}
                  </div>

                  {modal.produto.tipo === 'Calçados' && (
                    <div className="form-group">
                      <label className="form-label">Novos Tamanhos</label>
                      <input
                        type="text"
                        className="form-control"
                        value={novosTamanhosStr}
                        onChange={(e) => { setVariantError(''); setNovosTamanhosStr(e.target.value); }}
                        placeholder="Ex: 40, 41"
                      />
                      <span className="form-hint">Será combinado com todas as cores existentes.</span>
                    </div>
                  )}

                  {variantError && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{variantError}</div>}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddVariantes}
                    disabled={isAddingVariantes}
                  >
                    <Plus size={14} />
                    {isAddingVariantes ? 'Adicionando...' : 'Adicionar Variantes'}
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isUpdating}>
                  {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal: Confirmar Arquivamento ── */}
      {modal.type === 'confirmArchive' && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-content modal-sm">
            <div className="modal-header">
              <p className="modal-title">Arquivar Produto</p>
              <button className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Tem certeza que deseja arquivar <strong style={{ color: 'var(--color-text-main)' }}>{modal.produto.modelo}</strong>?
                O produto não aparecerá mais no catálogo e no estoque, mas o histórico será preservado.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleArchive}>
                <Archive size={15} /> Arquivar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
