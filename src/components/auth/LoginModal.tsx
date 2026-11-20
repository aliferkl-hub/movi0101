import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Lock,
  Mail,
  ShieldAlert,
  ArrowRight,
  Loader2,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  UserCheck,
  Sparkles,
} from 'lucide-react';

type ModalMode = 'login' | 'first-access' | 'recovery';

export const LoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    setIsLoginModalOpen,
    setIsRegisterModalOpen,
    loginModalModeRequest,
    isOnboardingPending,
    navigateToPath,
    login,
    recoverMaster,
    completeFirstAccess,
  } = useAuth();
  const [mode, setMode] = useState<ModalMode>('login');

  useEffect(() => {
    if (isLoginModalOpen) {
      setMode(loginModalModeRequest || 'login');
      setError(null);
      setFirstAccessHint(false);
    }
  }, [isLoginModalOpen, loginModalModeRequest]);

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [firstAccessHint, setFirstAccessHint] = useState(false);

  // Shared sensitive state for recovery / first-access (never prefilled with any secret, never logged)
  const [targetEmail, setTargetEmail] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  if (!isLoginModalOpen) return null;

  const clearSensitiveFields = () => {
    setSecretKey('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowSecretKey(false);
    setShowNewPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setFirstAccessHint(false);
    setLoading(true);

    try {
      await login(email, password);
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação');
      if (err?.data?.code === 'FIRST_ACCESS_REQUIRED') {
        setFirstAccessHint(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordRules = [
    { label: 'Mínimo de 12 caracteres', ok: newPassword.length >= 12 },
    { label: 'Letra maiúscula (A-Z)', ok: /[A-Z]/.test(newPassword) },
    { label: 'Letra minúscula (a-z)', ok: /[a-z]/.test(newPassword) },
    { label: 'Número (0-9)', ok: /[0-9]/.test(newPassword) },
    { label: 'Caractere especial (!@#$...)', ok: /[^A-Za-z0-9]/.test(newPassword) },
    {
      label: 'Confirmação idêntica',
      ok: newPassword.length > 0 && newPassword === confirmNewPassword,
    },
  ];

  const handleSecondarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!targetEmail.trim() || !secretKey) {
      setError(
        mode === 'first-access'
          ? 'Informe o e-mail da conta e a chave de ativação configurada no servidor.'
          : 'Informe o e-mail da conta MASTER_OWNER e a chave de recuperação administrativa.'
      );
      return;
    }

    const failedRule = passwordRules.find((r) => !r.ok);
    if (failedRule) {
      setError(`Requisito de senha não atendido: ${failedRule.label}.`);
      return;
    }

    setLoading(true);
    try {
      const res =
        mode === 'first-access'
          ? await completeFirstAccess(
              targetEmail.trim(),
              secretKey,
              newPassword,
              confirmNewPassword
            )
          : await recoverMaster(
              targetEmail.trim(),
              secretKey,
              newPassword,
              confirmNewPassword
            );

      const savedEmail = targetEmail.trim();
      clearSensitiveFields();
      setEmail(savedEmail);
      setPassword('');
      setFirstAccessHint(false);
      setMode('login');
      setSuccessMessage(
        res.message || 'Nova senha definitiva cadastrada. Faça login com sua nova senha.'
      );
    } catch (err: any) {
      setError(
        err.message ||
          (mode === 'first-access'
            ? 'Falha ao definir senha de primeiro acesso'
            : 'Falha ao validar recuperação administrativa')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMode = (nextMode: 'first-access' | 'recovery') => {
    setError(null);
    setSuccessMessage(null);
    setFirstAccessHint(false);
    setTargetEmail(email.trim());
    clearSensitiveFields();
    setMode(nextMode);
  };

  const handleBackToLogin = () => {
    setError(null);
    setFirstAccessHint(false);
    clearSensitiveFields();
    setMode('login');
  };

  const handleClose = () => {
    setError(null);
    setSuccessMessage(null);
    setFirstAccessHint(false);
    setPassword('');
    clearSensitiveFields();
    setMode('login');
    setIsLoginModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md bg-[#1D1B24] border border-[#393442] rounded-2xl p-6 shadow-2xl text-[#F5F3FA]">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-[#AAA6B5] hover:text-[#F5F3FA] p-1 rounded-lg hover:bg-[#25222D] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {mode === 'login' ? (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6]">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#F5F3FA]">Acessar Plataforma</h2>
                <p className="text-xs text-[#AAA6B5]">
                  Insira suas credenciais para entrar no sistema
                </p>
              </div>
            </div>

            {isOnboardingPending && (
              <div className="mb-4 p-3 bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-xs">
                  <Sparkles className="w-4 h-4 text-[#C4B5FD] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-white">Primeiro Acesso Disponível</div>
                    <div className="text-[11px] text-[#C4B5FD]">
                      Configuração inicial da empresa pendente.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    navigateToPath('/primeiro-acesso');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold shrink-0 transition"
                >
                  Configurar
                </button>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2 text-[#A7F3D0] text-xs">
                <ShieldCheck className="w-4 h-4 shrink-0 text-[#10B981] mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-rose-400 text-xs">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {firstAccessHint && (
                  <button
                    type="button"
                    onClick={() => handleOpenMode('first-access')}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/40 text-[#C4B5FD] font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Definir Senha de Primeiro Acesso</span>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1.5">
                  E-mail de Acesso
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#AAA6B5]">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenMode('recovery')}
                    className="text-xs font-medium text-[#C4B5FD] hover:text-[#8B5CF6] transition underline-offset-2 hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#7C3AED]/25 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-[#393442]/70 flex items-center justify-between gap-2 text-xs text-[#AAA6B5]">
                <span>Novo ambiente ou conta?</span>
                <div className="flex items-center gap-3">
                  {isOnboardingPending && (
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        navigateToPath('/primeiro-acesso');
                      }}
                      className="font-semibold text-[#D946EF] hover:text-[#F0ABFC] transition underline-offset-2 hover:underline"
                    >
                      Onboarding Inicial
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      setIsRegisterModalOpen(true);
                    }}
                    className="font-medium text-[#C4B5FD] hover:text-[#8B5CF6] transition underline-offset-2 hover:underline"
                  >
                    Primeiro acesso
                  </button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6]">
                {mode === 'first-access' ? (
                  <UserCheck className="w-5 h-5" />
                ) : (
                  <KeyRound className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#F5F3FA]">
                  {mode === 'first-access' ? 'Primeiro Acesso Seguro' : 'Recuperação MASTER_OWNER'}
                </h2>
                <p className="text-xs text-[#AAA6B5]">
                  {mode === 'first-access'
                    ? 'Defina sua senha definitiva no primeiro acesso'
                    : 'Redefinição definitiva com chave administrativa do servidor'}
                </p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-[#25222D] border border-[#393442] rounded-xl text-[11px] text-[#AAA6B5] leading-relaxed space-y-2">
              {mode === 'first-access' ? (
                <>
                  <div>
                    Uso único para contas com primeiro acesso pendente. Exige a chave de ativação
                    configurada nos <strong className="text-[#F5F3FA]">Secrets</strong> do servidor.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      navigateToPath('/primeiro-acesso');
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/40 text-[#C4B5FD] font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Abrir Onboarding Inicial da Empresa (/primeiro-acesso)</span>
                  </button>
                </>
              ) : (
                <>
                  Exclusivo para o titular <strong className="text-[#F5F3FA]">MASTER_OWNER</strong>.
                  Ao confirmar, todas as sessões anteriores do titular serão revogadas e a nova senha
                  passará a valer imediatamente.
                </>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-400 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSecondarySubmit} className="space-y-3.5" autoComplete="off">
              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                  {mode === 'first-access' ? 'E-mail da conta' : 'E-mail da conta MASTER_OWNER'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    placeholder="email.titular@dominio.com"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                  {mode === 'first-access'
                    ? 'Chave de ativação (Secrets do servidor)'
                    : 'Chave de recuperação administrativa'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    required
                    autoComplete="off"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Chave secreta configurada no servidor"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-10 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-[#AAA6B5] hover:text-[#F5F3FA]"
                    aria-label="Alternar visibilidade da chave"
                  >
                    {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                  Nova senha definitiva
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 12 caracteres fortes"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-10 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-[#AAA6B5] hover:text-[#F5F3FA]"
                    aria-label="Alternar visibilidade da senha"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#AAA6B5] mb-1">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#AAA6B5] absolute left-3 top-2.5" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full bg-[#25222D] border border-[#393442] rounded-xl pl-9 pr-3 py-2 text-sm text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-2.5 bg-[#25222D] border border-[#393442] rounded-xl">
                {passwordRules.map((rule) => (
                  <div
                    key={rule.label}
                    className={`flex items-center gap-1.5 text-[11px] ${
                      rule.ok ? 'text-emerald-400' : 'text-[#AAA6B5]'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        rule.ok ? 'text-emerald-400' : 'text-[#524B61]'
                      }`}
                    />
                    <span>{rule.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  disabled={loading}
                  className="px-3.5 py-2.5 rounded-xl bg-[#25222D] hover:bg-[#2F2B39] border border-[#393442] text-xs font-medium text-[#AAA6B5] hover:text-[#F5F3FA] transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#7C3AED]/25 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {mode === 'first-access'
                          ? 'Definir Senha Definitiva'
                          : 'Redefinir Senha Definitiva'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
