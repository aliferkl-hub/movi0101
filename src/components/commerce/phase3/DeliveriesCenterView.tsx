import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialOrder } from '../../../types';
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Navigation,
  ShieldAlert,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';

interface DeliveriesCenterViewProps {
  modulo: 'adega' | 'tabacaria';
}

export const DeliveriesCenterView: React.FC<DeliveriesCenterViewProps> = ({ modulo }) => {
  const [orders, setOrders] = useState<CommercialOrder[]>([]);
  const [filter, setFilter] = useState<'ativos' | 'entregue' | 'cancelado' | 'todos'>('ativos');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [dispatchOrder, setDispatchOrder] = useState<CommercialOrder | null>(null);
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState('');

  const [occOrder, setOccOrder] = useState<CommercialOrder | null>(null);
  const [occDesc, setOccDesc] = useState('');

  const [confirmOrder, setConfirmOrder] = useState<CommercialOrder | null>(null);
  const [ageVerified, setAgeVerified] = useState(false);

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getCommerceOrders({ tipoAtendimento: 'entrega' });
      setOrders(res.orders || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar fila de entregas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [modulo]);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchOrder) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.updateCommerceOrderStatus(dispatchOrder.id, {
        status: 'saiu_entrega',
        entregadorNome: courierName.trim() || undefined,
        entregadorTelefone: courierPhone.trim() || undefined,
        observacao: courierName.trim() ? `Entregador designado: ${courierName.trim()}` : undefined,
      });
      setSuccessMsg(res.message);
      setDispatchOrder(null);
      setCourierName('');
      setCourierPhone('');
      loadDeliveries();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao despachar entrega.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!occOrder || !occDesc.trim()) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.addCommerceOrderOccurrence(occOrder.id, occDesc.trim());
      setSuccessMsg(res.message);
      setOccOrder(null);
      setOccDesc('');
      loadDeliveries();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar ocorrência.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!confirmOrder) return;
    if (confirmOrder.contemItemRestrito && !ageVerified) {
      setErrorMsg('Confirme a conferência presencial de documento (+18) antes de concluir.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.updateCommerceOrderStatus(confirmOrder.id, {
        status: 'entregue',
        verificacaoMaioridadeEntrega: ageVerified,
      });
      setSuccessMsg(res.message);
      setConfirmOrder(null);
      loadDeliveries();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao confirmar entrega.');
    } finally {
      setSubmitting(false);
    }
  };

  const visible = orders.filter((o) => {
    if (filter === 'ativos') return ['recebido', 'em_separacao', 'saiu_entrega'].includes(o.status);
    if (filter === 'todos') return true;
    return o.status === filter;
  });

  const buildWhatsAppLink = (ord: CommercialOrder) => {
    const digits = (ord.clienteTelefone || '').replace(/\D/g, '');
    if (!digits) return null;
    const phone = digits.startsWith('55') ? digits : `55${digits}`;
    const msg = `Olá ${ord.clienteNome}, sobre seu pedido ${ord.codigoPedido} (${ord.status.replace('_', ' ')}).`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#8B5CF6]" />
            Entregas Locais & Despacho de Pedidos
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Designação de entregadores, contato rápido via WhatsApp, ocorrências e confirmação presencial (+18).
          </p>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
        >
          <option value="ativos">Entregas Ativas</option>
          <option value="entregue">Concluídas</option>
          <option value="cancelado">Canceladas</option>
          <option value="todos">Todas</option>
        </select>
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
          Carregando fila de entregas...
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
          Nenhuma entrega encontrada neste filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visible.map((ord) => {
            const waUrl = buildWhatsAppLink(ord);
            return (
              <div
                key={ord.id}
                className="bg-[#121024] border border-[#262042] rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white text-xs">{ord.codigoPedido}</span>
                      <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/15 text-[#C4B5FD] text-[10px] font-semibold">
                        {ord.status.replace('_', ' ')}
                      </span>
                      {ord.contemItemRestrito && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                          +18 Documento Obrigatório
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-white mt-1">{ord.clienteNome}</div>
                    <div className="text-xs text-[#AAA6B5]">{ord.enderecoEntrega}</div>
                  </div>
                  <div className="text-right font-black text-emerald-400 text-sm tabular-nums">
                    R$ {ord.valorTotal.toFixed(2)}
                  </div>
                </div>

                {ord.entregadorNome && (
                  <div className="text-xs text-[#C4B5FD] flex items-center gap-1.5 bg-[#0A0714] px-3 py-1.5 rounded-xl border border-[#262042]">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>
                      Entregador: {ord.entregadorNome}{' '}
                      {ord.entregadorTelefone ? `(${ord.entregadorTelefone})` : ''}
                    </span>
                  </div>
                )}

                {ord.ocorrencias.length > 0 && (
                  <div className="text-[11px] text-amber-300 bg-amber-950/20 border border-amber-500/30 rounded-xl px-3 py-2">
                    Última ocorrência: {ord.ocorrencias[ord.ocorrencias.length - 1].descricao}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#262042]">
                  {ord.status !== 'entregue' && ord.status !== 'cancelado' && (
                    <>
                      <button
                        onClick={() => {
                          setDispatchOrder(ord);
                          setCourierName(ord.entregadorNome || '');
                          setCourierPhone(ord.entregadorTelefone || '');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>{ord.status === 'saiu_entrega' ? 'Alterar Entregador' : 'Despachar'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setConfirmOrder(ord);
                          setAgeVerified(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Concluir Entrega
                      </button>

                      <button
                        onClick={() => setOccOrder(ord)}
                        className="px-3 py-1.5 rounded-lg bg-[#1A1633] hover:bg-[#262042] text-[#AAA6B5] hover:text-white text-xs"
                      >
                        Registrar Ocorrência
                      </button>
                    </>
                  )}

                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 ml-auto"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleDispatch}
            className="bg-[#121024] border border-[#262042] rounded-2xl p-6 max-w-md w-full text-white space-y-4"
          >
            <h3 className="text-sm font-bold">Despachar Pedido {dispatchOrder.codigoPedido}</h3>
            <div>
              <label className="text-xs text-[#AAA6B5] mb-1 block">Nome do Entregador</label>
              <input
                type="text"
                required
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="Ex: Marcos Motoboy"
                className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#AAA6B5] mb-1 block">Telefone do Entregador</label>
              <input
                type="text"
                value={courierPhone}
                onChange={(e) => setCourierPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDispatchOrder(null)}
                className="px-4 py-2 bg-[#1A1633] text-xs text-[#AAA6B5] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#8B5CF6] text-xs font-bold text-white rounded-xl"
              >
                Confirmar Saída
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Occurrence Modal */}
      {occOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddOccurrence}
            className="bg-[#121024] border border-[#262042] rounded-2xl p-6 max-w-md w-full text-white space-y-4"
          >
            <h3 className="text-sm font-bold">Registrar Ocorrência — {occOrder.codigoPedido}</h3>
            <textarea
              rows={3}
              required
              value={occDesc}
              onChange={(e) => setOccDesc(e.target.value)}
              placeholder="Ex: Cliente não atendeu o interfone na primeira tentativa..."
              className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOccOrder(null)}
                className="px-4 py-2 bg-[#1A1633] text-xs text-[#AAA6B5] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-amber-600 text-xs font-bold text-white rounded-xl"
              >
                Salvar Ocorrência
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Delivery Modal */}
      {confirmOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-6 max-w-md w-full text-white space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              {confirmOrder.contemItemRestrito ? (
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
              Concluir Entrega — {confirmOrder.codigoPedido}
            </h3>
            {confirmOrder.contemItemRestrito ? (
              <label className="flex items-start gap-2 text-xs text-amber-100 cursor-pointer p-3 rounded-xl bg-amber-950/30 border border-amber-500/40">
                <input
                  type="checkbox"
                  checked={ageVerified}
                  onChange={(e) => setAgeVerified(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-500"
                />
                <span>
                  Confirmo a verificação presencial do documento oficial comprovando maioridade (+18 anos) do recebedor.
                </span>
              </label>
            ) : (
              <p className="text-xs text-[#AAA6B5]">
                Confirmar entrega concluída para {confirmOrder.clienteNome}?
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOrder(null)}
                className="px-4 py-2 bg-[#1A1633] text-xs text-[#AAA6B5] rounded-xl"
              >
                Voltar
              </button>
              <button
                onClick={handleCompleteDelivery}
                disabled={submitting || (confirmOrder.contemItemRestrito && !ageVerified)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white rounded-xl"
              >
                Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
