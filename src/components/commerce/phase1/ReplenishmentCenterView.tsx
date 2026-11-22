import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialReplenishment, CommercialSupplier } from '../../../types';
import { CheckCircle2, RefreshCw, ShoppingBag, Trash2, Truck } from 'lucide-react';

interface ReplenishmentCenterViewProps {
  modulo: 'adega' | 'tabacaria';
  onNavigateTab: (tab: string) => void;
}

export const ReplenishmentCenterView: React.FC<ReplenishmentCenterViewProps> = ({
  modulo,
  onNavigateTab,
}) => {
  const [list, setList] = useState<CommercialReplenishment[]>([]);
  const [suppliers, setSuppliers] = useState<CommercialSupplier[]>([]);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customQty, setCustomQty] = useState<Record<string, string>>({});
  const [customSup, setCustomSup] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [repRes, supRes] = await Promise.all([
        api.getCommerceReplenishments({ modulo, status: statusFilter }),
        api.getCommerceSuppliers(),
      ]);
      const items = repRes.replenishments || [];
      setList(items);
      setSuppliers(supRes.suppliers || []);
      const qMap: Record<string, string> = {};
      const sMap: Record<string, string> = {};
      items.forEach((r) => {
        qMap[r.id] = String(r.quantidadeAprovada || r.quantidadeSugerida);
        if (r.fornecedorId) sMap[r.id] = r.fornecedorId;
      });
      setCustomQty(qMap);
      setCustomSup(sMap);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar sugestões de reposição.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modulo, statusFilter]);

  const handleReview = async (
    rep: CommercialReplenishment,
    acao: 'aprovar' | 'descartar',
    gerarPedidoCompra: boolean
  ) => {
    try {
      setBusyId(rep.id);
      setError(null);
      setSuccess(null);
      const qty = parseInt(customQty[rep.id] || String(rep.quantidadeSugerida), 10);
      const res = await api.reviewCommerceReplenishment(rep.id, {
        acao,
        quantidadeAprovada: qty > 0 ? qty : rep.quantidadeSugerida,
        fornecedorId: customSup[rep.id] || rep.fornecedorId,
        gerarPedidoCompra,
      });
      setSuccess(res.message);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar revisão.');
    } finally {
      setBusyId(null);
    }
  };

  const statusLabel = (s: CommercialReplenishment['status']) => {
    switch (s) {
      case 'pendente':
        return { label: 'Pendente de Revisão', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'aprovada':
        return { label: 'Aprovada', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'pedido_gerado':
        return { label: 'Pedido de Compra Gerado', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      default:
        return { label: 'Descartada', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121024] border border-[#262042] rounded-2xl p-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#8B5CF6]" />
            Central de Reposição — {modulo === 'adega' ? 'Adega' : 'Tabacaria'}
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Sugestões automáticas com justificativa objetiva. Revise a quantidade, escolha o fornecedor e encaminhe para Compras.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovada">Aprovadas</option>
            <option value="pedido_gerado">Com Pedido Gerado</option>
            <option value="descartada">Descartadas</option>
          </select>
          <button
            onClick={loadData}
            className="px-3 py-2 bg-[#1A1633] hover:bg-[#262042] rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8B5CF6] ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
          <button
            onClick={() => onNavigateTab('purchases')}
            className="px-3.5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <Truck className="w-4 h-4" />
            <span>Ver Compras</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
          {success}
        </div>
      )}

      {loading ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-10 text-center text-xs text-[#AAA6B5]">
          Calculando necessidades de reposição...
        </div>
      ) : list.length === 0 ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-10 text-center space-y-2">
          <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-white">Nenhuma reposição pendente</p>
          <p className="text-xs text-[#AAA6B5]">
            Todos os produtos deste módulo estão acima do ponto crítico de reposição.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((rep) => {
            const st = statusLabel(rep.status);
            const editable = rep.status === 'pendente' || rep.status === 'aprovada';
            return (
              <div
                key={rep.id}
                className="bg-[#121024] border border-[#262042] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>
                      {st.label}
                    </span>
                    <span className="text-sm font-bold text-white">{rep.productNome}</span>
                    <span className="text-[11px] font-mono text-[#AAA6B5]">{rep.sku}</span>
                  </div>
                  <p className="text-xs text-[#AAA6B5]">{rep.justificativa}</p>
                  <div className="flex flex-wrap gap-4 text-[11px] text-[#C4B5FD] tabular-nums pt-1">
                    <span>Atual: {rep.estoqueAtual}</span>
                    <span>Mínimo: {rep.estoqueMinimo}</span>
                    <span>Máximo: {rep.estoqueMaximo}</span>
                    <span>Custo un.: R$ {rep.custoUnitarioEstimado.toFixed(2)}</span>
                    <span>
                      Consumo diário:{' '}
                      {rep.consumoMedioDiario !== null ? `${rep.consumoMedioDiario}/dia` : 'Dados insuficientes'}
                    </span>
                  </div>
                </div>

                {editable ? (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div>
                      <label className="block text-[10px] text-[#AAA6B5] mb-0.5">Qtd. Comprar</label>
                      <input
                        type="number"
                        min={1}
                        value={customQty[rep.id] || ''}
                        onChange={(e) => setCustomQty({ ...customQty, [rep.id]: e.target.value })}
                        className="w-24 bg-[#0A0714] border border-[#262042] rounded-xl px-2.5 py-1.5 text-xs text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#AAA6B5] mb-0.5">Fornecedor</label>
                      <select
                        value={customSup[rep.id] || ''}
                        onChange={(e) => setCustomSup({ ...customSup, [rep.id]: e.target.value })}
                        className="bg-[#0A0714] border border-[#262042] rounded-xl px-2.5 py-1.5 text-xs text-white max-w-[180px]"
                      >
                        <option value="">Fornecedor padrão...</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nomeFantasia || s.razaoSocial}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5 pt-4">
                      <button
                        disabled={busyId === rep.id}
                        onClick={() => handleReview(rep, 'aprovar', true)}
                        className="px-3 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl transition"
                      >
                        {busyId === rep.id ? 'Gerando...' : 'Aprovar e Gerar Compra'}
                      </button>
                      <button
                        disabled={busyId === rep.id}
                        onClick={() => handleReview(rep, 'descartar', false)}
                        title="Descartar sugestão"
                        className="p-2 bg-[#1A1633] hover:bg-rose-600/30 text-rose-400 rounded-xl transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-right text-xs text-[#AAA6B5] tabular-nums shrink-0">
                    {rep.revisadoPorNome && <div>Revisado por {rep.revisadoPorNome}</div>}
                    {rep.quantidadeAprovada && (
                      <div className="font-bold text-white">Qtd: {rep.quantidadeAprovada} un</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
