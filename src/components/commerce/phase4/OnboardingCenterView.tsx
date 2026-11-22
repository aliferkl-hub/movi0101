import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialPilotConfig } from '../../../types';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Rocket,
  Save,
  X,
} from 'lucide-react';

interface OnboardingCenterViewProps {
  onNavigateTab: (tab: string) => void;
}

const STEP_META: { key: string; label: string; desc: string; targetTab: string; actionText: string }[] = [
  {
    key: 'dados_estabelecimento',
    label: '1. Dados do Estabelecimento',
    desc: 'Nome fantasia, CNPJ, endereço operacional e WhatsApp de pedidos.',
    targetTab: 'onboarding',
    actionText: 'Configurado abaixo',
  },
  {
    key: 'fornecedores_cadastrados',
    label: '2. Fornecedores Principais',
    desc: 'Cadastre ou importe os distribuidores de bebidas e tabacaria.',
    targetTab: 'suppliers',
    actionText: 'Abrir Fornecedores',
  },
  {
    key: 'produtos_importados',
    label: '3. Catálogo de Produtos & Estoque Inicial',
    desc: 'Importe sua planilha CSV/XLSX ou cadastre itens com custo, preço e faixa +18.',
    targetTab: 'import_center',
    actionText: 'Importar Planilha',
  },
  {
    key: 'pdv_caixa_testado',
    label: '4. Primeiro Caixa e Venda Teste no PDV',
    desc: 'Abra o caixa e execute uma venda teste com leitor de código de barras ou PIX.',
    targetTab: 'pos',
    actionText: 'Ir ao PDV',
  },
  {
    key: 'equipe_perfis',
    label: '5. Modo Espelho Paralelo (7 Dias)',
    desc: 'Ative a operação espelho para validar o MoviLog sem desligar o sistema atual.',
    targetTab: 'mirror_mode',
    actionText: 'Configurar Espelho',
  },
  {
    key: 'catalogo_revisado',
    label: '6. Vitrine Digital & QR Code (Itens Livres)',
    desc: 'Ative o catálogo público apenas para itens sem restrição legal.',
    targetTab: 'catalog',
    actionText: 'Abrir Catálogo',
  },
];

export const OnboardingCenterView: React.FC<OnboardingCenterViewProps> = ({ onNavigateTab }) => {
  const [pilot, setPilot] = useState<CommercialPilotConfig | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    estabelecimentoNome: '',
    estabelecimentoCnpj: '',
    estabelecimentoEndereco: '',
    whatsappPedidos: '',
  });

  const loadPilot = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getCommercePilot();
      setPilot(res.pilot);
      setProgress(res.progressoChecklistPercentual || 0);
      setForm({
        estabelecimentoNome: res.pilot.estabelecimentoNome || '',
        estabelecimentoCnpj: res.pilot.estabelecimentoCnpj || '',
        estabelecimentoEndereco: res.pilot.estabelecimentoEndereco || '',
        whatsappPedidos: res.pilot.whatsappPedidos || '',
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar dados de implantação.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPilot();
  }, []);

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      await api.updateCommercePilot(form);
      setSuccessMsg('Dados do estabelecimento salvos.');
      loadPilot();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar dados.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStep = async (key: string) => {
    try {
      setSaving(true);
      await api.updateCommercePilot({ toggleChecklistPasso: key });
      loadPilot();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar etapa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[#8B5CF6]" />
            Central de Implantação Guiada (Adega & Tabacaria)
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Configure o estabelecimento passo a passo para iniciar o piloto sem interromper sua operação atual.
          </p>
        </div>

        <div className="min-w-[180px] text-right">
          <div className="text-xs font-bold text-white tabular-nums">{progress}% concluído</div>
          <div className="w-full h-2 bg-[#0A0714] rounded-full overflow-hidden mt-1 border border-[#262042]">
            <div
              className="h-full bg-[#8B5CF6] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
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
          Carregando roteiro de implantação...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Checklist */}
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Checklist de Implantação</h3>
            <div className="space-y-2.5">
              {STEP_META.map((step) => {
                const done = pilot?.checklistPassos?.[step.key]?.concluido || false;
                return (
                  <div
                    key={step.key}
                    className="p-3.5 rounded-xl bg-[#0A0714] border border-[#262042] flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleStep(step.key)}
                      disabled={saving}
                      className="flex items-start gap-3 text-left flex-1"
                    >
                      {done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#716A86] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className={`text-xs font-bold ${done ? 'text-emerald-300' : 'text-white'}`}>
                          {step.label}
                        </div>
                        <div className="text-[11px] text-[#AAA6B5] mt-0.5">{step.desc}</div>
                      </div>
                    </button>

                    {step.targetTab !== 'onboarding' && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab(step.targetTab)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1A1633] hover:bg-[#8B5CF6] text-[11px] font-semibold text-[#C4B5FD] hover:text-white flex items-center gap-1 shrink-0 transition"
                      >
                        <span>{step.actionText}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Establishment Config */}
          <form
            onSubmit={handleSaveForm}
            className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-bold text-white">Identidade do Estabelecimento</h3>
            <div>
              <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                Nome Comercial / Adega
              </label>
              <input
                type="text"
                required
                value={form.estabelecimentoNome}
                onChange={(e) => setForm({ ...form, estabelecimentoNome: e.target.value })}
                className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">CNPJ</label>
              <input
                type="text"
                value={form.estabelecimentoCnpj}
                onChange={(e) => setForm({ ...form, estabelecimentoCnpj: e.target.value })}
                className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                Endereço Operacional
              </label>
              <input
                type="text"
                value={form.estabelecimentoEndereco}
                onChange={(e) => setForm({ ...form, estabelecimentoEndereco: e.target.value })}
                className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                WhatsApp Comercial
              </label>
              <input
                type="text"
                value={form.whatsappPedidos}
                onChange={(e) => setForm({ ...form, whatsappPedidos: e.target.value })}
                placeholder="5511999999999"
                className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Dados do Estabelecimento'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
