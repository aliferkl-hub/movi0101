import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Company, SystemConfig, OnboardingStatus } from '../types';
import { api, getStoredToken, setStoredToken, removeStoredToken } from '../lib/api';

export type AuthModalInitialMode = 'login' | 'first-access' | 'recovery';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  systemConfig: Partial<SystemConfig> | null;
  isLoading: boolean;
  isMaster: boolean;
  isDemo: boolean;
  demoDaysLeft: number;
  isSubscriptionActive: boolean;
  isSubscriptionExpired: boolean;
  isMasterInitialized: boolean;
  isOnboardingCompleted: boolean;
  isOnboardingPending: boolean;
  onboardingStatus: OnboardingStatus | null;
  masterEmail: string;
  currentPath: string;
  navigateToPath: (path: string) => void;
  refreshOnboardingStatus: () => Promise<OnboardingStatus | null>;
  completeInitialOnboarding: (payload: Parameters<typeof api.completeOnboarding>[0]) => Promise<{
    success: boolean;
    keepMasterSession: boolean;
    message: string;
  }>;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  initMaster: (pass: string, name: string, phone?: string) => Promise<void>;
  recoverMaster: (
    email: string,
    recoveryKey: string,
    newPass: string,
    confirmPass: string
  ) => Promise<{ success: boolean; message: string }>;
  completeFirstAccess: (
    email: string,
    activationKey: string,
    newPass: string,
    confirmPass: string
  ) => Promise<{ success: boolean; message: string }>;
  registerCompany: (payload: any) => Promise<void>;
  refreshUser: () => Promise<void>;
  // UI state for modals
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  loginModalModeRequest: AuthModalInitialMode;
  openLoginModal: (initialMode?: AuthModalInitialMode) => void;
  isMasterSetupOpen: boolean;
  setIsMasterSetupOpen: (open: boolean) => void;
  isRegisterModalOpen: boolean;
  setIsRegisterModalOpen: (open: boolean) => void;
  isPlanModalOpen: boolean;
  setIsPlanModalOpen: (open: boolean) => void;
  selectedPlanForCheckout: string | null;
  setSelectedPlanForCheckout: (planId: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizePath = (rawPath: string) => {
  const cleaned = rawPath.replace(/\/+$/, '').toLowerCase();
  return cleaned || '/';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [systemConfig, setSystemConfig] = useState<Partial<SystemConfig> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMasterInitialized, setIsMasterInitialized] = useState<boolean>(false);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(true);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [masterEmail, setMasterEmail] = useState<string>('Alifermadeiro@hotmail.com');
  const [currentPath, setCurrentPath] = useState<string>(() =>
    normalizePath(window.location.pathname)
  );

  // Modals state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginModalModeRequest, setLoginModalModeRequest] =
    useState<AuthModalInitialMode>('login');
  const [isMasterSetupOpen, setIsMasterSetupOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<string | null>(null);

  const navigateToPath = useCallback((path: string) => {
    const target = normalizePath(path);
    if (normalizePath(window.location.pathname) !== target) {
      window.history.pushState({}, '', target);
    }
    setCurrentPath(target);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const refreshOnboardingStatus = useCallback(async () => {
    try {
      const ob = await api.getOnboardingStatus();
      setOnboardingStatus(ob);
      setIsOnboardingCompleted(ob.onboardingCompleted);
      setIsMasterInitialized(ob.masterInitialized);
      return ob;
    } catch (e) {
      console.error('Failed to get onboarding status:', e);
      return null;
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const status = await api.getAuthStatus();
      setIsMasterInitialized(status.masterInitialized);
      setIsOnboardingCompleted(status.onboardingCompleted);
      if (status.masterEmail) setMasterEmail(status.masterEmail);
    } catch (e) {
      console.error('Failed to get auth status:', e);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setCompany(null);
      setIsLoading(false);
      return;
    }

    try {
      const me = await api.getMe();
      setUser(me.user);
      setCompany(me.company);
      if (me.systemConfig) {
        setSystemConfig(me.systemConfig);
      }
    } catch (err: any) {
      console.warn('Session invalid or expired:', err.message);
      removeStoredToken();
      setUser(null);
      setCompany(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
    refreshOnboardingStatus();
    refreshUser();
  }, [checkAuthStatus, refreshOnboardingStatus, refreshUser]);

  const openLoginModal = useCallback((initialMode: AuthModalInitialMode = 'login') => {
    setLoginModalModeRequest(initialMode);
    setIsLoginModalOpen(true);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login({ email, password: pass });
    setStoredToken(res.token);
    setUser(res.user);
    setCompany(res.company);
    setIsLoginModalOpen(false);
    if (currentPath === '/primeiro-acesso' || currentPath === '/onboarding') {
      navigateToPath('/');
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore
    } finally {
      removeStoredToken();
      setUser(null);
      setCompany(null);
    }
  };

  const initMaster = async (pass: string, name: string, phone?: string) => {
    const res = await api.initMaster({
      email: masterEmail,
      password: pass,
      name,
      phone
    });
    setStoredToken(res.token);
    setUser(res.user);
    setCompany(null);
    setIsMasterInitialized(true);
    setIsMasterSetupOpen(false);
  };

  const recoverMaster = async (
    email: string,
    recoveryKey: string,
    newPass: string,
    confirmPass: string
  ) => {
    const res = await api.recoverMaster({
      email,
      recoveryKey,
      newPassword: newPass,
      confirmPassword: confirmPass,
    });
    removeStoredToken();
    setUser(null);
    setCompany(null);
    return res;
  };

  const completeFirstAccess = async (
    email: string,
    activationKey: string,
    newPass: string,
    confirmPass: string
  ) => {
    const res = await api.completeFirstAccess({
      email,
      activationKey,
      newPassword: newPass,
      confirmPassword: confirmPass,
    });
    removeStoredToken();
    setUser(null);
    setCompany(null);
    return res;
  };

  const completeInitialOnboarding = async (payload: Parameters<typeof api.completeOnboarding>[0]) => {
    const res = await api.completeOnboarding(payload);
    setIsOnboardingCompleted(true);
    await refreshOnboardingStatus();
    if (!res.keepMasterSession && res.token) {
      setStoredToken(res.token);
      setUser(res.user);
      setCompany(res.company);
    }
    return {
      success: res.success,
      keepMasterSession: res.keepMasterSession,
      message: res.message,
    };
  };

  const registerCompany = async (payload: any) => {
    const res = await api.registerCompany(payload);
    setStoredToken(res.token);
    setUser(res.user);
    setCompany(res.company);
    setIsRegisterModalOpen(false);
  };

  // Master Owner is defined purely and authoritatively by the verified master_owner role
  const isMaster = user?.role === 'master_owner';
  const isDemo = company?.statusAssinatura === 'demo_ativa';
  const isOnboardingPending = !isOnboardingCompleted;

  let demoDaysLeft = 0;
  if (isDemo && company?.demoEndDate) {
    const diff = new Date(company.demoEndDate).getTime() - Date.now();
    demoDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const isSubscriptionActive = isMaster || (company?.statusAssinatura === 'assinatura_ativa' || company?.statusAssinatura === 'demo_ativa');
  const isSubscriptionExpired = company?.statusAssinatura === 'demo_expirada' || company?.statusAssinatura === 'assinatura_vencida';

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        systemConfig,
        isLoading,
        isMaster,
        isDemo,
        demoDaysLeft,
        isSubscriptionActive,
        isSubscriptionExpired,
        isMasterInitialized,
        isOnboardingCompleted,
        isOnboardingPending,
        onboardingStatus,
        masterEmail,
        currentPath,
        navigateToPath,
        refreshOnboardingStatus,
        completeInitialOnboarding,
        login,
        logout,
        initMaster,
        recoverMaster,
        completeFirstAccess,
        registerCompany,
        refreshUser,
        isLoginModalOpen,
        setIsLoginModalOpen,
        loginModalModeRequest,
        openLoginModal,
        isMasterSetupOpen,
        setIsMasterSetupOpen,
        isRegisterModalOpen,
        setIsRegisterModalOpen,
        isPlanModalOpen,
        setIsPlanModalOpen,
        selectedPlanForCheckout,
        setSelectedPlanForCheckout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
