import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialInventory } from '../../../types';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Play,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';

interface InventoryCountViewProps {
  modulo: 'adega' | 'tabacaria';
}

export const InventoryCountView: React.FC<InventoryCountViewProps> = ({ modulo }) => {
  const [inventories, setInventories] = useState<CommercialInventory[]>([]);
  const [activeInv, setActiveInv] = useState<CommercialInventory | null>(null);
  const [countsDraft, setCountsDraft] = useState<Record<string, { saldoContado: string; justificativa: string }>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newScope, setNewScope] = useState<'adega' | 'tabacaria' | 'ambos'>(modulo);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const syncDraftFromInventory = (inv: CommercialInventory | null) => {
    setActiveInv(inv);
    if (!inv) {
      setCountsDraft({});
      return;
    }
    const next: Record<string, { saldoContado: string; justificativa: string }> = {};
    for (const it of inv.itens) {
      next[it.productId] = {
        saldoContado: it.saldoContado === null || it.saldoContado === undefined ? '' : String(it.saldoContado),
        justificativa: it.justificativa || '',
      };
    }
    setCountsDraft(next);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getCommerceInventories();
      const list = res.inventories || [];
      setInventories(list);
      const openOne = list.find((i) => i.status === 'em_contagem' || i.status === 'conferido') || list[0] || null;
      syncDraftFromInventory(openOne);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar sessões de inventário.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modulo]);

  const handleStartInventory = async () => {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.createCommerceInventory({ modulo: newScope });
      setSuccessMsg(res.message);
      await loadData();
      syncDraftFromInventory(res.inventory);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao iniciar inventário físico.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCounts = async (finalizar: boolean) => {
    if (!activeInv) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const counts = activeInv.itens.map((it) => {
        const draft = countsDraft[it.productId];
        const rawVal = draft?.saldoContado ?? '';
        return {
          productId: it.productId,
          saldoContado: rawVal === '' ? null : Math.max(0, parseInt(rawVal, 10) || 0),
          justificativa: draft?.justificativa || '',
        };
      });
      const res = await api.saveCommerceInventoryCount(activeInv.id, {
        counts,
        finalizarConferencia: finalizar,
      });
      setSuccessMsg(res.message);
      await loadData();
      syncDraftFromInventory(res.inventory);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar contagem.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAdjustment = async () => {
    if (!activeInv) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.approveCommerceInventory(activeInv.id);
      setSuccessMsg(res.message);
      await loadData();
      syncDraftFromInventory(res.inventory);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao aprovar ajuste de inventário.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (s: string) => {
    if (s === 'em_contagem') return 'Em Contagem';
    if (s === 'conferido') return 'Conferido (Aguard. Aprovação)';
    if (s === 'aprovado_ajustado') return 'Aprovado & Estoque Ajustado';
    return s;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#8B5CF6]" />
            Inventário Físico Auditável
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Contagem por produto com comparação direta contra o saldo do sistema e ajuste rastreável mediante aprovação gerencial.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={newScope}
            onChange={(e) => setNewScope(e.target.value as any)}
            className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="adega">Somente Adega</option>
            <option value="tabacaria">Somente Tabacaria</option>
            <option value="ambos">Adega + Tabacaria</option>
          </select>
          <button
            onClick={handleStartInventory}
            disabled={submitting}
            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Nova Contagem</span>
          </button>
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

      {/* Session Selector */}
      {inventories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {inventories.map((inv) => (
            <button
              key={inv.id}
              onClick={() => syncDraftFromInventory(inv)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition ${
                activeInv?.id === inv.id
                  ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                  : 'bg-[#121024] border-[#262042] text-[#AAA6B5] hover:text-white'
              }`}
            >
              {inv.codigo} • {statusLabel(inv.status)}
            </button>
          ))}
        </div>
      )}

      {/* Active Inventory Table */}
      {loading ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
          Carregando inventários...
        </div>
      ) : !activeInv ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
          Clique em "Nova Contagem" para iniciar uma auditoria física do estoque.
        </div>
      ) : (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#262042] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white">
                {activeInv.codigo} — {statusLabel(activeInv.status)}
              </div>
              <div className="text-[11px] text-[#AAA6B5] tabular-nums">
                {activeInv.totalItens} item(ns) • {activeInv.totalDivergencias} divergência(s) • Impacto: R${' '}
                {Number(activeInv.impactoFinanceiroTotal).toFixed(2)}
              </div>
            </div>

            {activeInv.status !== 'aprovado_ajustado' && activeInv.status !== 'cancelado' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleSaveCounts(false)}
                  disabled={submitting}
                  className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>Salvar Parcial</span>
                </button>
                <button
                  onClick={() => handleSaveCounts(true)}
                  disabled={submitting}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white rounded-xl"
                >
                  Concluir Conferência
                </button>
                <button
                  onClick={handleApproveAdjustment}
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-xl flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Aprovar & Ajustar Estoque</span>
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262042] bg-[#0A0714]/60 text-[10px] uppercase text-[#AAA6B5]">
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4 text-right">Saldo Sistema</th>
                  <th className="py-3 px-4 text-center">Contagem Física</th>
                  <th className="py-3 px-4 text-right">Divergência</th>
                  <th className="py-3 px-4 text-right">Impacto R$</th>
                  <th className="py-3 px-4">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262042]/50">
                {activeInv.itens.map((it) => {
                  const draft = countsDraft[it.productId];
                  const isLocked = activeInv.status === 'aprovado_ajustado' || activeInv.status === 'cancelado';
                  const countedNum =
                    draft && draft.saldoContado !== '' ? parseInt(draft.saldoContado, 10) : null;
                  const div = countedNum !== null && !isNaN(countedNum) ? countedNum - it.saldoSistema : 0;
                  const impact = div * it.custoUnitario;

                  return (
                    <tr key={it.productId} className="hover:bg-[#1A1633]/30">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{it.nome}</div>
                        <div className="text-[10px] font-mono text-[#716A86]">
                          {it.sku} • {it.modulo}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#AAA6B5]">
                        {it.saldoSistema} {it.unidade}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          disabled={isLocked}
                          value={draft?.saldoContado ?? ''}
                          onChange={(e) =>
                            setCountsDraft((prev) => ({
                              ...prev,
                              [it.productId]: {
                                saldoContado: e.target.value,
                                justificativa: prev[it.productId]?.justificativa || '',
                              },
                            }))
                          }
                          className="w-24 bg-[#0A0714] border border-[#262042] rounded-lg px-2 py-1 text-center text-xs text-white tabular-nums disabled:opacity-60"
                        />
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold tabular-nums ${
                          div === 0 ? 'text-[#716A86]' : div > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {div > 0 ? `+${div}` : div}
                      </td>
                      <td
                        className={`py-3 px-4 text-right tabular-nums ${
                          impact === 0 ? 'text-[#716A86]' : impact > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        R$ {impact.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          disabled={isLocked}
                          placeholder={div !== 0 ? 'Obrigatório explicar divergência...' : 'Opcional'}
                          value={draft?.justificativa ?? ''}
                          onChange={(e) =>
                            setCountsDraft((prev) => ({
                              ...prev,
                              [it.productId]: {
                                saldoContado: prev[it.productId]?.saldoContado ?? '',
                                justificativa: e.target.value,
                              },
                            }))
                          }
                          className="w-full bg-[#0A0714] border border-[#262042] rounded-lg px-2.5 py-1 text-xs text-white disabled:opacity-60"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
