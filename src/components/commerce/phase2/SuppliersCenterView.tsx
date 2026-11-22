import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialPurchase, CommercialSupplier } from '../../../types';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit2,
  History,
  Mail,
  Phone,
  Plus,
  Search,
  Truck,
  X,
} from 'lucide-react';

interface SuppliersCenterViewProps {
  modulo: 'adega' | 'tabacaria';
}

export const SuppliersCenterView: React.FC<SuppliersCenterViewProps> = ({ modulo }) => {
  const [suppliers, setSuppliers] = useState<CommercialSupplier[]>([]);
  const [costComparisons, setCostComparisons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'todos' | 'adega' | 'tabacaria' | 'ambos'>('todos');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialSupplier | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpjCpf: '',
    contatoNome: '',
    telefone: '',
    email: '',
    endereco: '',
    segmento: modulo as 'adega' | 'tabacaria' | 'ambos',
    prazoEntregaDias: '3',
    condicaoPagamento: 'Boleto 30d',
    observacoes: '',
    ativo: true,
  });

  // History Modal
  const [historyData, setHistoryData] = useState<{
    supplier: CommercialSupplier;
    purchases: CommercialPurchase[];
    totalCompras: number;
    totalComprado: number;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [supRes, profRes] = await Promise.all([
        api.getCommerceSuppliers(),
        api.getCommerceProfitability({ modulo }),
      ]);
      setSuppliers(supRes.suppliers || []);
      setCostComparisons(profRes.metrics?.comparativoCustosFornecedores || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar fornecedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modulo]);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({
      razaoSocial: '',
      nomeFantasia: '',
      cnpjCpf: '',
      contatoNome: '',
      telefone: '',
      email: '',
      endereco: '',
      segmento: modulo,
      prazoEntregaDias: '3',
      condicaoPagamento: 'Boleto 30d',
      observacoes: '',
      ativo: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: CommercialSupplier) => {
    setEditing(s);
    setForm({
      razaoSocial: s.razaoSocial || '',
      nomeFantasia: s.nomeFantasia || '',
      cnpjCpf: s.cnpjCpf || '',
      contatoNome: s.contatoNome || '',
      telefone: s.telefone || '',
      email: s.email || '',
      endereco: s.endereco || '',
      segmento: s.segmento || 'ambos',
      prazoEntregaDias: String(s.prazoEntregaDias ?? 3),
      condicaoPagamento: s.condicaoPagamento || '',
      observacoes: s.observacoes || '',
      ativo: s.ativo,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razaoSocial.trim()) {
      setErrorMsg('Razão Social ou Nome do fornecedor é obrigatório.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const payload = {
        ...form,
        prazoEntregaDias: parseInt(form.prazoEntregaDias, 10) || 0,
      };
      if (editing) {
        await api.updateCommerceSupplier(editing.id, payload);
        setSuccessMsg('Fornecedor atualizado com sucesso.');
      } else {
        await api.createCommerceSupplier(payload);
        setSuccessMsg('Fornecedor cadastrado com sucesso.');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar fornecedor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenHistory = async (id: string) => {
    try {
      setLoadingHistory(true);
      const res = await api.getCommerceSupplierHistory(id);
      setHistoryData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar histórico do fornecedor.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const filtered = suppliers.filter((s) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      s.razaoSocial.toLowerCase().includes(term) ||
      (s.nomeFantasia && s.nomeFantasia.toLowerCase().includes(term)) ||
      (s.cnpjCpf && s.cnpjCpf.toLowerCase().includes(term));
    const matchesSeg = segmentFilter === 'todos' || s.segmento === segmentFilter;
    return matchesSearch && matchesSeg;
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#8B5CF6]" />
            Central de Fornecedores — {modulo === 'adega' ? 'Adega' : 'Tabacaria'}
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Cadastro completo, prazo de entrega, condições comerciais, histórico de compras e comparativo de custo.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Fornecedor</span>
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
            placeholder="Buscar por razão social, fantasia ou CNPJ/CPF..."
            className="w-full bg-[#0A0714] border border-[#262042] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#716A86] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>
        <select
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value as any)}
          className="bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
        >
          <option value="todos">Todos os Segmentos</option>
          <option value="adega">Adega & Bebidas</option>
          <option value="tabacaria">Tabacaria & Headshop</option>
          <option value="ambos">Ambos</option>
        </select>
      </div>

      {/* Suppliers Table */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#AAA6B5]">Carregando fornecedores...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#AAA6B5]">
            Nenhum fornecedor encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262042] bg-[#0A0714]/60 text-[10px] font-bold text-[#AAA6B5] uppercase">
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Condição / Prazo</th>
                  <th className="py-3 px-4">Segmento</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262042]/50">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#1A1633]/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{s.nomeFantasia || s.razaoSocial}</div>
                      {s.nomeFantasia && s.nomeFantasia !== s.razaoSocial && (
                        <div className="text-[11px] text-[#716A86]">{s.razaoSocial}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#C4B5FD]">
                      {s.cnpjCpf || 'Não informado'}
                    </td>
                    <td className="py-3 px-4 text-[#AAA6B5] space-y-0.5">
                      {s.contatoNome && <div className="text-white">{s.contatoNome}</div>}
                      {s.telefone && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <Phone className="w-3 h-3 text-[#8B5CF6]" />
                          <span>{s.telefone}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <Mail className="w-3 h-3 text-[#8B5CF6]" />
                          <span>{s.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#AAA6B5]">
                      <div>{s.condicaoPagamento || '-'}</div>
                      <div className="text-[11px] text-[#716A86]">
                        Prazo: {s.prazoEntregaDias ?? '-'} dia(s)
                      </div>
                    </td>
                    <td className="py-3 px-4 capitalize text-[#C4B5FD]">{s.segmento}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          s.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {s.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Editar Fornecedor"
                          className="p-1.5 rounded-lg bg-[#1A1633] text-[#C4B5FD] hover:text-white hover:bg-[#8B5CF6]/30 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenHistory(s.id)}
                          title="Histórico de Compras"
                          className="p-1.5 rounded-lg bg-[#1A1633] text-emerald-300 hover:text-white hover:bg-emerald-600/30 transition"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Price Comparison Section */}
      {costComparisons.length > 0 && (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#8B5CF6]" />
            Comparação de Custos Praticados por Produto
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#262042] text-[10px] uppercase text-[#AAA6B5]">
                  <th className="py-2 pr-3">Produto</th>
                  <th className="py-2 px-3">Fornecedor</th>
                  <th className="py-2 px-3 text-right">Último Custo</th>
                  <th className="py-2 px-3 text-right">Menor Histórico</th>
                  <th className="py-2 pl-3 text-right">Maior Histórico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262042]/50">
                {costComparisons.flatMap((entry: any) =>
                  entry.fornecedores.map((f: any, idx: number) => (
                    <tr key={`${entry.productId}-${f.fornecedorId || idx}`}>
                      <td className="py-2 pr-3 font-medium text-white">
                        {idx === 0 ? entry.productNome : ''}
                      </td>
                      <td className="py-2 px-3 text-[#C4B5FD]">{f.fornecedorNome}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-white font-bold">
                        R$ {Number(f.ultimoCusto).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-emerald-400">
                        R$ {Number(f.menorCusto).toFixed(2)}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums text-amber-300">
                        R$ {Number(f.maiorCusto).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121024] border border-[#262042] rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-white">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-[#AAA6B5] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#8B5CF6]" />
              {editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.razaoSocial}
                    onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Nome Fantasia</label>
                  <input
                    type="text"
                    value={form.nomeFantasia}
                    onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">CNPJ / CPF</label>
                  <input
                    type="text"
                    value={form.cnpjCpf}
                    onChange={(e) => setForm({ ...form, cnpjCpf: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Contato</label>
                  <input
                    type="text"
                    value={form.contatoNome}
                    onChange={(e) => setForm({ ...form, contatoNome: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Telefone</label>
                  <input
                    type="text"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Segmento</label>
                  <select
                    value={form.segmento}
                    onChange={(e) => setForm({ ...form, segmento: e.target.value as any })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="adega">Adega & Bebidas</option>
                    <option value="tabacaria">Tabacaria & Headshop</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                    Prazo Entrega (dias)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.prazoEntregaDias}
                    onChange={(e) => setForm({ ...form, prazoEntregaDias: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                    Condição de Pagamento
                  </label>
                  <input
                    type="text"
                    value={form.condicaoPagamento}
                    onChange={(e) => setForm({ ...form, condicaoPagamento: e.target.value })}
                    placeholder="Ex: Boleto 28/56d, PIX na entrega"
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                      className="w-4 h-4 rounded text-[#8B5CF6]"
                    />
                    <span>Fornecedor Ativo</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#262042]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#1A1633] text-xs text-[#AAA6B5] rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl"
                >
                  {submitting ? 'Salvando...' : 'Salvar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier History Modal */}
      {(historyData || loadingHistory) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121024] border border-[#262042] rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative text-white">
            <button
              onClick={() => setHistoryData(null)}
              className="absolute top-4 right-4 text-[#AAA6B5] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-[#AAA6B5]">Carregando histórico...</div>
            ) : historyData ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Histórico — {historyData.supplier.nomeFantasia || historyData.supplier.razaoSocial}
                  </h3>
                  <p className="text-xs text-[#AAA6B5] tabular-nums">
                    {historyData.totalCompras} pedido(s) • Total comprado: R${' '}
                    {Number(historyData.totalComprado).toFixed(2)}
                  </p>
                </div>

                {historyData.purchases.length === 0 ? (
                  <p className="text-xs text-[#AAA6B5] py-4">
                    Nenhuma compra registrada para este fornecedor até o momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {historyData.purchases.map((pur) => (
                      <div
                        key={pur.id}
                        className="p-3 rounded-xl bg-[#0A0714] border border-[#262042] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {pur.dataCompra} • NF {pur.numeroNota || 'S/N'} ({pur.status})
                          </div>
                          <div className="text-[11px] text-[#AAA6B5]">
                            {pur.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', ')}
                          </div>
                        </div>
                        <div className="font-bold text-emerald-400 tabular-nums">
                          R$ {Number(pur.valorTotal).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
