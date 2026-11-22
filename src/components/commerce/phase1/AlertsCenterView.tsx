import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialAlert } from '../../../types';
import { Bell, CheckCircle2, RefreshCw } from 'lucide-react';

interface AlertsCenterViewProps {
  modulo: 'adega' | 'tabacaria';
  onNavigateTab: (tab: string) => void;
}

export const AlertsCenterView: React.FC<AlertsCenterViewProps> = ({ modulo, onNavigateTab }) => {
  const [alerts, setAlerts] = useState<CommercialAlert[]>([]);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [priorityFilter, setPriorityFilter] = useState('todas');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [resolvingAlert, setResolvingAlert] = useState<CommercialAlert | null>(null);
  const [motivoResolucao, setMotivoResolucao] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCommerceAlerts({
        modulo,
        status: statusFilter,
        prioridade: priorityFilter,
        categoria: categoryFilter,
      });
      setAlerts(res.alerts || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [modulo, statusFilter, priorityFilter, categoryFilter]);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAlert) return;
    try {
      const res = await api.resolveCommerceAlert(
        resolvingAlert.id,
        motivoResolucao.trim() || 'Resolvido pela equipe comercial'
      );
      setSuccess(res.message);
      setResolvingAlert(null);
      setMotivoResolucao('');
      loadAlerts();
    } catch (err: any) {
      setError(err.message || 'Erro ao resolver alerta.');
    }
  };

  const priorityBadge = (p: string) => {
    if (p === 'critica') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (p === 'alta') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (p === 'media') return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121024] border border-[#262042] rounded-2xl p-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#8B5CF6]" />
            Central de Alertas — {modulo === 'adega' ? 'Adega' : 'Tabacaria'}
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Acompanhamento de alertas priorizados com filtros por categoria/prioridade e histórico auditável de resoluções.
          </p>
        </div>

        <button
          onClick={loadAlerts}
          className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#8B5CF6] ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Alertas</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
        >
          <option value="todos">Todos os Status</option>
          <option value="ativo">Somente Ativos</option>
          <option value="resolvido">Histórico Resolvidos</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
        >
          <option value="todas">Todas as Prioridades</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
        >
          <option value="todas">Todas as Categorias</option>
          <option value="ruptura_estoque">Ruptura de Estoque</option>
          <option value="estoque_baixo">Estoque Baixo</option>
          <option value="produto_parado">Produto Parado</option>
          <option value="alta_custo_fornecedor">Alta de Custo</option>
          <option value="divergencia_estoque">Divergência de Inventário</option>
          <option value="pedido_pendente">Pedido Pendente</option>
          <option value="perda_recorrente">Perda Recorrente</option>
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">{success}</div>
      )}

      {loading ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-10 text-center text-xs text-[#AAA6B5]">
          Carregando alertas...
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-10 text-center space-y-2">
          <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-white">Nenhum alerta encontrado</p>
          <p className="text-xs text-[#AAA6B5]">Não há ocorrências para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-[#121024] border border-[#262042] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${priorityBadge(alert.prioridade)}`}>
                    {alert.prioridade}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0A0714] text-[#C4B5FD] border border-[#262042]">
                    {alert.categoria.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-bold text-white">{alert.titulo}</span>
                </div>
                <p className="text-xs text-[#AAA6B5]">{alert.descricao}</p>
                <p className="text-[11px] text-[#C4B5FD]">Ação recomendada: {alert.acaoRecomendada}</p>
                {alert.status === 'resolvido' && (
                  <p className="text-[11px] text-emerald-400">
                    Resolvido por {alert.resolvidoPorNome} em{' '}
                    {alert.resolvidoEm ? new Date(alert.resolvidoEm).toLocaleString('pt-BR') : '-'} —{' '}
                    {alert.motivoResolucao}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onNavigateTab(alert.rotaSugerida || 'smart_stock')}
                  className="px-3 py-1.5 rounded-xl bg-[#1A1633] hover:bg-[#262042] text-xs font-semibold text-white"
                >
                  Abrir Tela
                </button>
                {alert.status === 'ativo' && (
                  <button
                    onClick={() => {
                      setResolvingAlert(alert);
                      setMotivoResolucao('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-bold text-emerald-300"
                  >
                    Marcar Resolvido
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleResolve}
            className="bg-[#121024] border border-[#262042] rounded-2xl p-5 max-w-md w-full space-y-4"
          >
            <h3 className="text-sm font-bold text-white">Registrar Resolução de Alerta</h3>
            <p className="text-xs text-[#AAA6B5]">{resolvingAlert.titulo}</p>
            <div>
              <label className="text-xs font-semibold text-[#AAA6B5] block mb-1">
                Motivo / Ação Tomada
              </label>
              <textarea
                rows={3}
                required
                value={motivoResolucao}
                onChange={(e) => setMotivoResolucao(e.target.value)}
                placeholder="Ex: Compra encaminhada com fornecedor ou ajuste verificado no estoque..."
                className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolvingAlert(null)}
                className="px-3.5 py-2 bg-[#1A1633] text-xs font-semibold text-[#AAA6B5] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-bold text-white rounded-xl"
              >
                Confirmar Resolução
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
