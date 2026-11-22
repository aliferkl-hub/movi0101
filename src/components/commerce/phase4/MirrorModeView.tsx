import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialPilotConfig } from '../../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Pause,
  Play,
  ShieldCheck,
  X,
} from 'lucide-react';

interface MirrorModeViewProps {
  onNavigateTab: (tab: string) => void;
}

export const MirrorModeView: React.FC<MirrorModeViewProps> = ({ onNavigateTab }) => {
  const [pilot, setPilot] = useState<CommercialPilotConfig | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [legacySystemName, setLegacySystemName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadMirror = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getCommercePilot();
      setPilot(res.pilot);
      setDaysLeft(res.diasRestantesEspelho);
      setStats(res.estatisticasEspelho);
      setLegacySystemName(res.pilot.modoEspelho.sistemaAnteriorNome || '');
      setNotes(res.pilot.modoEspelho.observacoes || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar Modo Espelho.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMirror();
  }, []);

  const handleAction = async (action: 'start' | 'pause' | 'resume') => {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.toggleCommerceMirrorMode({
        action,
        sistemaAnteriorNome: legacySystemName || undefined,
        observacoes: notes || undefined,
      });
      setSuccessMsg(res.message);
      loadMirror();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar Modo Espelho.');
    } finally {
      setSubmitting(false);
    }
  };

  const isActive = pilot?.modoEspelho?.ativo || false;
  const wasStarted = Boolean(pilot?.modoEspelho?.iniciadoEm);

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#8B5CF6]" />
            Modo Espelho — Operação Paralela por 7 Dias
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Experimente a MoviLog em paralelo com seu sistema atual sem risco operacional ou desligamento abrupto.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!wasStarted ? (
            <button
              onClick={() => handleAction('start')}
              disabled={submitting}
              className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" />
              <span>Ativar Modo Espelho (7 Dias)</span>
            </button>
          ) : isActive ? (
            <button
              onClick={() => handleAction('pause')}
              disabled={submitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Pause className="w-4 h-4" />
              <span>Pausar Modo Espelho</span>
            </button>
          ) : (
            <button
              onClick={() => handleAction('resume')}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" />
              <span>Retomar Modo Espelho</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-emerald-300">Garantia de Operação Não Destrutiva</div>
          <p className="text-[#AAA6B5]">
            Registros trazidos via importação no modo espelho recebem etiqueta{' '}
            <span className="font-mono text-white">importado_espelho</span>. Você pode pausar ou retomar a qualquer momento sem apagar vendas, produtos ou clientes já lançados.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
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

      {loading ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
          Carregando estado do Modo Espelho...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#AAA6B5] uppercase">Status da Janela</span>
                <Clock className="w-4 h-4 text-[#8B5CF6]" />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                {isActive
                  ? `${daysLeft ?? 7} dia(s) restante(s)`
                  : wasStarted
                  ? 'Pausado com Segurança'
                  : 'Pronto para Iniciar'}
              </div>
              {pilot?.modoEspelho?.expiraEm && (
                <div className="text-[11px] text-[#716A86]">
                  Previsão término 7 dias: {new Date(pilot.modoEspelho.expiraEm).toLocaleDateString('pt-BR')}
                </div>
              )}

              <div className="pt-2 space-y-2">
                <label className="text-[11px] text-[#AAA6B5] block">Sistema Atual em Paralelo</label>
                <input
                  type="text"
                  value={legacySystemName}
                  onChange={(e) => setLegacySystemName(e.target.value)}
                  placeholder="Ex: PDV Anterior / Planilha Excel"
                  className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {stats && (
              <div className="lg:col-span-2 bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Comparativo Real — Base Espelho vs Operação MoviLog</h3>
                  <button
                    onClick={() => onNavigateTab('import_center')}
                    className="text-xs text-[#C4B5FD] hover:text-white font-semibold"
                  >
                    Importar mais registros →
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                    <span className="text-[10px] text-[#716A86] block">Produtos (Espelho)</span>
                    <span className="text-lg font-black text-[#C4B5FD] tabular-nums">
                      {stats.produtosImportadosEspelho}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                    <span className="text-[10px] text-[#716A86] block">Produtos (Nativos/Migrados)</span>
                    <span className="text-lg font-black text-white tabular-nums">
                      {stats.produtosCadastradosMovilog}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                    <span className="text-[10px] text-[#716A86] block">Lotes Importados</span>
                    <span className="text-lg font-black text-white tabular-nums">
                      {stats.lotesImportacao}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                    <span className="text-[10px] text-[#716A86] block">Fornecedores (Espelho)</span>
                    <span className="text-lg font-black text-[#C4B5FD] tabular-nums">
                      {stats.fornecedoresImportadosEspelho}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                    <span className="text-[10px] text-[#716A86] block">Vendas PDV no Piloto</span>
                    <span className="text-lg font-black text-emerald-400 tabular-nums">
                      {stats.vendasRegistradasMovilog}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
                    <span className="text-[10px] text-[#716A86] block">Pedidos Delivery/Balcão</span>
                    <span className="text-lg font-black text-white tabular-nums">
                      {stats.pedidosRegistradosMovilog}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
