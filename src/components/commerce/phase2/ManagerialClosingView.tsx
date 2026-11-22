import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialPeriodClosing } from '../../../types';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  X,
} from 'lucide-react';

interface ManagerialClosingViewProps {
  modulo: 'adega' | 'tabacaria';
}

export const ManagerialClosingView: React.FC<ManagerialClosingViewProps> = ({ modulo }) => {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayMonth = `${today.slice(0, 7)}-01`;

  const [closings, setClosings] = useState<CommercialPeriodClosing[]>([]);
  const [scope, setScope] = useState<'adega' | 'tabacaria' | 'ambos'>(modulo);
  const [dataInicio, setDataInicio] = useState(firstDayMonth);
  const [dataFim, setDataFim] = useState(today);
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadClosings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getCommerceClosings();
      setClosings(res.closings || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar fechamentos gerenciais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClosings();
  }, [modulo]);

  const handleGenerateClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.createCommerceClosing({
        modulo: scope,
        dataInicio,
        dataFim,
        observacoes: observacoes.trim() || undefined,
      });
      setSuccessMsg(res.message);
      setObservacoes('');
      loadClosings();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao consolidar fechamento gerencial.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = (c: CommercialPeriodClosing) => {
    const rows = [
      ['Campo', 'Valor'],
      ['Código', c.codigo],
      ['Módulo', c.modulo],
      ['Período Início', c.dataInicio],
      ['Período Fim', c.dataFim],
      ['Entradas Estoque (Qtd)', String(c.entradasQtd)],
      ['Saídas Estoque (Qtd)', String(c.saidasQtd)],
      ['Vendas Concluídas (Qtd)', String(c.vendasQtd)],
      ['Faturamento Vendas (R$)', c.vendasValor.toFixed(2)],
      ['CMV (R$)', c.custoProdutosVendidos.toFixed(2)],
      ['Lucro Bruto Estimado (R$)', c.lucroBrutoEstimado.toFixed(2)],
      ['Margem Bruta (%)', c.margemBrutaPercentual.toFixed(1)],
      ['Compras (Qtd)', String(c.comprasQtd)],
      ['Compras (R$)', c.comprasValor.toFixed(2)],
      ['Perdas (Qtd)', String(c.perdasQtd)],
      ['Perdas (R$)', c.perdasValor.toFixed(2)],
      [
        'Lucro Líquido Observado (R$)',
        c.lucroLiquidoObservado !== null ? c.lucroLiquidoObservado.toFixed(2) : 'Não apurado (sem despesas)',
      ],
      ['Observação Técnica', c.notaLucroLiquido],
    ];
    const csvContent = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${c.codigo}_${c.dataInicio}_${c.dataFim}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <CalendarCheck className="w-5 h-5 text-[#8B5CF6]" />
          Fechamento Gerencial por Período
        </h2>
        <p className="text-xs text-[#AAA6B5] mb-4">
          Consolide entradas, saídas, vendas, CMV, perdas e lucro bruto real do período com exportação auditável em CSV.
        </p>

        <form onSubmit={handleGenerateClosing} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold text-[#AAA6B5] mb-1 block">Escopo</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="adega">Adega</option>
              <option value="tabacaria">Tabacaria</option>
              <option value="ambos">Adega + Tabacaria</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#AAA6B5] mb-1 block">Data Início</label>
            <input
              type="date"
              required
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#AAA6B5] mb-1 block">Data Fim</label>
            <input
              type="date"
              required
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#AAA6B5] mb-1 block">Observações</label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{submitting ? 'Gerando...' : 'Consolidar Fechamento'}</span>
          </button>
        </form>
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

      {/* Closings List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
            Carregando fechamentos...
          </div>
        ) : closings.length === 0 ? (
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
            Nenhum fechamento gerencial gerado ainda. Selecione um período acima para consolidar.
          </div>
        ) : (
          closings.map((c) => (
            <div key={c.id} className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262042] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white text-sm">{c.codigo}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-[#8B5CF6]/15 text-[#C4B5FD]">
                      {c.modulo}
                    </span>
                  </div>
                  <div className="text-xs text-[#AAA6B5]">
                    Período: {c.dataInicio} até {c.dataFim} • Fechado por {c.fechadoPorNome} em{' '}
                    {new Date(c.criadoEm).toLocaleString('pt-BR')}
                  </div>
                </div>
                <button
                  onClick={() => handleExportCsv(c)}
                  className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>Exportar CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                  <span className="text-[10px] text-[#716A86] block">Vendas ({c.vendasQtd})</span>
                  <span className="font-bold text-white tabular-nums">R$ {c.vendasValor.toFixed(2)}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                  <span className="text-[10px] text-[#716A86] block">CMV</span>
                  <span className="font-bold text-amber-300 tabular-nums">
                    R$ {c.custoProdutosVendidos.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                  <span className="text-[10px] text-[#716A86] block">Lucro Bruto Est.</span>
                  <span className="font-bold text-emerald-400 tabular-nums">
                    R$ {c.lucroBrutoEstimado.toFixed(2)} ({c.margemBrutaPercentual}%)
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                  <span className="text-[10px] text-[#716A86] block">Compras ({c.comprasQtd})</span>
                  <span className="font-bold text-white tabular-nums">R$ {c.comprasValor.toFixed(2)}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                  <span className="text-[10px] text-[#716A86] block">Perdas ({c.perdasQtd} un)</span>
                  <span className="font-bold text-rose-400 tabular-nums">R$ {c.perdasValor.toFixed(2)}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                  <span className="text-[10px] text-[#716A86] block">Mov. Estoque</span>
                  <span className="font-bold text-[#C4B5FD] tabular-nums">
                    +{c.entradasQtd} / -{c.saidasQtd}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-[#AAA6B5] bg-[#0A0714] border border-[#262042] rounded-xl p-3">
                <Info className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">
                    {c.lucroLiquidoObservado !== null
                      ? `Lucro Líquido Observado: R$ ${c.lucroLiquidoObservado.toFixed(2)} — `
                      : 'Lucro Líquido não apurado — '}
                  </span>
                  <span>{c.notaLucroLiquido}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
