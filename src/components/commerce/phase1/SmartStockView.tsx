import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { SmartStockItem } from '../../../types';
import { Boxes, Info, RefreshCw, Search, ShoppingBag } from 'lucide-react';

interface SmartStockViewProps {
  modulo: 'adega' | 'tabacaria';
  onNavigateTab: (tab: string) => void;
}

export const SmartStockView: React.FC<SmartStockViewProps> = ({ modulo, onNavigateTab }) => {
  const [items, setItems] = useState<SmartStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCommerceSmartStock({
        modulo,
        status: statusFilter,
        search,
      });
      setItems(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar Estoque Inteligente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modulo, statusFilter]);

  const statusBadge = (status: SmartStockItem['statusEstoque']) => {
    switch (status) {
      case 'ruptura':
        return { label: 'Ruptura (Zerado)', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      case 'critico':
        return { label: 'Crítico', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'atencao':
        return { label: 'Atenção', cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' };
      case 'parado':
        return { label: 'Sem Giro (+30d)', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      case 'excesso':
        return { label: 'Acima do Máximo', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
      default:
        return { label: 'Saudável', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121024] border border-[#262042] rounded-2xl p-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#8B5CF6]" />
            Estoque Inteligente — {modulo === 'adega' ? 'Adega & Bebidas' : 'Tabacaria'}
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Cobertura em dias e consumo médio diário calculados estritamente sobre vendas reais dos últimos 30 dias.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8B5CF6] ${loading ? 'animate-spin' : ''}`} />
            <span>Recalcular</span>
          </button>
          <button
            onClick={() => onNavigateTab('replenishment')}
            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Ir para Reposição</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#AAA6B5]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
            placeholder="Buscar produto por nome, SKU ou categoria..."
            className="w-full bg-[#0A0714] border border-[#262042] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
          >
            <option value="todos">Todos os Status</option>
            <option value="ruptura">Ruptura (Zerado)</option>
            <option value="critico">Crítico (Mínimo)</option>
            <option value="atencao">Em Atenção</option>
            <option value="parado">Parados (+30d)</option>
            <option value="excesso">Acima do Máximo</option>
            <option value="saudavel">Saudável</option>
          </select>
          <button
            onClick={loadData}
            className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] text-xs font-semibold text-white rounded-xl"
          >
            Filtrar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-[#AAA6B5]">Carregando inteligência de estoque...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#AAA6B5]">
            Nenhum produto encontrado para o filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262042] bg-[#0A0714]/70 text-[10px] font-bold text-[#AAA6B5] uppercase">
                  <th className="py-3 px-4">Produto / SKU</th>
                  <th className="py-3 px-3 text-right">Atual</th>
                  <th className="py-3 px-3 text-right">Mín / Máx</th>
                  <th className="py-3 px-3 text-right">Consumo Diário Real</th>
                  <th className="py-3 px-3 text-right">Cobertura Est.</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Sugestão Reposição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262042]/50">
                {items.map((item) => {
                  const b = statusBadge(item.statusEstoque);
                  return (
                    <tr key={item.product.id} className="hover:bg-[#1A1633]/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{item.product.nome}</div>
                        <div className="text-[10px] text-[#AAA6B5] font-mono">
                          {item.product.sku} • {item.product.categoria}
                        </div>
                        <div className="text-[10px] text-[#7D7693] flex items-center gap-1 mt-0.5">
                          <Info className="w-3 h-3 shrink-0" />
                          <span>{item.motivoHistorico}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-white tabular-nums">
                        {item.product.estoqueAtual} {item.product.unidade}
                      </td>
                      <td className="py-3 px-3 text-right text-[#AAA6B5] tabular-nums">
                        {item.product.estoqueMinimo} / {item.estoqueMaximoConfigurado}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {item.consumoMedioDiario !== null ? (
                          <span className="text-emerald-300 font-semibold">
                            {item.consumoMedioDiario} {item.product.unidade}/dia
                          </span>
                        ) : (
                          <span className="text-[#7D7693] italic">Dados insuficientes</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {item.diasCoberturaEstimada !== null ? (
                          <span
                            className={`font-bold ${
                              item.diasCoberturaEstimada <= 5 ? 'text-amber-300' : 'text-white'
                            }`}
                          >
                            {item.diasCoberturaEstimada} dias
                          </span>
                        ) : (
                          <span className="text-[#7D7693]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${b.cls}`}>
                          {b.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {item.sugestaoReposicaoQtd > 0 ? (
                          <span className="font-bold text-[#C4B5FD]">
                            +{item.sugestaoReposicaoQtd} {item.product.unidade}
                          </span>
                        ) : (
                          <span className="text-[#7D7693]">Não necessária</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
