import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { OnboardingStatus } from '../../types';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
} from 'lucide-react';

export const FirstAccessOnboardingView: React.FC = () => {
  const {
    user,
    isMaster,
    navigateToPath,
    openLoginModal,
    completeInitialOnboarding,
    refreshOnboardingStatus,
  } = useAuth();

  const [checkingStatus, setCheckingStatus] = useState(true);
  const [serverStatus, setServerStatus] = useState<OnboardingStatus | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<{
    message: string;
    keepMasterSession: boolean;
  } | null>(null);

  // Step 1: Company initial setup
  const [nomePlataforma, setNomePlataforma] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [segmento, setSegmento] = useState('Logística e Gestão Predial');
  const [tipoOperacao, setTipoOperacao] = useState<
    'integrada' | 'logistica' | 'expedicao' | 'predial'
  >('integrada');
  const [modulos, setModulos] = useState<('logistica' | 'predial')[]>(['logistica', 'predial']);

  // Step 2: Responsible Admin
  const [adminMode, setAdminMode] = useState<'create' | 'link'>('create');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const loadStatus = async () => {
    setCheckingStatus(true);
    setError(null);
    try {
      const ob = isMaster ? await api.getMasterOnboarding() : await api.getOnboardingStatus();
      setServerStatus(ob);
      if (ob.plataforma) {
        setNomePlataforma(ob.plataforma);
      }
      await refreshOnboardingStatus();
    } catch (err: any) {
      setError(err.message || 'Não foi possível verificar o status do primeiro acesso.');
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [isMaster]);

  const handleToggleModule = (mod: 'logistica' | 'predial') => {
    setModulos((prev) => {
      if (prev.includes(mod)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mod);
      }
      return [...prev, mod];
    });
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (nomeFantasia.trim().length < 2) {
      setError('Informe o Nome Fantasia da empresa (mínimo 2 caracteres).');
      return;
    }
    if (telefone.replace(/\D/g, '').length < 8) {
      setError('Informe um Telefone / WhatsApp válido (mínimo 8 dígitos).');
      return;
    }
    const cnpjDigits = cnpj.replace(/\D/g, '');
    if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) {
      setError('CNPJ inválido: informe os 14 dígitos ou deixe o campo em branco.');
      return;
    }
    if (companyEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail.trim())) {
      setError('E-mail corporativo da empresa inválido.');
      return;
    }
    setStep(2);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = adminEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Informe um e-mail válido para o administrador responsável.');
      return;
    }

    if (adminMode === 'create') {
      if (adminName.trim().length < 2) {
        setError('Informe o nome completo do administrador responsável.');
        return;
      }
      if (adminPassword.length < 8) {
        setError('A senha do administrador deve possuir pelo menos 8 caracteres.');
        return;
      }
      if (adminPassword !== confirmPassword) {
        setError('As senhas digitadas não coincidem.');
        return;
      }
    } else if (!isMaster && !adminPassword) {
      setError('Informe a senha atual do administrador para comprovar a vinculação.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await completeInitialOnboarding({
        nomeFantasia: nomeFantasia.trim(),
        razaoSocial: razaoSocial.trim() || undefined,
        cnpj: cnpj.trim() || undefined,
        companyEmail: (companyEmail.trim() || cleanEmail).toLowerCase(),
        telefone: telefone.trim(),
        endereco: endereco.trim() || undefined,
        segmento: segmento.trim() || undefined,
        tipoOperacao,
        modulos,
        nomePlataforma: nomePlataforma.trim() || undefined,
        adminMode,
        adminName: adminMode === 'create' ? adminName.trim() : undefined,
        adminEmail: cleanEmail,
        adminPhone: adminPhone.trim() || undefined,
        adminPassword: adminPassword || undefined,
        confirmPassword: adminMode === 'create' ? confirmPassword : undefined,
      });

      setCompletedResult({
        message: res.message,
        keepMasterSession: res.keepMasterSession,
      });

      if (!res.keepMasterSession) {
        navigateToPath('/');
      } else {
        await loadStatus();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao concluir o onboarding inicial.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070811] text-[#F5F3FA] flex flex-col selection:bg-[#8B5CF6] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#2D2644] bg-[#0A0914]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8B5CF6] via-[#7C3AED] to-[#D946EF] p-[1.5px] shadow-lg shadow-[#8B5CF6]/30">
              <div className="w-full h-full bg-[#0D0B18] rounded-[10px] flex items-center justify-center font-black text-white text-base">
                <span className="bg-gradient-to-r from-white via-[#C4B5FD] to-[#D946EF] bg-clip-text text-transparent">
                  M
                </span>
              </div>
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-2">
                Movi<span className="text-[#8B5CF6]">Log</span>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#8B5CF6]/15 text-[#C4B5FD] border border-[#8B5CF6]/30">
                  Primeiro Acesso
                </span>
              </span>
              <p className="text-[10px] text-[#AAA6B5]">Onboarding & Configuração Inicial Segura</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!user && (
              <button
                type="button"
                onClick={() => openLoginModal('login')}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#C4B5FD] hover:text-white transition flex items-center gap-1.5 border border-[#2D2644] hover:border-[#8B5CF6]/50 bg-[#121024]"
              >
                <Lock className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>Entrar no Sistema</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateToPath('/')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#AAA6B5] hover:text-white transition flex items-center gap-1.5 border border-[#2D2644] bg-[#121024]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isMaster ? 'Painel Master' : 'Voltar ao Início'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[340px] bg-[#8B5CF6]/12 rounded-full blur-[130px] pointer-events-none" />

        <div className="w-full max-w-2xl relative z-10">
          {checkingStatus ? (
            <div className="bg-[#121024] border border-[#2D2644] rounded-3xl p-10 text-center space-y-3 shadow-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6] mx-auto" />
              <p className="text-sm font-medium text-[#F5F3FA]">
                Consultando estado da configuração inicial...
              </p>
              <p className="text-xs text-[#AAA6B5]">
                Validando persistência e políticas de segurança no servidor.
              </p>
            </div>
          ) : completedResult ? (
            <div className="bg-[#121024] border border-emerald-500/40 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Onboarding Concluído</h1>
                <p className="text-sm text-[#AAA6B5] mt-2">{completedResult.message}</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigateToPath('/')}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white text-xs font-bold transition shadow-lg shadow-[#8B5CF6]/25"
                >
                  {completedResult.keepMasterSession
                    ? 'Voltar ao Painel Master Owner'
                    : 'Acessar Plataforma'}
                </button>
              </div>
            </div>
          ) : serverStatus?.onboardingCompleted ? (
            <div className="bg-[#121024] border border-[#2D2644] rounded-3xl p-8 space-y-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full">
                    Configuração Inicial Concluída
                  </span>
                  <h1 className="text-xl font-black text-white mt-2">
                    Primeiro Acesso Público Encerrado
                  </h1>
                  <p className="text-xs text-[#AAA6B5] mt-1 leading-relaxed">
                    A plataforma já possui configuração inicial ativa e protegida no servidor. Para
                    segurança multiempresa e preservação do Master Owner, a criação pública inicial
                    fica bloqueada até uma reabertura explícita pelo Master Owner.
                  </p>
                </div>
              </div>

              <div className="bg-[#1D1B24] border border-[#393442] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#AAA6B5] block text-[11px]">Plataforma</span>
                  <span className="font-semibold text-[#F5F3FA]">
                    {serverStatus.plataforma}
                  </span>
                </div>
                <div>
                  <span className="text-[#AAA6B5] block text-[11px]">Status Persistido</span>
                  <span className="font-semibold text-emerald-400">
                    Concluído{' '}
                    {serverStatus.onboardingCompletedAt
                      ? `(${new Date(serverStatus.onboardingCompletedAt).toLocaleString('pt-BR')})`
                      : ''}
                  </span>
                </div>
                {serverStatus.onboardingCompanyName && (
                  <div className="sm:col-span-2">
                    <span className="text-[#AAA6B5] block text-[11px]">Empresa do Onboarding</span>
                    <span className="font-semibold text-[#C4B5FD]">
                      {serverStatus.onboardingCompanyName}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                {!user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openLoginModal('login')}
                      className="w-full sm:w-auto flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-[#8B5CF6]/25"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Entrar com Minha Conta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openLoginModal('first-access')}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#1D1B24] hover:bg-[#25222D] border border-[#393442] text-xs font-semibold text-[#C4B5FD] transition flex items-center justify-center gap-2"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Ativar Conta Provisionada</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigateToPath('/')}
                    className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>
                      {isMaster
                        ? 'Ir ao Painel Master (Você pode reiniciar o onboarding por lá)'
                        : 'Voltar ao Painel Operacional'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#121024] border border-[#2D2644] rounded-3xl p-6 sm:p-8 shadow-2xl">
              {/* Wizard Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2D2644]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6] shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-white">
                      Configuração Inicial da Plataforma
                    </h1>
                    <p className="text-xs text-[#AAA6B5]">
                      Configure os dados iniciais da empresa e defina o administrador responsável
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`px-2.5 py-1 rounded-lg font-bold border ${
                      step === 1
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    1. Empresa
                  </span>
                  <span className="text-[#524B61]">→</span>
                  <span
                    className={`px-2.5 py-1 rounded-lg font-bold border ${
                      step === 2
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                        : 'bg-[#1D1B24] border-[#393442] text-[#AAA6B5]'
                    }`}
                  >
                    2. Administrador
                  </span>
                </div>
              </div>

              {isMaster && (
                <div className="mt-4 p-3 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-xs text-[#C4B5FD] flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#8B5CF6]" />
                  <span>
                    Você está executando o onboarding autenticado como{' '}
                    <strong>Master Owner</strong>. Sua conta e sessão Master permanecerão
                    integralmente preservadas ao concluir.
                  </span>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-400 text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {step === 1 ? (
                <form onSubmit={handleNextStep} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        Nome de Exibição da Plataforma (Opcional)
                      </label>
                      <input
                        type="text"
                        value={nomePlataforma}
                        onChange={(e) => setNomePlataforma(e.target.value)}
                        placeholder="Ex: MoviLog Operações Logísticas"
                        className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl px-3.5 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        Nome Fantasia da Empresa *
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                        <input
                          type="text"
                          required
                          value={nomeFantasia}
                          onChange={(e) => setNomeFantasia(e.target.value)}
                          placeholder="Ex: TransLog Brasil"
                          className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        Razão Social
                      </label>
                      <input
                        type="text"
                        value={razaoSocial}
                        onChange={(e) => setRazaoSocial(e.target.value)}
                        placeholder="Ex: TransLog Logística Ltda"
                        className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl px-3.5 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        CNPJ (Opcional — 14 dígitos)
                      </label>
                      <input
                        type="text"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        placeholder="00.000.000/0001-00"
                        className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl px-3.5 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        Telefone / WhatsApp *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                        <input
                          type="text"
                          required
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        E-mail Corporativo
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                        <input
                          type="email"
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                          placeholder="contato@empresa.com"
                          className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        Segmento
                      </label>
                      <input
                        type="text"
                        value={segmento}
                        onChange={(e) => setSegmento(e.target.value)}
                        placeholder="Logística, Transportadora, Condomínio"
                        className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl px-3.5 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        Endereço / Sede
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                        <input
                          type="text"
                          value={endereco}
                          onChange={(e) => setEndereco(e.target.value)}
                          placeholder="Av. Paulista, 1000 - São Paulo/SP"
                          className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        Tipo de Operação
                      </label>
                      <select
                        value={tipoOperacao}
                        onChange={(e) => setTipoOperacao(e.target.value as any)}
                        className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl px-3.5 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                      >
                        <option value="integrada">Operação Integrada (Logística + Predial)</option>
                        <option value="logistica">Centro de Distribuição / WMS</option>
                        <option value="expedicao">Transportadora / Expedição</option>
                        <option value="predial">Gestão Predial / Portaria</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#AAA6B5] mb-1.5">
                      Módulos Ativados
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleModule('logistica')}
                        className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                          modulos.includes('logistica')
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-white'
                            : 'border-[#393442] bg-[#1D1B24] text-[#AAA6B5]'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">Logística, WMS & Rotas</div>
                          <div className="text-[10px] text-[#AAA6B5]">
                            Entregas, frota, estoque e expedição
                          </div>
                        </div>
                        {modulos.includes('logistica') && (
                          <CheckCircle2 className="w-4 h-4 text-[#8B5CF6]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleModule('predial')}
                        className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                          modulos.includes('predial')
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-white'
                            : 'border-[#393442] bg-[#1D1B24] text-[#AAA6B5]'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">Gestão Predial & Portaria</div>
                          <div className="text-[10px] text-[#AAA6B5]">
                            Unidades, encomendas com PIN e visitantes
                          </div>
                        </div>
                        {modulos.includes('predial') && (
                          <CheckCircle2 className="w-4 h-4 text-[#8B5CF6]" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-[#8B5CF6]/25"
                    >
                      <span>Continuar para Administrador Responsável</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleComplete} className="mt-6 space-y-4">
                  {/* Admin Mode Switch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminMode('create');
                        setError(null);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                        adminMode === 'create'
                          ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-white'
                          : 'border-[#393442] bg-[#1D1B24] text-[#AAA6B5]'
                      }`}
                    >
                      <UserPlus className="w-5 h-5 text-[#8B5CF6] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold">Cadastrar Novo Administrador</div>
                        <div className="text-[10px] text-[#AAA6B5] mt-0.5">
                          Cria conta com papel Administrador da Empresa
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAdminMode('link');
                        setError(null);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                        adminMode === 'link'
                          ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-white'
                          : 'border-[#393442] bg-[#1D1B24] text-[#AAA6B5]'
                      }`}
                    >
                      <Link2 className="w-5 h-5 text-[#8B5CF6] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold">Vincular Administrador Existente</div>
                        <div className="text-[10px] text-[#AAA6B5] mt-0.5">
                          Associa um usuário elegível já cadastrado
                        </div>
                      </div>
                    </button>
                  </div>

                  {adminMode === 'link' &&
                    isMaster &&
                    serverStatus?.eligibleAdmins &&
                    serverStatus.eligibleAdmins.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                          Usuários Elegíveis Sem Empresa Vinculada
                        </label>
                        <select
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl px-3.5 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                        >
                          <option value="">Selecione um usuário ou digite abaixo...</option>
                          {serverStatus.eligibleAdmins.map((u) => (
                            <option key={u.id} value={u.email}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {adminMode === 'create' && (
                      <div>
                        <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                          Nome Completo do Administrador *
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                          <input
                            type="text"
                            required
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            placeholder="Nome do responsável"
                            className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                          />
                        </div>
                      </div>
                    )}

                    <div className={adminMode === 'link' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                        E-mail do Administrador Responsável *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                        <input
                          type="email"
                          required
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="admin@empresa.com"
                          className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                        />
                      </div>
                    </div>

                    {adminMode === 'create' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                            Telefone do Administrador
                          </label>
                          <div className="relative">
                            <Phone className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                            <input
                              type="text"
                              value={adminPhone}
                              onChange={(e) => setAdminPhone(e.target.value)}
                              placeholder="(11) 99999-9999"
                              className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                            />
                          </div>
                        </div>

                        <div />

                        <div>
                          <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                            Senha de Acesso (mín. 8 caracteres) *
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                            <input
                              type="password"
                              required
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                            Confirmar Senha *
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                            <input
                              type="password"
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Repita a senha"
                              className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {adminMode === 'link' && !isMaster && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                          Senha Atual do Administrador (Comprovação de Titularidade) *
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                          <input
                            type="password"
                            required
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="Senha atual da conta a vincular"
                            className="w-full bg-[#1D1B24] border border-[#393442] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[#1D1B24] border border-[#393442] text-[11px] text-[#AAA6B5] flex items-start gap-2">
                    <UserCheck className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                    <span>
                      Empresa: <strong className="text-white">{nomeFantasia}</strong> • Papel
                      atribuído: <strong className="text-[#C4B5FD]">Administrador da Empresa</strong>
                      . Nenhuma credencial ou privilégio de Master Owner é alterado ou concedido
                      por este fluxo.
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setStep(1);
                      }}
                      disabled={submitting}
                      className="px-4 py-3 rounded-xl bg-[#1D1B24] hover:bg-[#25222D] border border-[#393442] text-xs font-semibold text-[#AAA6B5] hover:text-white transition flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-[#8B5CF6]/25 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Concluir Primeiro Acesso & Salvar Configuração</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
