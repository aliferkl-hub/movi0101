import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialPilotConfig } from '../../../types';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';

const MIGRATION_STEPS = [
  { key: 'congelamento_planilha_espelho', label: '1. Congelar atualização da planilha/sistema anterior' },
  { key: 'conferencia_saldos', label: '2. Conferir saldos físicos finais de Adega & Tabacaria' },
  { key: 'validacao_pdv', label: '3. Validar caixa, leitor EAN e maquininhas no PDV MoviLog' },
  { key: 'virada_definitiva', label: '4. Promover base espelho e concluir virada definitiva' },
];

export const MigrationCenterView: React.FC = () => {
  const [pilot, setPilot] = useState<CommercialPilotConfig | null>(null);
  const [summary, setSummary] = useState<{
    produtosTotal: number;
    fornecedoresTotal: number;
    duplicateSkuCount: number;
    missingPriceCount: number;
    conflicts: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadState = async () => {
    try {
      setLoading(true);
      const res = await api.getCommercePilot();
      setPilot(res.pilot);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar central de migração.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  const runAction = async (
    action: 'check_conflicts' | 'start' | 'complete_step' | 'pause' | 'resume' | 'complete',
    etapa?: string
  ) => {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.executeCommerceMigrationAction({ action, etapa });
      setPilot(res.pilot);
      setSummary(res.checklistResumo);
      setSuccessMsg(res.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao executar ação de migração.');
    } finally {
      setSubmitting(false);
    }
  };

  const status = pilot?.migracao?.status || 'nao_iniciada';

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-[#8B5CF6]" />
            Central de Migração Controlada (Virada Segura)
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Transição gradual do sistema antigo com checagem de conflitos, pausa segura sem perda de dados e auditoria de etapas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => runAction('check_conflicts')}
            disabled={submitting}
            className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Verificar Conflitos</span>
          </button>

          {status !== 'em_execucao' && status !== 'concluida' && (
            <button
              onClick={() => runAction(status === 'pausada' ? 'resume' : 'start')}
              disabled={submitting}
              className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{status === 'pausada' ? 'Retomar Migração' : 'Iniciar Migração'}</span>
            </button>
          )}

          {status === 'em_execucao' && (
            <>
              <button
                onClick={() => runAction('pause')}
                disabled={submitting}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pausar com Segurança</span>
              </button>
              <button
                onClick={() => runAction('complete')}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Concluir Virada Definitiva</span>
              </button>
            </>
          )}
        </div>
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

      {loading ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
          Carregando estado da migração...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status + Checklist */}
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Etapas de Transição</h3>
              <span className="px-2.5 py-1 rounded-full bg-[#8B5CF6]/15 text-[#C4B5FD] text-[10px] font-bold uppercase">
                Status: {status.replace('_', ' ')}
              </span>
            </div>

            {summary && (
              <div className="grid grid-cols-3 gap-2 text-xs bg-[#0A0714] border border-[#262042] rounded-xl p-3">
                <div>
                  <span className="text-[10px] text-[#716A86] block">Produtos</span>
                  <span className="font-bold text-white tabular-nums">{summary.produtosTotal}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#716A86] block">SKUs Duplicados</span>
                  <span
                    className={`font-bold tabular-nums ${
                      summary.duplicateSkuCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {summary.duplicateSkuCount}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#716A86] block">Sem Preço Venda</span>
                  <span
                    className={`font-bold tabular-nums ${
                      summary.missingPriceCount > 0 ? 'text-amber-300' : 'text-emerald-400'
                    }`}
                  >
                    {summary.missingPriceCount}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {MIGRATION_STEPS.map((st) => {
                const done = pilot?.migracao?.etapasConcluidas?.includes(st.key) || status === 'concluida';
                return (
                  <div
                    key={st.key}
                    className="p-3 rounded-xl bg-[#0A0714] border border-[#262042] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${done ? 'text-emerald-400' : 'text-[#716A86]'}`}
                      />
                      <span className={done ? 'text-emerald-300 font-semibold' : 'text-white'}>
                        {st.label}
                      </span>
                    </div>
                    {!done && (
                      <button
                        onClick={() => runAction('complete_step', st.key)}
                        disabled={submitting}
                        className="px-2.5 py-1 rounded-lg bg-[#1A1633] hover:bg-[#8B5CF6] text-[11px] font-semibold text-[#C4B5FD] hover:text-white"
                      >
                        Marcar Concluída
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Timeline */}
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Histórico & Log de Auditoria da Migração</h3>
            {!pilot?.migracao?.historicoLogs?.length ? (
              <div className="p-6 rounded-xl bg-[#0A0714] border border-[#262042] text-center text-xs text-[#AAA6B5]">
                Execute "Verificar Conflitos" para iniciar a auditoria de migração.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {pilot.migracao.historicoLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-[#0A0714] border border-[#262042] text-xs space-y-1"
                  >
                    <div className="flex justify-between font-semibold">
                      <span className="text-[#C4B5FD] uppercase text-[10px]">{log.etapa}</span>
                      <span className="text-[10px] text-[#716A86]">
                        {new Date(log.dataHora).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-white">{log.detalhes}</div>
                    <div className="text-[10px] text-[#716A86]">Responsável: {log.autorNome}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
