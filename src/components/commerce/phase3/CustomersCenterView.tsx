import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { CommercialCustomer } from '../../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Plus,
  Search,
  ShieldCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';

export const CustomersCenterView: React.FC = () => {
  const [customers, setCustomers] = useState<(CommercialCustomer & { totalPedidos?: number; ultimoPedidoEm?: string | null })[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialCustomer | null>(null);
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    documento: '',
    endereco: '',
    bairro: '',
    cidade: '',
    observacoes: '',
    maioridadeVerificada: false,
    consentimentoLgpd: true,
  });

  const [anonymizeTarget, setAnonymizeTarget] = useState<CommercialCustomer | null>(null);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getCommerceCustomers(search);
      setCustomers(res.customers || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      nome: '',
      telefone: '',
      email: '',
      documento: '',
      endereco: '',
      bairro: '',
      cidade: '',
      observacoes: '',
      maioridadeVerificada: false,
      consentimentoLgpd: true,
    });
    setIsModalOpen(true);
  };

  const openEdit = (c: CommercialCustomer) => {
    setEditing(c);
    setForm({
      nome: c.nome || '',
      telefone: c.telefone || '',
      email: c.email || '',
      documento: c.documento || '',
      endereco: c.endereco || '',
      bairro: c.bairro || '',
      cidade: c.cidade || '',
      observacoes: c.observacoes || '',
      maioridadeVerificada: c.maioridadeVerificada,
      consentimentoLgpd: c.consentimentoLgpd,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      if (editing) {
        await api.updateCommerceCustomer(editing.id, form);
        setSuccessMsg('Cliente atualizado.');
      } else {
        await api.createCommerceCustomer(form);
        setSuccessMsg('Cliente cadastrado com consentimento LGPD registrado.');
      }
      setIsModalOpen(false);
      loadCustomers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnonymize = async () => {
    if (!anonymizeTarget) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.anonymizeCommerceCustomer(anonymizeTarget.id);
      setSuccessMsg(res.message);
      setAnonymizeTarget(null);
      loadCustomers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao anonimizar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8B5CF6]" />
            Gestão de Clientes & Privacidade (LGPD)
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Base operacional restrita à empresa, controle de consentimento LGPD, verificação +18 e anonimização definitiva sob demanda.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
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

      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#AAA6B5]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
            placeholder="Buscar cliente por nome, telefone ou bairro..."
            className="w-full bg-[#0A0714] border border-[#262042] rounded-xl pl-9 pr-3 py-2 text-xs text-white"
          />
        </div>
        <button
          onClick={loadCustomers}
          className="px-4 py-2 bg-[#1A1633] hover:bg-[#262042] text-xs font-semibold text-white rounded-xl"
        >
          Buscar
        </button>
      </div>

      <div className="bg-[#121024] border border-[#262042] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#AAA6B5]">Carregando clientes...</div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#AAA6B5]">Nenhum cliente cadastrado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262042] bg-[#0A0714]/60 text-[10px] uppercase text-[#AAA6B5]">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Contato / Bairro</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4 text-center">Conformidade</th>
                  <th className="py-3 px-4 text-right">Pedidos</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262042]/50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#1A1633]/30">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{c.nome}</div>
                      {c.anonimizado && (
                        <span className="text-[10px] text-amber-400 font-semibold">
                          Anonimizado LGPD
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#AAA6B5]">
                      <div>{c.telefone || '-'}</div>
                      <div className="text-[11px] text-[#716A86]">
                        {[c.bairro, c.cidade].filter(Boolean).join(' • ') || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#C4B5FD]">
                      {c.documento || '-'}
                    </td>
                    <td className="py-3 px-4 text-center space-y-1">
                      {c.maioridadeVerificada && (
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                          +18 Verificado
                        </span>
                      )}
                      {c.consentimentoLgpd && (
                        <div className="text-[10px] text-[#716A86] flex items-center justify-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-[#8B5CF6]" />
                          <span>LGPD OK</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-white font-bold">
                      {c.totalPedidos ?? 0}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!c.anonimizado && (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEdit(c)}
                            title="Editar"
                            className="p-1.5 rounded-lg bg-[#1A1633] text-[#C4B5FD] hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setAnonymizeTarget(c)}
                            title="Anonimizar LGPD"
                            className="p-1.5 rounded-lg bg-[#1A1633] text-amber-300 hover:bg-amber-600 hover:text-white"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121024] border border-[#262042] rounded-3xl p-6 max-w-lg w-full relative text-white shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-[#AAA6B5] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold mb-4">
              {editing ? 'Editar Cliente' : 'Cadastrar Cliente'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Nome *</label>
                  <input
                    type="text"
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
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
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">CPF</label>
                  <input
                    type="text"
                    value={form.documento}
                    onChange={(e) => setForm({ ...form, documento: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Endereço</label>
                  <input
                    type="text"
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Bairro</label>
                  <input
                    type="text"
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Cidade</label>
                  <input
                    type="text"
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.maioridadeVerificada}
                      onChange={(e) => setForm({ ...form, maioridadeVerificada: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span>Maioridade (+18) verificada documentalmente</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.consentimentoLgpd}
                      onChange={(e) => setForm({ ...form, consentimentoLgpd: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span>Titular consentiu com armazenamento operacional (LGPD)</span>
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
                  className="px-5 py-2 bg-[#8B5CF6] text-xs font-bold text-white rounded-xl"
                >
                  {submitting ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LGPD Anonymize Confirmation Modal */}
      {anonymizeTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121024] border border-amber-500/40 rounded-2xl p-6 max-w-md w-full text-white space-y-4">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <UserX className="w-5 h-5" />
              Anonimização LGPD Irreversível
            </h3>
            <p className="text-xs text-[#AAA6B5] leading-relaxed">
              Esta ação apagará permanentemente nome, telefone, e-mail, documento e endereço de{' '}
              <strong className="text-white">{anonymizeTarget.nome}</strong> neste cadastro e nos pedidos vinculados, mantendo apenas os registros fiscais/financeiros agregados.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAnonymizeTarget(null)}
                className="px-4 py-2 bg-[#1A1633] text-xs text-[#AAA6B5] rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleAnonymize}
                disabled={submitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white rounded-xl"
              >
                Confirmar Anonimização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
