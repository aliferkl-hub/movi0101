import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialCustomer, CommercialOrder, CommercialOrderStatus, CommercialProduct } from '../../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Plus,
  Search,
  ShieldAlert,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';

interface OrdersCenterViewProps {
  modulo: 'adega' | 'tabacaria';
}

const STATUS_BADGES: Record<CommercialOrderStatus, string> = {
  recebido: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  em_separacao: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  saiu_entrega: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  entregue: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cancelado: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const STATUS_LABELS: Record<CommercialOrderStatus, string> = {
  recebido: 'Recebido',
  em_separacao: 'Em Separação',
  saiu_entrega: 'Saiu p/ Entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const OrdersCenterView: React.FC<OrdersCenterViewProps> = ({ modulo }) => {
  const [orders, setOrders] = useState<CommercialOrder[]>([]);
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [customers, setCustomers] = useState<CommercialCustomer[]>([]);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customerId: '',
    clienteNome: '',
    clienteTelefone: '',
    enderecoEntrega: '',
    bairro: '',
    cidade: '',
    tipoAtendimento: 'entrega' as 'entrega' | 'retirada_balcao',
    taxaEntrega: '0.00',
    desconto: '0.00',
    formaPagamento: 'pagamento_entrega',
    verificacaoMaioridadeSolicitada: false,
    observacoes: '',
    itens: [] as { productId: string; quantidade: number }[],
  });
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQty, setItemQty] = useState('1');

  // Action Modals
  const [detailOrder, setDetailOrder] = useState<CommercialOrder | null>(null);
  const [deliveryConfirmOrder, setDeliveryConfirmOrder] = useState<CommercialOrder | null>(null);
  const [deliveryAgeChecked, setDeliveryAgeChecked] = useState(false);
  const [cancelOrder, setCancelOrder] = useState<CommercialOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [ordRes, prodRes, custRes] = await Promise.all([
        api.getCommerceOrders({ status: statusFilter, tipoAtendimento: typeFilter, search }),
        api.getCommerceProducts(),
        api.getCommerceCustomers(),
      ]);
      setOrders(ordRes.orders || []);
      const activeProds = (prodRes.products || []).filter((p) => p.ativo && p.estoqueAtual > 0);
      setProducts(activeProds);
      setCustomers((custRes.customers || []).filter((c) => !c.anonimizado && c.ativo));
      if (activeProds.length > 0 && !selectedProductId) {
        const modProd = activeProds.find((p) => p.modulo === modulo) || activeProds[0];
        setSelectedProductId(modProd.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar pedidos comerciais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter, modulo]);

  const handleSelectCustomer = (cid: string) => {
    const cust = customers.find((c) => c.id === cid);
    if (!cust) {
      setOrderForm((prev) => ({ ...prev, customerId: '' }));
      return;
    }
    setOrderForm((prev) => ({
      ...prev,
      customerId: cid,
      clienteNome: cust.nome,
      clienteTelefone: cust.telefone || '',
      enderecoEntrega: cust.endereco || '',
      bairro: cust.bairro || '',
      cidade: cust.cidade || '',
    }));
  };

  const handleAddItem = () => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;
    const qty = Math.max(1, parseInt(itemQty, 10) || 1);
    setOrderForm((prev) => {
      const existing = prev.itens.find((i) => i.productId === prod.id);
      if (existing) {
        return {
          ...prev,
          itens: prev.itens.map((i) =>
            i.productId === prod.id ? { ...i, quantidade: i.quantidade + qty } : i
          ),
        };
      }
      return { ...prev, itens: [...prev.itens, { productId: prod.id, quantidade: qty }] };
    });
  };

  const isRestrictedProd = (p?: CommercialProduct) =>
    Boolean(p && ((p.idadeMinima || 0) >= 18 || (p.classificacaoLegal && p.classificacaoLegal !== 'sem_restricao')));

  const cartHasRestricted = orderForm.itens.some((it) =>
    isRestrictedProd(products.find((p) => p.id === it.productId))
  );

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderForm.itens.length === 0) {
      setErrorMsg('Adicione pelo menos um produto ao pedido.');
      return;
    }
    if (cartHasRestricted && !orderForm.verificacaoMaioridadeSolicitada) {
      setErrorMsg(
        'Conformidade Legal (+18): Confirme que o cliente foi informado sobre a apresentação obrigatória de documento oficial com foto.'
      );
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.createCommerceOrder({
        customerId: orderForm.customerId || undefined,
        clienteNome: orderForm.clienteNome,
        clienteTelefone: orderForm.clienteTelefone || undefined,
        enderecoEntrega: orderForm.enderecoEntrega || undefined,
        bairro: orderForm.bairro || undefined,
        cidade: orderForm.cidade || undefined,
        tipoAtendimento: orderForm.tipoAtendimento,
        taxaEntrega: parseFloat(orderForm.taxaEntrega) || 0,
        desconto: parseFloat(orderForm.desconto) || 0,
        formaPagamento: orderForm.formaPagamento,
        verificacaoMaioridadeSolicitada: orderForm.verificacaoMaioridadeSolicitada,
        observacoes: orderForm.observacoes || undefined,
        itens: orderForm.itens,
      });
      setSuccessMsg(res.message);
      setIsCreateOpen(false);
      setOrderForm({
        customerId: '',
        clienteNome: '',
        clienteTelefone: '',
        enderecoEntrega: '',
        bairro: '',
        cidade: '',
        tipoAtendimento: 'entrega',
        taxaEntrega: '0.00',
        desconto: '0.00',
        formaPagamento: 'pagamento_entrega',
        verificacaoMaioridadeSolicitada: false,
        observacoes: '',
        itens: [],
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatus = async (order: CommercialOrder, status: CommercialOrderStatus) => {
    if (status === 'entregue') {
      if (order.contemItemRestrito) {
        setDeliveryConfirmOrder(order);
        setDeliveryAgeChecked(false);
        return;
      }
    }
    if (status === 'cancelado') {
      setCancelOrder(order);
      setCancelReason('');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.updateCommerceOrderStatus(order.id, { status });
      setSuccessMsg(res.message);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!deliveryConfirmOrder) return;
    if (deliveryConfirmOrder.contemItemRestrito && !deliveryAgeChecked) {
      setErrorMsg('Confirme a conferência presencial de documento (+18) para concluir a entrega.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.updateCommerceOrderStatus(deliveryConfirmOrder.id, {
        status: 'entregue',
        verificacaoMaioridadeEntrega: deliveryAgeChecked,
      });
      setSuccessMsg(res.message);
      setDeliveryConfirmOrder(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao concluir pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelOrder || !cancelReason.trim()) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.updateCommerceOrderStatus(cancelOrder.id, {
        status: 'cancelado',
        motivoCancelamento: cancelReason.trim(),
      });
      setSuccessMsg(`${res.message} Estoque dos itens estornado automaticamente.`);
      setCancelOrder(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cancelar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const cartSubtotal = orderForm.itens.reduce((acc, it) => {
    const p = products.find((prod) => prod.id === it.productId);
    return acc + (p ? p.precoVenda * it.quantidade : 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#8B5CF6]" />
            Central de Pedidos — Delivery & Retirada no Balcão
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Reserva automática de estoque, rastreio de etapas, tempo de operação e bloqueio legal para itens +18.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Pedido</span>
        </button>
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

      {/* Filters */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#AAA6B5]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
            placeholder="Buscar código do pedido, cliente ou entregador..."
            className="w-full bg-[#0A0714] border border-[#262042] rounded-xl pl-9 pr-3 py-2 text-xs text-white"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="todos">Todos os Status</option>
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="todos">Entrega & Balcão</option>
            <option value="entrega">Somente Delivery</option>
            <option value="retirada_balcao">Retirada Balcão</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#AAA6B5]">Carregando pedidos...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#AAA6B5]">
            Nenhum pedido registrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262042] bg-[#0A0714]/60 text-[10px] uppercase text-[#AAA6B5]">
                  <th className="py-3 px-4">Pedido</th>
                  <th className="py-3 px-4">Cliente & Atendimento</th>
                  <th className="py-3 px-4">Itens</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262042]/50">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-[#1A1633]/30">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-white">{ord.codigoPedido}</div>
                      <div className="text-[10px] text-[#716A86] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(ord.iniciadoEm).toLocaleString('pt-BR')}</span>
                      </div>
                      {ord.contemItemRestrito && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                          +18 Verificação Obrigatória
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{ord.clienteNome}</div>
                      <div className="text-[11px] text-[#AAA6B5]">
                        {ord.tipoAtendimento === 'retirada_balcao'
                          ? 'Retirada no Balcão'
                          : ord.enderecoEntrega || 'Entrega'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[#AAA6B5]">
                      {ord.itens.map((it, idx) => (
                        <div key={idx}>
                          • {it.quantidade}x {it.nome}
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-400 tabular-nums">
                      R$ {ord.valorTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          STATUS_BADGES[ord.status]
                        }`}
                      >
                        {STATUS_LABELS[ord.status]}
                      </span>
                      {ord.duracaoOperacaoMinutos !== undefined && (
                        <div className="text-[10px] text-[#716A86] mt-1 tabular-nums">
                          {ord.duracaoOperacaoMinutos} min
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => setDetailOrder(ord)}
                          title="Timeline & Detalhes"
                          className="p-1.5 rounded-lg bg-[#1A1633] text-[#C4B5FD] hover:text-white"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {ord.status === 'recebido' && (
                          <button
                            onClick={() => handleQuickStatus(ord, 'em_separacao')}
                            disabled={submitting}
                            className="px-2 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-[10px] font-bold"
                          >
                            Separar
                          </button>
                        )}
                        {ord.status === 'em_separacao' && (
                          <button
                            onClick={() =>
                              handleQuickStatus(
                                ord,
                                ord.tipoAtendimento === 'retirada_balcao' ? 'entregue' : 'saiu_entrega'
                              )
                            }
                            disabled={submitting}
                            className="px-2 py-1 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[10px] font-bold"
                          >
                            {ord.tipoAtendimento === 'retirada_balcao' ? 'Entregar Balcão' : 'Despachar'}
                          </button>
                        )}
                        {ord.status === 'saiu_entrega' && (
                          <button
                            onClick={() => handleQuickStatus(ord, 'entregue')}
                            disabled={submitting}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                          >
                            Confirmar Entrega
                          </button>
                        )}
                        {ord.status !== 'entregue' && ord.status !== 'cancelado' && (
                          <button
                            onClick={() => handleQuickStatus(ord, 'cancelado')}
                            className="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px]"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121024] border border-[#262042] rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-white">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-[#AAA6B5] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#8B5CF6]" />
              Novo Pedido Comercial
            </h3>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                    Cliente Cadastrado (Opcional)
                  </label>
                  <select
                    value={orderForm.customerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">Preencher dados manualmente...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.telefone ? `(${c.telefone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                    Nome do Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={orderForm.clienteNome}
                    onChange={(e) => setOrderForm({ ...orderForm, clienteNome: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={orderForm.clienteTelefone}
                    onChange={(e) => setOrderForm({ ...orderForm, clienteTelefone: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Atendimento</label>
                  <select
                    value={orderForm.tipoAtendimento}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, tipoAtendimento: e.target.value as any })
                    }
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="entrega">Delivery / Entrega</option>
                    <option value="retirada_balcao">Retirada no Balcão</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Pagamento</label>
                  <select
                    value={orderForm.formaPagamento}
                    onChange={(e) => setOrderForm({ ...orderForm, formaPagamento: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="pagamento_entrega">Na Entrega (Maquininha/Dinheiro)</option>
                    <option value="pix">PIX</option>
                    <option value="cartao_credito">Cartão Crédito</option>
                    <option value="cartao_debito">Cartão Débito</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>

                {orderForm.tipoAtendimento === 'entrega' && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                      Endereço de Entrega *
                    </label>
                    <input
                      type="text"
                      required
                      value={orderForm.enderecoEntrega}
                      onChange={(e) => setOrderForm({ ...orderForm, enderecoEntrega: e.target.value })}
                      placeholder="Rua, número, complemento, bairro"
                      className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                )}
              </div>

              {/* Cart Items */}
              <div className="bg-[#0A0714] border border-[#262042] rounded-2xl p-3 space-y-2">
                <span className="text-xs font-bold text-white block">Itens do Pedido</span>
                <div className="flex gap-2">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 bg-[#121024] border border-[#262042] rounded-xl px-2.5 py-2 text-xs text-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — R$ {p.precoVenda.toFixed(2)} (Est: {p.estoqueAtual})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    className="w-20 bg-[#121024] border border-[#262042] rounded-xl px-2 py-2 text-xs text-white text-center"
                  />
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-2 bg-[#8B5CF6] text-white rounded-xl text-xs font-bold"
                  >
                    + Incluir
                  </button>
                </div>

                {orderForm.itens.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-[#262042]">
                    {orderForm.itens.map((it) => {
                      const p = products.find((prod) => prod.id === it.productId);
                      return (
                        <div
                          key={it.productId}
                          className="flex items-center justify-between text-xs bg-[#121024] px-3 py-2 rounded-xl"
                        >
                          <span className="text-white">
                            {it.quantidade}x {p?.nome} {isRestrictedProd(p) ? '(+18)' : ''}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-400 font-bold tabular-nums">
                              R$ {((p?.precoVenda || 0) * it.quantidade).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setOrderForm((prev) => ({
                                  ...prev,
                                  itens: prev.itens.filter((x) => x.productId !== it.productId),
                                }))
                              }
                              className="text-rose-400 hover:text-white"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {cartHasRestricted && (
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Pedido contém bebida alcoólica ou tabaco (+18 anos)</span>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-amber-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderForm.verificacaoMaioridadeSolicitada}
                      onChange={(e) =>
                        setOrderForm({
                          ...orderForm,
                          verificacaoMaioridadeSolicitada: e.target.checked,
                        })
                      }
                      className="w-4 h-4 mt-0.5 rounded text-amber-500"
                    />
                    <span>
                      Confirmo que o destinatário foi avisado sobre a exigência legal de documento oficial com foto comprovando maioridade (+18) na entrega ou retirada.
                    </span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                    Taxa de Entrega (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={orderForm.taxaEntrega}
                    onChange={(e) => setOrderForm({ ...orderForm, taxaEntrega: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={orderForm.desconto}
                    onChange={(e) => setOrderForm({ ...orderForm, desconto: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-[#262042]">
                <span>Total do Pedido:</span>
                <span className="text-emerald-400 text-lg tabular-nums">
                  R${' '}
                  {Math.max(
                    0,
                    cartSubtotal +
                      (parseFloat(orderForm.taxaEntrega) || 0) -
                      (parseFloat(orderForm.desconto) || 0)
                  ).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-[#1A1633] text-xs text-[#AAA6B5] rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl"
                >
                  {submitting ? 'Registrando...' : 'Criar Pedido & Reservar Estoque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* +18 Delivery Verification Modal */}
      {deliveryConfirmOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121024] border border-amber-500/40 rounded-2xl p-6 max-w-md w-full text-white space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-amber-300">
              <ShieldAlert className="w-5 h-5" />
              Conferência Presencial Obrigatória (+18)
            </h3>
            <p className="text-xs text-[#AAA6B5]">
              O pedido <strong className="text-white">{deliveryConfirmOrder.codigoPedido}</strong> contém bebida alcoólica ou tabaco.
            </p>
            <label className="flex items-start gap-2 text-xs text-white cursor-pointer p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
              <input
                type="checkbox"
                checked={deliveryAgeChecked}
                onChange={(e) => setDeliveryAgeChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-emerald-500"
              />
              <span>
                Declaro que o documento de identidade oficial foi conferido presencialmente comprovando idade igual ou superior a 18 anos.
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeliveryConfirmOrder(null)}
                className="px-4 py-2 bg-[#1A1633] text-xs text-[#AAA6B5] rounded-xl"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmDelivery}
                disabled={submitting || !deliveryAgeChecked}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white rounded-xl"
              >
                Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmCancel}
            className="bg-[#121024] border border-[#262042] rounded-2xl p-6 max-w-md w-full text-white space-y-4"
          >
            <h3 className="text-sm font-bold text-rose-400">
              Cancelar Pedido {cancelOrder.codigoPedido}
            </h3>
            <p className="text-xs text-[#AAA6B5]">
              O estoque reservado para os itens será devolvido automaticamente.
            </p>
            <input
              type="text"
              required
              placeholder="Informe o motivo do cancelamento..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelOrder(null)}
                className="px-4 py-2 bg-[#1A1633] text-xs text-[#AAA6B5] rounded-xl"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-rose-600 text-xs font-bold text-white rounded-xl"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Detail / Timeline Modal */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121024] border border-[#262042] rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto relative text-white space-y-4">
            <button
              onClick={() => setDetailOrder(null)}
              className="absolute top-4 right-4 text-[#AAA6B5] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-bold">
                {detailOrder.codigoPedido} — {detailOrder.clienteNome}
              </h3>
              <p className="text-xs text-[#AAA6B5]">
                Status atual: {STATUS_LABELS[detailOrder.status]} • Total: R$ {detailOrder.valorTotal.toFixed(2)}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white mb-2">Linha do Tempo do Pedido</h4>
              <div className="space-y-2">
                {detailOrder.historicoStatus.map((h, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-[#0A0714] border border-[#262042] text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-[#C4B5FD]">{STATUS_LABELS[h.status] || h.status}</span>
                      <span className="text-[11px] text-[#716A86]">
                        {new Date(h.dataHora).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#AAA6B5]">
                      {h.autorNome} {h.observacao ? `— ${h.observacao}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {detailOrder.ocorrencias.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-white mb-2">Ocorrências de Entrega</h4>
                <div className="space-y-2">
                  {detailOrder.ocorrencias.map((occ) => (
                    <div key={occ.id} className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs">
                      <div className="text-amber-200">{occ.descricao}</div>
                      <div className="text-[10px] text-[#716A86]">
                        {occ.autorNome} • {new Date(occ.dataHora).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
