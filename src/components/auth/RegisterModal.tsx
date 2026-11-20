import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  Briefcase,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Warehouse,
  Truck,
  Building,
  FileCheck2
} from 'lucide-react';

type ModuleOption = 'predial' | 'logistica' | 'wms';

function formatCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calcDigit = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(base[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const d1 = calcDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(digits[12]) && d2 === Number(digits[13]);
}

const MODULE_META: Record<
  ModuleOption,
  { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }
> = {
  predial: {
    title: 'Predial',
    subtitle: 'Moradores, unidades, encomendas com PIN, entregadores e portaria',
    icon: Building
  },
  logistica: {
    title: 'Logística',
    subtitle: 'Entregas, roteirização, importação de planilhas, motoristas e comprovantes',
    icon: Truck
  },
  wms: {
    title: 'WMS',
    subtitle: 'Centros de distribuição, endereçamento ruas/prateleiras/posições e estoque',
    icon: Warehouse
  }
};

export const RegisterModal: React.FC = () => {
  const {
    isRegisterModalOpen,
    setIsRegisterModalOpen,
    openLoginModal,
    registerCompany,
    selectedPlanForCheckout
  } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    companyEmail: '',
    telefone: '',
    endereco: '',
    segmento: '',
    modulos: ['predial', 'logistica', 'wms'] as ModuleOption[],
    responsavel: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isRegisterModalOpen) return null;

  const resetAndClose = () => {
    setError(null);
    setStep(1);
    setFormData(prev => ({
      ...prev,
      adminPassword: '',
      confirmPassword: ''
    }));
    setIsRegisterModalOpen(false);
  };

  const handleBackToLogin = () => {
    resetAndClose();
    openLoginModal('login');
  };

  const handleModuleToggle = (mod: ModuleOption) => {
    setError(null);
    if (formData.modulos.includes(mod)) {
      if (formData.modulos.length === 1) return;
      setFormData({ ...formData, modulos: formData.modulos.filter(m => m !== mod) });
    } else {
      setFormData({ ...formData, modulos: [...formData.modulos, mod] });
    }
  };

  const validateStep = (targetStep: 1 | 2 | 3): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (targetStep === 1) {
      if (formData.nomeFantasia.trim().length < 2) {
        return 'Informe o Nome Fantasia da empresa.';
      }
      if (formData.razaoSocial.trim().length < 2) {
        return 'Informe a Razão Social da empresa.';
      }
      if (!isValidCnpj(formData.cnpj)) {
        return 'Informe um CNPJ válido com 14 dígitos.';
      }
      if (!emailRegex.test(formData.companyEmail.trim())) {
        return 'Informe um e-mail corporativo válido.';
      }
      if (formData.telefone.replace(/\D/g, '').length < 8) {
        return 'Informe um telefone/WhatsApp válido da empresa.';
      }
      if (formData.endereco.trim().length < 4) {
        return 'Informe o endereço completo da empresa.';
      }
      if (formData.segmento.trim().length < 2) {
        return 'Informe o segmento de atuação da empresa.';
      }
    }

    if (targetStep === 2) {
      if (formData.modulos.length === 0) {
        return 'Selecione pelo menos um módulo contratado (Predial, Logística ou WMS).';
      }
    }

    if (targetStep === 3) {
      if (formData.responsavel.trim().length < 2) {
        return 'Informe o nome completo do administrador responsável.';
      }
      if (!emailRegex.test(formData.adminEmail.trim())) {
        return 'Informe um e-mail de acesso válido para o responsável.';
      }
      if (formData.adminPhone.replace(/\D/g, '').length < 8) {
        return 'Informe um telefone válido para o responsável.';
      }
      if (formData.adminPassword.length < 8) {
        return 'A senha do administrador deve possuir pelo menos 8 caracteres.';
      }
      if (formData.adminPassword !== formData.confirmPassword) {
        return 'As senhas informadas não coincidem.';
      }
    }

    return null;
  };

  const handleNextStep = () => {
    const validationError = validateStep(step as 1 | 2 | 3);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep(prev => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      handleNextStep();
      return;
    }

    for (const s of [1, 2, 3] as const) {
      const errMsg = validateStep(s);
      if (errMsg) {
        setError(errMsg);
        setStep(s);
        return;
      }
    }

    setError(null);
    setLoading(true);
    try {
      await registerCompany({
        nomeFantasia: formData.nomeFantasia.trim(),
        razaoSocial: formData.razaoSocial.trim(),
        cnpj: formData.cnpj.trim(),
        companyEmail: formData.companyEmail.trim().toLowerCase(),
        telefone: formData.telefone.trim(),
        endereco: formData.endereco.trim(),
        segmento: formData.segmento.trim(),
        modulos: formData.modulos,
        responsavel: formData.responsavel.trim(),
        email: formData.adminEmail.trim().toLowerCase(),
        adminEmail: formData.adminEmail.trim().toLowerCase(),
        adminPhone: formData.adminPhone.trim(),
        adminPassword: formData.adminPassword,
        confirmPassword: formData.confirmPassword,
        strictValidation: true,
        planoId: selectedPlanForCheckout || 'plan_demo'
      });
      setStep(1);
      setFormData(prev => ({
        ...prev,
        adminPassword: '',
        confirmPassword: ''
      }));
    } catch (err: any) {
      setError(err.message || 'Falha ao cadastrar empresa');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = [
    { id: 1, title: 'Empresa' },
    { id: 2, title: 'Módulos' },
    { id: 3, title: 'Responsável' },
    { id: 4, title: 'Confirmação' }
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#1D1B24] border border-[#393442] rounded-2xl p-6 shadow-2xl text-[#F5F3FA] my-8">
        <button
          type="button"
          onClick={resetAndClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-[#AAA6B5] hover:text-[#F5F3FA] p-1 rounded-lg hover:bg-[#25222D] transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6] shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#F5F3FA]">Primeiro Acesso — Cadastro da Empresa</h2>
            <p className="text-xs text-[#AAA6B5]">
              Configure sua empresa e crie o administrador responsável em ambiente isolado
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {stepLabels.map(item => {
            const active = step === item.id;
            const completed = step > item.id;
            return (
              <div
                key={item.id}
                className={`px-2.5 py-2 rounded-xl border text-center transition ${
                  active
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#F5F3FA]'
                    : completed
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-[#393442] bg-[#25222D] text-[#AAA6B5]'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider">Etapa {item.id}</div>
                <div className="text-xs font-semibold truncate">{item.title}</div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* STEP 1: COMPANY DATA */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">Nome Fantasia *</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.nomeFantasia}
                    onChange={e => setFormData({ ...formData, nomeFantasia: e.target.value })}
                    placeholder="Ex: TransLog Express"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">Razão Social *</label>
                <input
                  type="text"
                  required
                  value={formData.razaoSocial}
                  onChange={e => setFormData({ ...formData, razaoSocial: e.target.value })}
                  placeholder="Ex: TransLog Transportes Ltda"
                  className="w-full bg-[#25222D] border border-[#393442] rounded-xl px-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">CNPJ *</label>
                <input
                  type="text"
                  required
                  value={formData.cnpj}
                  onChange={e => setFormData({ ...formData, cnpj: formatCnpjInput(e.target.value) })}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-[#25222D] border border-[#393442] rounded-xl px-3 py-2 text-sm text-[#F5F3FA] font-mono focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">E-mail Corporativo *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={formData.companyEmail}
                    onChange={e => setFormData({ ...formData, companyEmail: e.target.value })}
                    placeholder="contato@empresa.com.br"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">Telefone / WhatsApp *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.telefone}
                    onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">Segmento *</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.segmento}
                    onChange={e => setFormData({ ...formData, segmento: e.target.value })}
                    placeholder="Ex: Logística, Condomínio, Distribuição"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">Endereço *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.endereco}
                    onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Rua, Número, Bairro, Cidade/UF"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CONTRACTED MODULES */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="text-xs text-[#AAA6B5]">
                Selecione os módulos contratados que serão habilitados para sua empresa:
              </div>
              <div className="grid grid-cols-1 gap-3">
                {(['predial', 'logistica', 'wms'] as ModuleOption[]).map(mod => {
                  const meta = MODULE_META[mod];
                  const Icon = meta.icon;
                  const selected = formData.modulos.includes(mod);
                  return (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => handleModuleToggle(mod)}
                      className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between gap-3 ${
                        selected
                          ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#F5F3FA]'
                          : 'border-[#393442] bg-[#25222D] text-[#AAA6B5] hover:border-[#524B61]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            selected ? 'bg-[#8B5CF6]/25 text-[#C4B5FD]' : 'bg-[#1D1B24] text-[#AAA6B5]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#F5F3FA]">{meta.title}</div>
                          <div className="text-xs text-[#AAA6B5]">{meta.subtitle}</div>
                        </div>
                      </div>
                      <CheckCircle2
                        className={`w-5 h-5 shrink-0 ${selected ? 'text-[#8B5CF6]' : 'text-[#393442]'}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: RESPONSIBLE ADMIN DATA */}
          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">Nome Completo do Responsável *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.responsavel}
                    onChange={e => setFormData({ ...formData, responsavel: e.target.value })}
                    placeholder="Nome completo do administrador da empresa"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">E-mail de Acesso *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={formData.adminEmail}
                    onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                    placeholder="admin@suaempresa.com.br"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">Telefone do Responsável *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.adminPhone}
                    onChange={e => setFormData({ ...formData, adminPhone: e.target.value })}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">Senha de Acesso *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={formData.adminPassword}
                    onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">Confirmar Senha *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Repita a senha"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SUMMARY & CONFIRMATION */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="p-3.5 bg-[#25222D] border border-[#393442] rounded-xl space-y-1.5 text-xs">
                <div className="font-bold text-[#C4B5FD] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Dados da Empresa</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[#AAA6B5]">
                  <div>Nome Fantasia: <strong className="text-[#F5F3FA]">{formData.nomeFantasia}</strong></div>
                  <div>Razão Social: <strong className="text-[#F5F3FA]">{formData.razaoSocial}</strong></div>
                  <div>CNPJ: <strong className="font-mono text-[#F5F3FA]">{formData.cnpj}</strong></div>
                  <div>Segmento: <strong className="text-[#F5F3FA]">{formData.segmento}</strong></div>
                  <div>E-mail Corporativo: <strong className="text-[#F5F3FA]">{formData.companyEmail}</strong></div>
                  <div>Telefone / WhatsApp: <strong className="text-[#F5F3FA]">{formData.telefone}</strong></div>
                  <div className="sm:col-span-2">Endereço: <strong className="text-[#F5F3FA]">{formData.endereco}</strong></div>
                </div>
              </div>

              <div className="p-3.5 bg-[#25222D] border border-[#393442] rounded-xl space-y-1.5 text-xs">
                <div className="font-bold text-[#C4B5FD] flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Módulos Contratados</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.modulos.map(m => (
                    <span
                      key={m}
                      className="px-2.5 py-1 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#C4B5FD] font-semibold text-xs"
                    >
                      {MODULE_META[m].title}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-[#25222D] border border-[#393442] rounded-xl space-y-1.5 text-xs">
                <div className="font-bold text-[#C4B5FD] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Administrador Responsável (company_admin)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[#AAA6B5]">
                  <div>Nome Completo: <strong className="text-[#F5F3FA]">{formData.responsavel}</strong></div>
                  <div>E-mail de Acesso: <strong className="text-[#F5F3FA]">{formData.adminEmail}</strong></div>
                  <div>Telefone: <strong className="text-[#F5F3FA]">{formData.adminPhone}</strong></div>
                  <div>Perfil: <strong className="text-emerald-400">Administrador da Empresa</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#393442]">
            {step > 1 ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setError(null);
                  setStep(prev => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev));
                }}
                className="px-4 py-2.5 rounded-xl bg-[#25222D] hover:bg-[#2F2B39] border border-[#393442] text-xs font-semibold text-[#F5F3FA] transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-xs font-medium text-[#C4B5FD] hover:text-[#8B5CF6] transition underline-offset-2 hover:underline"
              >
                Já tenho acesso — Voltar ao login
              </button>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-[#7C3AED]/25"
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-[#7C3AED]/25 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Concluir Cadastro</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
