import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialAlert, SmartStockItem } from '../../../types';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  CheckCircle2,
  PackageX,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
} from 'lucide-react';

interface RadarDashboardViewProps {
  modulo: 'adega' | 'tabacaria';
  onNavigateTab: (tab: string) => void;
}

export const RadarDashboardView: React.FC<RadarDashboardViewProps> = ({ modulo, onNavigateTab }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    resumo: any;
    alertasPrioritarios: CommercialAlert[];
    itensRiscoRuptura: SmartStockItem[];
    itensParados: SmartStockItem[];
    recomendacoes: {
      id: string;
      prioridade: 'critica' | 'alta' | 'media';
      titulo: string;
      justificativa: string;
      rotaSugerida: string;
      acaoLabel: string;
    }[];
  } | null>(null);

  const loadRadar = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCommerceRadar(modulo);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar Radar MoviLog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRadar();
  }, [modulo]);

  const priorityBadge = (p: string) => {
    if (p === 'critica') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    if (p === 'alta') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    if (p === 'media') return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  };

  if (loading && !data) {
    return (
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
        Analisando estoque, vendas reais e alertas do Radar MoviLog...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121024] border border-[#262042] rounded-2xl p-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#8B5CF6]" />
            Radar MoviLog — {modulo === 'adega' ? 'Adega & Bebidas' : 'Tabacaria & Headshop'}
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Monitoramento inteligente baseado exclusivamente em movimentações, vendas e cadastros reais do estabelecimento.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadRadar}
            disabled={loading}
            className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8B5CF6] ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Radar</span>
          </button>
          <button
            onClick={() => onNavigateTab('replenishment')}
            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Central de Reposição</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => onNavigateTab('alerts')}
              className="text-left bg-[#121024] hover:border-[#8B5CF6]/50 border border-[#262042] rounded-2xl p-4 transition"
            >
              <div className="flex items-center justify-between text-xs text-[#AAA6B5] mb-2">
                <span>Alertas Ativos</span>
                <Bell className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                {data.resumo.alertasAtivosCount}
              </div>
              <div className="text-[11px] text-rose-300 mt-1 tabular-nums">
                {data.resumo.alertasCriticosCount} crítico(s) • {data.resumo.alertasResolvidosCount} resolvido(s)
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('smart_stock')}
              className="text-left bg-[#121024] hover:border-[#8B5CF6]/50 border border-[#262042] rounded-2xl p-4 transition"
            >
              <div className="flex items-center justify-between text-xs text-[#AAA6B5] mb-2">
                <span>Risco de Ruptura</span>
                <PackageX className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                {data.resumo.itensEmRupturaCount + data.resumo.itensCriticosCount}
              </div>
              <div className="text-[11px] text-amber-300 mt-1 tabular-nums">
                {data.resumo.itensEmRupturaCount} zerado(s) • {data.resumo.itensCriticosCount} no mínimo
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('smart_stock')}
              className="text-left bg-[#121024] hover:border-[#8B5CF6]/50 border border-[#262042] rounded-2xl p-4 transition"
            >
              <div className="flex items-center justify-between text-xs text-[#AAA6B5] mb-2">
                <span>Itens Sem Giro (+30d)</span>
                <TrendingDown className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                {data.resumo.itensParadosCount}
              </div>
              <div className="text-[11px] text-[#AAA6B5] mt-1 tabular-nums">
                R$ {Number(data.resumo.capitalParadoCusto || 0).toFixed(2)} em custo parado
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('replenishment')}
              className="text-left bg-[#121024] hover:border-[#8B5CF6]/50 border border-[#262042] rounded-2xl p-4 transition"
            >
              <div className="flex items-center justify-between text-xs text-[#AAA6B5] mb-2">
                <span>Fila de Reposição</span>
                <Boxes className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                {data.resumo.reposicoesPendentesCount}
              </div>
              <div className="text-[11px] text-emerald-300 mt-1 tabular-nums">
                Capital total: R$ {Number(data.resumo.totalCapitalCusto || 0).toFixed(2)}
              </div>
            </button>
          </div>

          {/* Recommendations & Prioritized Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Recomendações Explicadas</h3>
                <span className="text-[11px] text-[#AAA6B5]">Critérios objetivos de operação</span>
              </div>

              {data.recomendacoes.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#0A0714] border border-[#262042] text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-semibold text-white">Operação equilibrada no momento</p>
                  <p className="text-[11px] text-[#AAA6B5]">
                    Nenhuma anomalia crítica de ruptura, custo ou estoque parado identificada para os registros atuais.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recomendacoes.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3.5 rounded-xl bg-[#0A0714] border border-[#262042] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${priorityBadge(rec.prioridade)}`}>
                            {rec.prioridade}
                          </span>
                          <span className="text-xs font-bold text-white">{rec.titulo}</span>
                        </div>
                        <p className="text-[11px] text-[#AAA6B5] leading-relaxed">{rec.justificativa}</p>
                      </div>
                      <button
                        onClick={() => onNavigateTab(rec.rotaSugerida)}
                        className="px-3 py-1.5 rounded-lg bg-[#1A1633] hover:bg-[#8B5CF6] text-xs font-semibold text-[#C4B5FD] hover:text-white flex items-center gap-1 shrink-0 transition"
                      >
                        <span>{rec.acaoLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Alertas Prioritários</h3>
                <button
                  onClick={() => onNavigateTab('alerts')}
                  className="text-xs font-semibold text-[#C4B5FD] hover:text-white flex items-center gap-1"
                >
                  <span>Ver Central Completa</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {data.alertasPrioritarios.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#0A0714] border border-[#262042] text-center text-xs text-[#AAA6B5]">
                  Nenhum alerta ativo pendente neste módulo.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {data.alertasPrioritarios.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-xl bg-[#0A0714] border border-[#262042] flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${priorityBadge(alert.prioridade)}`}>
                            {alert.prioridade}
                          </span>
                          <span className="text-xs font-bold text-white">{alert.titulo}</span>
                        </div>
                        <p className="text-[11px] text-[#AAA6B5]">{alert.descricao}</p>
                      </div>
                      <button
                        onClick={() => onNavigateTab(alert.rotaSugerida || 'alerts')}
                        className="px-2.5 py-1 rounded-lg bg-[#1A1633] hover:bg-[#262042] text-[11px] font-semibold text-white shrink-0"
                      >
                        Tratar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rupture Risk & Stagnant Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  Itens em Risco de Ruptura
                </h3>
                <button
                  onClick={() => onNavigateTab('smart_stock')}
                  className="text-xs text-[#C4B5FD] hover:text-white"
                >
                  Abrir Estoque Inteligente
                </button>
              </div>
              {data.itensRiscoRuptura.length === 0 ? (
                <p className="text-xs text-[#AAA6B5] py-4">Nenhum item abaixo do ponto de atenção.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#262042] text-[10px] uppercase text-[#AAA6B5]">
                        <th className="py-2 pr-2">Produto</th>
                        <th className="py-2 px-2 text-right">Atual</th>
                        <th className="py-2 px-2 text-right">Mín</th>
                        <th className="py-2 pl-2 text-right">Cobertura</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262042]/50">
                      {data.itensRiscoRuptura.map((item) => (
                        <tr key={item.product.id}>
                          <td className="py-2 pr-2 font-medium text-white">{item.product.nome}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-rose-300 font-bold">
                            {item.product.estoqueAtual}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-[#AAA6B5]">
                            {item.product.estoqueMinimo}
                          </td>
                          <td className="py-2 pl-2 text-right tabular-nums text-[#AAA6B5]">
                            {item.diasCoberturaEstimada !== null
                              ? `${item.diasCoberturaEstimada}d`
                              : 'Histórico insuf.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-purple-400" />
                  Itens Parados (+30 dias sem saída)
                </h3>
                <button
                  onClick={() => onNavigateTab('products')}
                  className="text-xs text-[#C4B5FD] hover:text-white"
                >
                  Revisar Preços
                </button>
              </div>
              {data.itensParados.length === 0 ? (
                <p className="text-xs text-[#AAA6B5] py-4">Nenhum produto parado detectado acima de 30 dias.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#262042] text-[10px] uppercase text-[#AAA6B5]">
                        <th className="py-2 pr-2">Produto</th>
                        <th className="py-2 px-2 text-right">Saldo</th>
                        <th className="py-2 px-2 text-right">Dias s/ Giro</th>
                        <th className="py-2 pl-2 text-right">Custo Imobilizado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262042]/50">
                      {data.itensParados.map((item) => (
                        <tr key={item.product.id}>
                          <td className="py-2 pr-2 font-medium text-white">{item.product.nome}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-white">
                            {item.product.estoqueAtual}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-amber-300">
                            {item.diasSemMovimentacao ?? '-'}d
                          </td>
                          <td className="py-2 pl-2 text-right tabular-nums text-[#AAA6B5]">
                            R$ {(item.product.estoqueAtual * item.product.precoCusto).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[#AAA6B5]">Atalhos Operacionais do Radar:</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onNavigateTab('smart_stock')} className="px-3 py-1.5 rounded-lg bg-[#0A0714] hover:bg-[#1A1633] border border-[#262042] text-xs text-white transition">Estoque Inteligente</button>
              <button onClick={() => onNavigateTab('replenishment')} className="px-3 py-1.5 rounded-lg bg-[#0A0714] hover:bg-[#1A1633] border border-[#262042] text-xs text-white transition">Central de Reposição</button>
              <button onClick={() => onNavigateTab('profitability')} className="px-3 py-1.5 rounded-lg bg-[#0A0714] hover:bg-[#1A1633] border border-[#262042] text-xs text-white transition">Rentabilidade</button>
              <button onClick={() => onNavigateTab('losses')} className="px-3 py-1.5 rounded-lg bg-[#0A0714] hover:bg-[#1A1633] border border-[#262042] text-xs text-white transition">Controle de Perdas</button>
              <button onClick={() => onNavigateTab('orders')} className="px-3 py-1.5 rounded-lg bg-[#0A0714] hover:bg-[#1A1633] border border-[#262042] text-xs text-white transition">Central de Pedidos</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
