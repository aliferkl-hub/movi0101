import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import {
  AlertTriangle,
  Award,
  Calendar,
  DollarSign,
  Info,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';

interface ProfitabilityDashboardViewProps {
  modulo: 'adega' | 'tabacaria';
  onNavigateTab?: (tab: string) => void;
}

export const ProfitabilityDashboardView: React.FC<ProfitabilityDashboardViewProps> = ({
  modulo,
  onNavigateTab,
}) => {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCommerceProfitability({
        modulo,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
      });
      setMetrics(res.metrics);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar indicadores de rentabilidade.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [modulo]);

  return (
    <div className="space-y-6">
      {/* Header & Period Filter */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#8B5CF6]" />
            Rentabilidade & Margens — {modulo === 'adega' ? 'Adega & Bebidas' : 'Tabacaria & Headshop'}
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Cálculo auditável sobre vendas concluídas, CMV de cadastro, perdas registradas e histórico de fornecedores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#0A0714] border border-[#262042] rounded-xl px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none"
            />
            <span className="text-[#716A86]">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none"
            />
          </div>
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="px-3.5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Apurar Período</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !metrics ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
          Apurando receita real, CMV e margens do catálogo...
        </div>
      ) : metrics ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs text-[#AAA6B5] mb-1.5">
                <span>Receita Bruta ({metrics.vendasAnalisadasQtd} vendas)</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                R$ {Number(metrics.receitaTotal || 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-[#716A86] mt-1">Somente vendas concluídas no PDV</div>
            </div>

            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs text-[#AAA6B5] mb-1.5">
                <span>CMV (Custo das Mercadorias)</span>
                <TrendingDown className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                R$ {Number(metrics.cmvTotal || 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-[#716A86] mt-1">Baseado no custo unitário dos itens</div>
            </div>

            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs text-[#AAA6B5] mb-1.5">
                <span>Lucro Bruto Estimado</span>
                <TrendingUp className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-black text-teal-300 tabular-nums">
                R$ {Number(metrics.lucroBrutoEstimado || 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-teal-400 mt-1 tabular-nums">
                Margem bruta média: {Number(metrics.margemBrutaMediaPercentual || 0).toFixed(1)}%
              </div>
            </div>

            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs text-[#AAA6B5] mb-1.5">
                <span>Perdas Apuradas</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-300 tabular-nums">
                R$ {Number(metrics.perdasValor || 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-[#AAA6B5] mt-1 tabular-nums">
                {metrics.perdasQtd} unidade(s) baixada(s) no período
              </div>
            </div>
          </div>

          {/* Transparent Net Profit Card */}
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Lucro Líquido Observado
                </span>
              </div>
              <p className="text-xs text-[#AAA6B5] leading-relaxed">{metrics.notaLucroLiquido}</p>
            </div>
            <div className="shrink-0 text-right">
              {metrics.lucroLiquidoObservado !== null ? (
                <div
                  className={`text-2xl font-black tabular-nums ${
                    metrics.lucroLiquidoObservado >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  R$ {Number(metrics.lucroLiquidoObservado).toFixed(2)}
                </div>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                  Sem despesas lançadas (Lucro Líquido n/a)
                </span>
              )}
            </div>
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Profitable Products */}
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-400" />
                  Produtos Mais Rentáveis (Vendas Reais)
                </h3>
              </div>

              {metrics.produtosMaisRentaveis.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#0A0714] border border-[#262042] text-center text-xs text-[#AAA6B5]">
                  Dados insuficientes: nenhuma venda concluída para este módulo/período.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#262042] text-[10px] uppercase text-[#AAA6B5]">
                        <th className="py-2 pr-2">Produto</th>
                        <th className="py-2 px-2 text-right">Qtd</th>
                        <th className="py-2 px-2 text-right">Receita</th>
                        <th className="py-2 px-2 text-right">Lucro Bruto</th>
                        <th className="py-2 pl-2 text-right">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262042]/50">
                      {metrics.produtosMaisRentaveis.map((p: any) => (
                        <tr key={p.productId}>
                          <td className="py-2.5 pr-2">
                            <div className="font-semibold text-white">{p.nome}</div>
                            <div className="text-[10px] text-[#716A86] font-mono">{p.sku}</div>
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-[#AAA6B5]">
                            {p.quantidadeVendida}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-white">
                            R$ {Number(p.receita).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums font-bold text-emerald-400">
                            R$ {Number(p.lucroBruto).toFixed(2)}
                          </td>
                          <td className="py-2.5 pl-2 text-right tabular-nums text-teal-300">
                            {Number(p.margemVendaPercentual).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Low Margin Alert Table */}
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Alerta de Baixa Margem (&lt; 20% ou Negativa)
                </h3>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('products')}
                    className="text-xs text-[#C4B5FD] hover:text-white"
                  >
                    Ajustar Preços
                  </button>
                )}
              </div>

              {metrics.produtosBaixaMargem.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#0A0714] border border-[#262042] text-center text-xs text-emerald-300">
                  Todos os produtos ativos apresentam margem sobre venda igual ou superior a 20%.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#262042] text-[10px] uppercase text-[#AAA6B5]">
                        <th className="py-2 pr-2">Produto</th>
                        <th className="py-2 px-2 text-right">Custo</th>
                        <th className="py-2 px-2 text-right">Venda</th>
                        <th className="py-2 pl-2 text-right">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262042]/50">
                      {metrics.produtosBaixaMargem.map((m: any) => (
                        <tr key={m.productId}>
                          <td className="py-2 pr-2">
                            <div className="font-semibold text-white">{m.nome}</div>
                            <div className="text-[10px] text-[#716A86]">{m.categoria}</div>
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-[#AAA6B5]">
                            R$ {Number(m.precoCusto).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-white">
                            R$ {Number(m.precoVenda).toFixed(2)}
                          </td>
                          <td
                            className={`py-2 pl-2 text-right tabular-nums font-bold ${
                              m.margemVendaPercentual <= 0 ? 'text-rose-400' : 'text-amber-300'
                            }`}
                          >
                            {Number(m.margemVendaPercentual).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Supplier Cost Comparison */}
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#8B5CF6]" />
                Comparativo Real de Custos por Fornecedor
              </h3>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('suppliers')}
                  className="text-xs text-[#C4B5FD] hover:text-white"
                >
                  Abrir Central de Fornecedores
                </button>
              )}
            </div>

            {metrics.comparativoCustosFornecedores.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#0A0714] border border-[#262042] text-center text-xs text-[#AAA6B5]">
                Nenhuma compra registrada no período para comparar custos entre fornecedores.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#262042] text-[10px] uppercase text-[#AAA6B5]">
                      <th className="py-2 pr-3">Produto</th>
                      <th className="py-2 px-3">Fornecedor</th>
                      <th className="py-2 px-3 text-right">Último Custo</th>
                      <th className="py-2 px-3 text-right">Menor / Maior</th>
                      <th className="py-2 px-3 text-right">Compras</th>
                      <th className="py-2 pl-3 text-right">Última Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262042]/50">
                    {metrics.comparativoCustosFornecedores.flatMap((entry: any) =>
                      entry.fornecedores.map((f: any, idx: number) => (
                        <tr key={`${entry.productId}-${f.fornecedorId || idx}`}>
                          <td className="py-2.5 pr-3 font-semibold text-white">
                            {idx === 0 ? entry.productNome : ''}
                          </td>
                          <td className="py-2.5 px-3 text-[#C4B5FD]">{f.fornecedorNome}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-white">
                            R$ {Number(f.ultimoCusto).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#AAA6B5]">
                            R$ {Number(f.menorCusto).toFixed(2)} / R$ {Number(f.maiorCusto).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#AAA6B5]">
                            {f.comprasQtd}
                          </td>
                          <td className="py-2.5 pl-3 text-right text-[#716A86]">{f.ultimaData}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
