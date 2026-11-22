import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialLoss, CommercialLossReason, CommercialProduct } from '../../../types';
import {
  AlertTriangle,
  CheckCircle2,
  PackageMinus,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';

interface LossesControlViewProps {
  modulo: 'adega' | 'tabacaria';
}

const LOSS_LABELS: Record<CommercialLossReason, string> = {
  avaria: 'Avaria / Quebra',
  vencimento: 'Vencimento / Validade',
  consumo_interno: 'Consumo Interno / Degustação',
  descarte: 'Descarte Operacional',
  extravio: 'Extravio / Divergência',
};

export const LossesControlView: React.FC<LossesControlViewProps> = ({ modulo }) => {
  const [losses, setLosses] = useState<CommercialLoss[]>([]);
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [totalQtd, setTotalQtd] = useState(0);
  const [totalImpacto, setTotalImpacto] = useState(0);
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    tipo: 'avaria' as CommercialLossReason,
    quantidade: '1',
    motivo: '',
    dataPerda: new Date().toISOString().slice(0, 10),
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [lossRes, prodRes] = await Promise.all([
        api.getCommerceLosses({
          modulo,
          tipo: tipoFilter,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        }),
        api.getCommerceProducts(modulo),
      ]);
      setLosses(lossRes.losses || []);
      setTotalQtd(lossRes.totalQtd || 0);
      setTotalImpacto(lossRes.totalImpactoFinanceiro || 0);
      const activeProds = (prodRes.products || []).filter((p) => p.ativo && p.estoqueAtual > 0);
      setProducts(activeProds);
      if (activeProds.length > 0 && !form.productId) {
        setForm((prev) => ({ ...prev, productId: activeProds[0].id }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar histórico de perdas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modulo, tipoFilter]);

  const handleCreateLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId || !form.motivo.trim()) {
      setErrorMsg('Selecione o produto e informe o motivo da perda.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.createCommerceLoss({
        productId: form.productId,
        tipo: form.tipo,
        quantidade: parseInt(form.quantidade, 10) || 1,
        motivo: form.motivo.trim(),
        dataPerda: form.dataPerda,
      });
      setSuccessMsg(res.message);
      setIsModalOpen(false);
      setForm({
        productId: products[0]?.id || '',
        tipo: 'avaria',
        quantidade: '1',
        motivo: '',
        dataPerda: new Date().toISOString().slice(0, 10),
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar perda.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === form.productId);

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <PackageMinus className="w-5 h-5 text-rose-400" />
            Controle de Perdas & Avarias — {modulo === 'adega' ? 'Adega' : 'Tabacaria'}
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Baixa rastreável de avarias, vencimentos e descartes com atualização imediata de estoque e apuração de custo.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Perda</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
          <span className="text-xs text-[#AAA6B5]">Ocorrências Registradas</span>
          <div className="text-2xl font-black text-white mt-1 tabular-nums">{losses.length}</div>
        </div>
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
          <span className="text-xs text-[#AAA6B5]">Unidades Perdidas</span>
          <div className="text-2xl font-black text-amber-300 mt-1 tabular-nums">{totalQtd}</div>
        </div>
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
          <span className="text-xs text-[#AAA6B5]">Impacto Financeiro (Custo)</span>
          <div className="text-2xl font-black text-rose-400 mt-1 tabular-nums">
            R$ {Number(totalImpacto).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
        >
          <option value="todos">Todos os Tipos</option>
          {Object.entries(LOSS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
        />

        <button
          onClick={loadData}
          className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] rounded-xl text-xs text-white flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span>Filtrar</span>
        </button>
      </div>

      {/* Losses Table */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#AAA6B5]">Carregando registros...</div>
        ) : losses.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#AAA6B5]">
            Nenhuma perda registrada neste módulo para o filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262042] bg-[#0A0714]/60 text-[10px] uppercase text-[#AAA6B5]">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Motivo</th>
                  <th className="py-3 px-4 text-right">Qtd</th>
                  <th className="py-3 px-4 text-right">Impacto (Custo)</th>
                  <th className="py-3 px-4">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262042]/50">
                {losses.map((l) => (
                  <tr key={l.id} className="hover:bg-[#1A1633]/30">
                    <td className="py-3 px-4 text-[#AAA6B5] whitespace-nowrap">{l.dataPerda}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{l.productNome}</div>
                      <div className="text-[10px] font-mono text-[#716A86]">{l.sku}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                        {LOSS_LABELS[l.tipo] || l.tipo}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#AAA6B5]">{l.motivo}</td>
                    <td className="py-3 px-4 text-right font-bold text-white tabular-nums">
                      {l.quantidade}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-400 tabular-nums">
                      R$ {Number(l.custoTotalImpacto).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-[#AAA6B5]">{l.responsavelNome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121024] border border-[#262042] rounded-3xl p-6 max-w-md w-full relative text-white shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-[#AAA6B5] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <PackageMinus className="w-5 h-5 text-rose-400" />
              Registrar Perda / Avaria
            </h3>

            <form onSubmit={handleCreateLoss} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Produto *</label>
                <select
                  required
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                >
                  {products.length === 0 && <option value="">Nenhum item com saldo em estoque</option>}
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Disponível: {p.estoqueAtual} {p.unidade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Motivo/Tipo *</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as CommercialLossReason })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {Object.entries(LOSS_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Quantidade *</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct?.estoqueAtual || 99999}
                    required
                    value={form.quantidade}
                    onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Data</label>
                <input
                  type="date"
                  value={form.dataPerda}
                  onChange={(e) => setForm({ ...form, dataPerda: e.target.value })}
                  className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                  Descrição / Justificativa *
                </label>
                <textarea
                  rows={2}
                  required
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  placeholder="Ex: Garrafa quebrada na reposição da câmara fria"
                  className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {selectedProduct && (
                <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042] text-xs flex justify-between">
                  <span className="text-[#AAA6B5]">Impacto estimado de custo:</span>
                  <span className="font-bold text-rose-400 tabular-nums">
                    R$ {((parseInt(form.quantidade, 10) || 0) * selectedProduct.precoCusto).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#262042]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#1A1633] text-xs text-[#AAA6B5] rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !form.productId}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
                >
                  {submitting ? 'Registrando...' : 'Confirmar Baixa por Perda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
