import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Info,
  RefreshCw,
  XCircle,
} from 'lucide-react';

export const EvaluationReportView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<{
    pilot: any;
    metricasReais: any;
    recursosAvaliados: { recurso: string; utilizado: boolean; registros: number }[];
    notaAvaliacao: string;
  } | null>(null);

  const loadEvaluation = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getCommercePilotEvaluation();
      setReport(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar relatório de avaliação.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluation();
  }, []);

  const handleExportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avaliacao_piloto_movilog_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#8B5CF6]" />
            Relatório de Avaliação — Piloto 7 Dias
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Consolidação 100% factual do uso real do estabelecimento para decisão segura de adoção definitiva.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadEvaluation}
            disabled={loading}
            className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8B5CF6] ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
          {report && (
            <button
              onClick={handleExportJson}
              className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Relatório</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && !report ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
          Consolidando métricas reais do piloto...
        </div>
      ) : report ? (
        <>
          <div className="p-4 rounded-2xl bg-[#121024] border border-[#262042] flex items-start gap-3 text-xs">
            <Info className="w-5 h-5 text-[#8B5CF6] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white mb-0.5">Diagnóstico de Adesão</div>
              <p className="text-[#AAA6B5]">{report.notaAvaliacao}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
              <span className="text-xs text-[#AAA6B5]">Vendas no PDV</span>
              <div className="text-2xl font-black text-white mt-1 tabular-nums">
                {report.metricasReais.vendasPdvQtd}
              </div>
              <div className="text-[11px] text-emerald-400 tabular-nums">
                R$ {Number(report.metricasReais.faturamentoPdvValor).toFixed(2)}
              </div>
            </div>
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
              <span className="text-xs text-[#AAA6B5]">Pedidos / Entregas</span>
              <div className="text-2xl font-black text-white mt-1 tabular-nums">
                {report.metricasReais.pedidosQtd}
              </div>
              <div className="text-[11px] text-[#C4B5FD] tabular-nums">
                {report.metricasReais.pedidosEntreguesQtd} concluído(s)
              </div>
            </div>
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
              <span className="text-xs text-[#AAA6B5]">Recursos Ativos</span>
              <div className="text-2xl font-black text-white mt-1 tabular-nums">
                {report.metricasReais.recursosUtilizadosCount} / {report.metricasReais.recursosTotaisCount}
              </div>
              <div className="text-[11px] text-[#AAA6B5]">Módulos com dados reais</div>
            </div>
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4">
              <span className="text-xs text-[#AAA6B5]">Perdas Mapeadas</span>
              <div className="text-2xl font-black text-rose-400 mt-1 tabular-nums">
                R$ {Number(report.metricasReais.perdasValor).toFixed(2)}
              </div>
              <div className="text-[11px] text-[#AAA6B5] tabular-nums">
                {report.metricasReais.perdasRegistradasQtd} ocorrência(s)
              </div>
            </div>
          </div>

          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Matriz de Utilização das Funcionalidades</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {report.recursosAvaliados.map((rec) => (
                <div
                  key={rec.recurso}
                  className="p-3.5 rounded-xl bg-[#0A0714] border border-[#262042] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {rec.utilizado ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#716A86] shrink-0" />
                    )}
                    <span className={rec.utilizado ? 'text-white font-semibold' : 'text-[#716A86]'}>
                      {rec.recurso}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[#C4B5FD] tabular-nums">
                    {rec.registros} reg.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
