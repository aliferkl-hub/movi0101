import {
  User,
  Company,
  CommercialPlan,
  PaymentRequest,
  AuditLog,
  OnboardingStatus,
  LogisticsReceipt,
  InventoryItem,
  StockMovement,
  ShipmentOrder,
  DeliveryItem,
  Vehicle,
  DeliveryRoute,
  RouteStop,
  CondoUnit,
  CondoPackage,
  CondoVisitor,
  MasterStats,
  DashboardMetrics,
  FiscalConfig,
  FiscalDocument,
  FinancialRecord,
  NotificationItem,
  CommercialProduct,
  CommercialStockMovement,
  CommercialSale,
  CommercialCashSession,
  CommercialSupplier,
  CommercialPurchase,
  CommercialDashboardMetrics,
  PixCharge,
  CommercialTerminal,
  CommercialTerminalTransaction,
  TerminalReconciliationReport,
  CommercialAlert,
  SmartStockItem,
  CommercialReplenishment,
  CommercialLoss,
  CommercialLossReason,
  CommercialInventory,
  CommercialPeriodClosing,
  CommercialOrder,
  CommercialOrderStatus,
  CommercialCustomer,
  CommercialImportBatch,
  CommercialPilotConfig,
  PreventionAlert,
  PreventionMetrics,
  WarehouseCD,
  WarehousePosition,
  WarehouseTransfer,
  WarehouseInventoryAudit,
  FulfillmentOrder,
  FulfillmentStage,
  PickingTask,
  PackingTask,
  ShippingManifest,
  ReverseLogisticsTicket
} from '../types';

const TOKEN_KEY = 'logipredial_auth_token';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Erro ${response.status}: ${response.statusText}`;
    const err = new Error(errorMsg) as Error & { status?: number; data?: any };
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export const api = {
  // Auth & Onboarding
  getAuthStatus: () =>
    request<{
      masterInitialized: boolean;
      masterEmail: string;
      plataforma: string;
      onboardingCompleted: boolean;
      onboardingPending: boolean;
      hasCompanies: boolean;
      onboardingCompletedAt: string | null;
      onboardingResetAt: string | null;
    }>('/api/auth/status'),
  getOnboardingStatus: () => request<OnboardingStatus>('/api/onboarding/status'),
  completeOnboarding: (payload: {
    nomeFantasia: string;
    razaoSocial?: string;
    cnpj?: string;
    companyEmail?: string;
    telefone: string;
    endereco?: string;
    segmento?: string;
    tipoOperacao?: 'logistica' | 'expedicao' | 'predial' | 'integrada';
    modulos?: ('logistica' | 'predial')[];
    nomePlataforma?: string;
    adminMode: 'create' | 'link';
    adminName?: string;
    adminEmail: string;
    adminPhone?: string;
    adminPassword?: string;
    confirmPassword?: string;
  }) =>
    request<{
      success: boolean;
      keepMasterSession: boolean;
      message: string;
      token?: string;
      user: User;
      company: Company;
      onboardingCompleted: boolean;
    }>('/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  initMaster: (payload: { email: string; password: string; name: string; phone?: string }) =>
    request<{ token: string; user: User; message: string }>('/api/auth/init-master', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  recoverMaster: (payload: {
    email: string;
    recoveryKey: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
    request<{ success: boolean; message: string }>('/api/auth/master-recovery', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  completeFirstAccess: (payload: {
    email: string;
    activationKey: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
    request<{ success: boolean; message: string }>('/api/auth/first-access', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: User; company: Company | null }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMe: () =>
    request<{
      user: User;
      company: Company | null;
      systemConfig: { whatsappComercial: string; nomePlataforma: string; diasDemonstracao: number };
    }>('/api/auth/me'),
  logout: () =>
    request<{ message: string }>('/api/auth/logout', { method: 'POST' }),
  registerCompany: (payload: any) =>
    request<{ token: string; user: User; company: Company; message: string }>('/api/auth/register-company', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Public / Plans / WhatsApp
  getPlans: () =>
    request<{ plans: CommercialPlan[]; whatsappComercial: string; mensagemPadrao: string }>('/api/plans'),
  requestSubscription: (payload: { planoId: string; metodoPagamento?: string; comprovanteReferencia?: string; periodoMeses?: number }) =>
    request<{ message: string; payment: PaymentRequest }>('/api/subscription/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getQRCode: (text: string) =>
    request<{ dataUrl: string; text: string }>(`/api/qrcode?text=${encodeURIComponent(text)}`),

  // Master Owner
  getMasterStats: () => request<MasterStats>('/api/master/stats'),
  getMasterCompanies: () => request<{ companies: Company[] }>('/api/master/companies'),
  updateMasterCompany: (id: string, payload: any) =>
    request<{ company: Company; message: string }>(`/api/master/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getMasterPlans: () => request<{ plans: CommercialPlan[] }>('/api/master/plans'),
  updateMasterPlan: (id: string, payload: Partial<CommercialPlan>) =>
    request<{ plan: CommercialPlan; message: string }>(`/api/master/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  createMasterPlan: (payload: Partial<CommercialPlan>) =>
    request<{ plan: CommercialPlan; message: string }>('/api/master/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMasterConfig: () => request<{ config: any }>('/api/master/config'),
  updateMasterConfig: (payload: any) =>
    request<{ config: any; message: string }>('/api/master/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getMasterOnboarding: () => request<OnboardingStatus>('/api/master/onboarding'),
  resetMasterOnboarding: () =>
    request<{ success: boolean; message: string; status: OnboardingStatus }>('/api/master/onboarding/reset', {
      method: 'POST',
    }),
  lockMasterOnboarding: () =>
    request<{ success: boolean; message: string; status: OnboardingStatus }>('/api/master/onboarding/lock', {
      method: 'POST',
    }),
  getMasterPayments: () => request<{ payments: PaymentRequest[] }>('/api/master/payments'),
  verifyPayment: (id: string, payload: { action: 'aprovar' | 'rejeitar'; observacoes?: string }) =>
    request<{ message: string; payment: PaymentRequest; company?: Company }>(`/api/master/payments/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMasterAuditLogs: () => request<{ logs: AuditLog[] }>('/api/master/audit-logs'),
  seedSampleData: () => request<{ message: string; sampleCompany?: Company }>('/api/seed-sample-data', { method: 'POST' }),

  // Logistics
  getReceipts: (companyId?: string) =>
    request<{ receipts: LogisticsReceipt[] }>(companyId ? `/api/logistics/receipts?companyId=${companyId}` : '/api/logistics/receipts'),
  createReceipt: (payload: any) =>
    request<{ receipt: LogisticsReceipt }>('/api/logistics/receipts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getInventory: (companyId?: string) =>
    request<{ items: InventoryItem[] }>(companyId ? `/api/logistics/inventory?companyId=${companyId}` : '/api/logistics/inventory'),
  saveInventoryItem: (payload: any) =>
    request<{ item: InventoryItem }>('/api/logistics/inventory', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  recordStockMovement: (payload: any) =>
    request<{ movement: StockMovement; item: InventoryItem }>('/api/logistics/movement', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getShipments: (companyId?: string) =>
    request<{ shipments: ShipmentOrder[] }>(companyId ? `/api/logistics/shipments?companyId=${companyId}` : '/api/logistics/shipments'),
  createShipment: (payload: any) =>
    request<{ shipment: ShipmentOrder }>('/api/logistics/shipments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateShipmentStatus: (id: string, payload: { status: string; ocorrenciaTexto?: string }) =>
    request<{ shipment: ShipmentOrder }>(`/api/logistics/shipments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Condo & Concierge
  getCondoUnits: (companyId?: string) =>
    request<{ units: CondoUnit[] }>(companyId ? `/api/condo/units?companyId=${companyId}` : '/api/condo/units'),
  saveCondoUnit: (payload: any) =>
    request<{ unit: CondoUnit }>('/api/condo/units', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getCondoPackages: (companyId?: string) =>
    request<{ packages: CondoPackage[] }>(companyId ? `/api/condo/packages?companyId=${companyId}` : '/api/condo/packages'),
  receivePackage: (payload: any) =>
    request<{ pkg: CondoPackage }>('/api/condo/packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  notifyPackageRecipient: (id: string) =>
    request<{ message: string; pkg: CondoPackage; whatsappUrl: string }>(`/api/condo/packages/${id}/notify`, {
      method: 'POST',
    }),
  pickupPackage: (id: string, payload: { pin: string; retiradoPor: string; documentoRetirada?: string }) =>
    request<{ message: string; pkg: CondoPackage }>(`/api/condo/packages/${id}/pickup`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCondoPackage: (id: string, payload: any) =>
    request<{ message?: string; pkg: CondoPackage }>(`/api/condo/packages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getDashboardMetrics: (period: 'day' | 'week' | 'month' = 'week', companyId?: string) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (companyId) params.set('companyId', companyId);
    return request<DashboardMetrics>(`/api/dashboard/metrics?${params.toString()}`);
  },
  getCondoVisitors: (companyId?: string) =>
    request<{ visitors: CondoVisitor[] }>(companyId ? `/api/condo/visitors?companyId=${companyId}` : '/api/condo/visitors'),
  checkInVisitor: (payload: any) =>
    request<{ visitor: CondoVisitor }>('/api/condo/visitors', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  checkOutVisitor: (id: string) =>
    request<{ message: string; visitor: CondoVisitor }>(`/api/condo/visitors/${id}/checkout`, {
      method: 'PATCH',
    }),

  // LET'S LOG — Deliveries & Spreadsheet Import
  getDeliveries: (filters: Record<string, string> = {}) => {
    const params = new URLSearchParams(filters);
    return request<{ deliveries: DeliveryItem[] }>(`/api/deliveries?${params.toString()}`);
  },
  createDelivery: (payload: any) =>
    request<{ message: string; delivery: DeliveryItem }>('/api/deliveries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  importDeliveries: (rows: any[]) =>
    request<{
      message: string;
      totalReceived: number;
      acceptedCount: number;
      rejectedCount: number;
      accepted: DeliveryItem[];
      rejected: any[];
    }>('/api/deliveries/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),
  updateDelivery: (id: string, payload: any) =>
    request<{ message: string; delivery: DeliveryItem }>(`/api/deliveries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteDelivery: (id: string) =>
    request<{ message: string }>(`/api/deliveries/${id}`, {
      method: 'DELETE',
    }),

  // LET'S LOG — Fleet & GPS
  getFleetVehicles: (companyId?: string) =>
    request<{ vehicles: Vehicle[] }>(companyId ? `/api/fleet/vehicles?companyId=${companyId}` : '/api/fleet/vehicles'),
  createVehicle: (payload: any) =>
    request<{ message: string; vehicle: Vehicle }>('/api/fleet/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateVehicle: (id: string, payload: any) =>
    request<{ message: string; vehicle: Vehicle }>(`/api/fleet/vehicles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  sendVehicleLocation: (id: string, location: { lat: number; lng: number; velocidade?: number; precisao?: number; bateria?: number; timestampDispositivo?: string }) =>
    request<{ success: boolean; location: any }>(`/api/fleet/vehicles/${id}/location`, {
      method: 'POST',
      body: JSON.stringify(location),
    }),
  getVehicleLocation: (id: string) =>
    request<{ veiculoId: string; placa: string; identificacao: string; ultimaLocalizacao: any }>(`/api/fleet/vehicles/${id}/location`),

  // LET'S LOG — Route Planning & Execution
  planRouteSuggestion: (payload: { deliveryIds: string[]; veiculoId: string }) =>
    request<{
      vehicle: Vehicle;
      totalDeliveries: number;
      totalVolumes: number;
      totalWeightKg: number;
      capacityExceeded: boolean;
      warnings: string[];
      estimatedDistanceKm: number;
      estimatedDurationMin: number;
      suggestedStops: RouteStop[];
    }>('/api/routes/plan-suggest', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getRoutes: (companyId?: string) =>
    request<{ routes: DeliveryRoute[] }>(companyId ? `/api/routes?companyId=${companyId}` : '/api/routes'),
  getRouteById: (id: string) =>
    request<{ route: DeliveryRoute; vehicle?: Vehicle }>(`/api/routes/${id}`),
  createRoute: (payload: any) =>
    request<{ message: string; route: DeliveryRoute }>('/api/routes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRoute: (id: string, payload: any) =>
    request<{ message: string; route: DeliveryRoute }>(`/api/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  reviewRoute: (id: string, motivo?: string) =>
    request<{ message: string; route: DeliveryRoute }>(`/api/routes/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }),
  publishRoute: (id: string) =>
    request<{ message: string; route: DeliveryRoute }>(`/api/routes/${id}/publish`, {
      method: 'POST',
    }),
  startRoute: (id: string) =>
    request<{ message: string; route: DeliveryRoute }>(`/api/routes/${id}/start`, {
      method: 'POST',
    }),
  updateStopStatus: (routeId: string, stopIndex: number, payload: any) =>
    request<{ message: string; stop: RouteStop; route: DeliveryRoute }>(`/api/routes/${routeId}/stops/${stopIndex}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getDriverActiveRoute: () =>
    request<{ activeRoute: DeliveryRoute | null; vehicle?: Vehicle }>('/api/driver/active-route'),

  // Company Profile & Settings
  getCompanyProfile: () =>
    request<{ company: Company }>('/api/company/profile'),
  updateCompanyProfile: (payload: Partial<Company>) =>
    request<{ message: string; company: Company }>('/api/company/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // LET'S LOG — Company Team (Drivers, Dispatchers)
  getCompanyUsers: (companyId?: string) =>
    request<{ users: any[] }>(companyId ? `/api/company/users?companyId=${companyId}` : '/api/company/users'),
  createCompanyUser: (payload: any) =>
    request<{ message: string; user: any }>('/api/company/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // MoviLog — Central Fiscal
  getFiscalConfig: (companyId?: string) =>
    request<{ config: FiscalConfig }>(companyId ? `/api/fiscal/config?companyId=${companyId}` : '/api/fiscal/config'),
  saveFiscalConfig: (payload: Partial<FiscalConfig>) =>
    request<{ message: string; config: FiscalConfig }>('/api/fiscal/config', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getFiscalDocuments: (filters: Record<string, string> = {}) => {
    const params = new URLSearchParams(filters);
    return request<{ documents: FiscalDocument[] }>(`/api/fiscal/documents?${params.toString()}`);
  },
  getFiscalDocumentById: (id: string) =>
    request<{ document: FiscalDocument }>(`/api/fiscal/documents/${id}`),
  emitFiscalDocument: (payload: any) =>
    request<{ message: string; document: FiscalDocument }>('/api/fiscal/emit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelFiscalDocument: (id: string, motivo: string) =>
    request<{ message: string; document: FiscalDocument }>(`/api/fiscal/documents/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }),
  sendFiscalCorrection: (id: string, correcao: string) =>
    request<{ message: string; document: FiscalDocument }>(`/api/fiscal/documents/${id}/correction`, {
      method: 'POST',
      body: JSON.stringify({ correcao }),
    }),

  // MoviLog — Financeiro & Custos
  getFinancialRecords: (filters: Record<string, string> = {}) => {
    const params = new URLSearchParams(filters);
    return request<{ records: FinancialRecord[] }>(`/api/financial/records?${params.toString()}`);
  },
  createFinancialRecord: (payload: any) =>
    request<{ message: string; record: FinancialRecord }>('/api/financial/records', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getFinancialSummary: (companyId?: string) =>
    request<{
      totalReceitas: number;
      totalDespesas: number;
      saldoOperacional: number;
      margemPercentual: number;
      totalLancamentos: number;
      despesasPorCategoria: Record<string, number>;
    }>(companyId ? `/api/financial/summary?companyId=${companyId}` : '/api/financial/summary'),

  // MoviLog — Notificações
  getNotifications: () =>
    request<{ notifications: NotificationItem[] }>('/api/notifications'),
  markNotificationRead: (id: string) =>
    request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    request<{ success: boolean; message: string }>('/api/notifications/read-all', { method: 'POST' }),

  // MoviLog — Rastreamento Público Seguro
  getPublicTracking: (code: string) =>
    request<any>(`/api/tracking/public/${encodeURIComponent(code)}`),

  // Adega & Tabacaria Commercial Suite
  getCommerceProducts: (modulo?: 'adega' | 'tabacaria') =>
    request<{ products: CommercialProduct[] }>(modulo ? `/api/commerce/products?modulo=${modulo}` : '/api/commerce/products'),
  createCommerceProduct: (data: Partial<CommercialProduct>) =>
    request<{ success: boolean; product: CommercialProduct }>('/api/commerce/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCommerceProduct: (id: string, data: Partial<CommercialProduct>) =>
    request<{ success: boolean; product: CommercialProduct }>(`/api/commerce/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCommerceProduct: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/commerce/products/${id}`, {
      method: 'DELETE',
    }),
  seedSampleCommerceProducts: (modulo: 'adega' | 'tabacaria') =>
    request<{ success: boolean; count: number; message: string }>('/api/commerce/products/sample-seed', {
      method: 'POST',
      body: JSON.stringify({ modulo }),
    }),
  getCommerceStockMovements: (productId?: string) =>
    request<{ movements: CommercialStockMovement[] }>(productId ? `/api/commerce/stock-movements?productId=${productId}` : '/api/commerce/stock-movements'),
  adjustCommerceStock: (data: { productId: string; tipo: string; quantidade: number; motivo: string }) =>
    request<{ success: boolean; movement: CommercialStockMovement; product: CommercialProduct }>('/api/commerce/stock/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCurrentCashSession: (modulo?: 'adega' | 'tabacaria') =>
    request<{ success?: boolean; session: CommercialCashSession | null }>(modulo ? `/api/commerce/cash/current?modulo=${modulo}` : '/api/commerce/cash/current'),
  openCashSession: (data: { saldoInicial: number; modulo: 'adega' | 'tabacaria' }) =>
    request<{ success: boolean; message: string; session: CommercialCashSession }>('/api/commerce/cash/open', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  addCashMovement: (sessionId: string, data: { tipo: 'suprimento' | 'sangria'; valor: number; motivo: string; autorizadoPor?: string }) =>
    request<{ success: boolean; message: string; session: CommercialCashSession }>(`/api/commerce/cash/${sessionId}/movement`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  closeCashSession: (sessionId: string, data: { saldoContadoDinheiro: number; observacoesFechamento?: string; observacoes?: string }) =>
    request<{ success: boolean; message: string; session: CommercialCashSession; diferenca: number }>(`/api/commerce/cash/${sessionId}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCashHistory: (modulo?: 'adega' | 'tabacaria') =>
    request<{ success?: boolean; sessions: CommercialCashSession[] }>(modulo ? `/api/commerce/cash/history?modulo=${modulo}` : '/api/commerce/cash/history'),
  createCommerceSale: (data: {
    modulo: 'adega' | 'tabacaria';
    itens: { productId: string; quantidade: number; precoUnitario: number; desconto?: number }[];
    formaPagamento: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'misto';
    valorPago?: number;
    descontoGeral?: number;
    clienteNome?: string;
    clienteDocumento?: string;
    verificacaoMaioridade: boolean;
    detalhesPagamento?: any;
    idempotencyKey?: string;
  }) =>
    request<{ success: boolean; message: string; sale: CommercialSale }>('/api/commerce/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCommerceSales: (modulo?: 'adega' | 'tabacaria') =>
    request<{ success?: boolean; sales: CommercialSale[] }>(modulo ? `/api/commerce/sales?modulo=${modulo}` : '/api/commerce/sales'),
  cancelCommerceSale: (id: string, data: { motivo: string }) =>
    request<{ success: boolean; message: string; sale: CommercialSale }>(`/api/commerce/sales/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  // PIX Real Methods
  generatePixCharge: (data: {
    modulo: 'adega' | 'tabacaria';
    valor: number;
    descricao?: string;
    itens?: any[];
    clienteNome?: string;
    clienteDocumento?: string;
    idempotencyKey?: string;
  }) =>
    request<{ success: boolean; charge: PixCharge; providerStatus: any }>('/api/commerce/pix/charge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPixChargeStatus: (txid: string) =>
    request<{ success: boolean; status: string; charge: PixCharge; providerStatus: any }>(`/api/commerce/pix/charge/${txid}`),
  confirmPixManual: (data: { txid: string; comprovanteReferencia?: string }) =>
    request<{ success: boolean; message: string; charge: PixCharge }>('/api/commerce/pix/confirm-manual', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelPixCharge: (data: { txid: string; motivo?: string }) =>
    request<{ success: boolean; message: string; charge: PixCharge }>('/api/commerce/pix/cancel', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPixProviderInfo: () =>
    request<{ success: boolean; provider: any }>('/api/commerce/pix/provider-info'),
  getCommerceSuppliers: () =>
    request<{ suppliers: CommercialSupplier[] }>('/api/commerce/suppliers'),
  createCommerceSupplier: (data: Partial<CommercialSupplier>) =>
    request<{ success: boolean; supplier: CommercialSupplier }>('/api/commerce/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCommercePurchases: () =>
    request<{ purchases: CommercialPurchase[] }>('/api/commerce/purchases'),
  createCommercePurchase: (data: {
    fornecedorId: string;
    fornecedorNome: string;
    numeroNota?: string;
    formaPagamento?: string;
    observacoes?: string;
    itens: { productId: string; quantidade: number; custoUnitario: number }[];
  }) =>
    request<{ success: boolean; purchase: CommercialPurchase }>('/api/commerce/purchases', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCommerceDashboard: (modulo?: 'adega' | 'tabacaria') =>
    request<CommercialDashboardMetrics>(modulo ? `/api/commerce/dashboard?modulo=${modulo}` : '/api/commerce/dashboard'),

  // Central de Integração de Maquininhas (POS / TEF)
  getCommercialTerminals: (params?: { modulo?: string; ativo?: string }) => {
    const q = new URLSearchParams();
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.ativo) q.set('ativo', params.ativo);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ success: boolean; terminals: CommercialTerminal[] }>(`/api/commerce/terminals${qs}`);
  },
  createCommercialTerminal: (data: Partial<CommercialTerminal> & { credenciais?: any }) =>
    request<{ success: boolean; message: string; terminal: CommercialTerminal }>('/api/commerce/terminals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCommercialTerminal: (id: string, data: Partial<CommercialTerminal> & { credenciais?: any }) =>
    request<{ success: boolean; message: string; terminal: CommercialTerminal }>(`/api/commerce/terminals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCommercialTerminal: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/commerce/terminals/${id}`, {
      method: 'DELETE',
    }),
  testCommercialTerminal: (id: string) =>
    request<{
      success: boolean;
      message: string;
      terminalStatus: string;
      batteryLevel?: number;
      details?: any;
      terminal: CommercialTerminal;
    }>(`/api/commerce/terminals/${id}/test`, {
      method: 'POST',
    }),
  createTerminalPaymentIntent: (
    terminalId: string,
    data: {
      valor: number;
      tipoOperacao: 'debito' | 'credito' | 'pix';
      parcelas?: number;
      modulo: 'adega' | 'tabacaria' | 'misto';
      codigoVenda?: string;
      caixaSessionId?: string;
      idempotencyKey?: string;
    }
  ) =>
    request<{
      success: boolean;
      transaction: CommercialTerminalTransaction;
      message: string;
    }>(`/api/commerce/terminals/${terminalId}/intent`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getTerminalPaymentIntentStatus: (intentId: string) =>
    request<{
      success: boolean;
      transaction: CommercialTerminalTransaction;
      status: string;
      message?: string;
    }>(`/api/commerce/terminals/intent/${intentId}/status`),
  cancelTerminalPaymentIntent: (intentId: string) =>
    request<{
      success: boolean;
      message: string;
      transaction: CommercialTerminalTransaction;
    }>(`/api/commerce/terminals/intent/${intentId}/cancel`, {
      method: 'POST',
    }),
  getTerminalTransactions: (params?: { terminalId?: string; modulo?: string; status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.terminalId) q.set('terminalId', params.terminalId);
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ success: boolean; transactions: CommercialTerminalTransaction[]; total: number }>(`/api/commerce/terminals/transactions${qs}`);
  },
  getTerminalReconciliation: (params?: { modulo?: string; dataInicio?: string; dataFim?: string }) => {
    const q = new URLSearchParams();
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.dataInicio) q.set('dataInicio', params.dataInicio);
    if (params?.dataFim) q.set('dataFim', params.dataFim);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<TerminalReconciliationReport>(`/api/commerce/terminals/reconciliation${qs}`);
  },

  // MoviLog Inteligente — Central de Prevenção
  getPreventionAlerts: (companyId?: string) =>
    request<{ alerts: PreventionAlert[]; metrics: PreventionMetrics }>(
      companyId ? `/api/prevention/alerts?companyId=${companyId}` : '/api/prevention/alerts'
    ),
  resolvePreventionAlert: (data: { alertId: string; tipo?: string; referenciaId?: string; motivoResolucao?: string }) =>
    request<{ success: boolean; message: string }>('/api/prevention/resolve', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  renotifyPreventionPackage: (packageId: string) =>
    request<{ success: boolean; message: string }>('/api/prevention/renotify-package', {
      method: 'POST',
      body: JSON.stringify({ packageId }),
    }),
  reschedulePreventionDelivery: (data: { deliveryId: string; novoPrazo?: string; motivo?: string }) =>
    request<{ success: boolean; message: string }>('/api/prevention/reschedule-delivery', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ============================================================================
  // ENTERPRISE LOGISTICS ECOSYSTEM — FASE 2: WAREHOUSING, ENDEREÇAMENTO & ESTOQUE
  // ============================================================================
  getWarehousesMetrics: () =>
    request<{
      success: boolean;
      metrics: {
        totalCdsAtivos: number;
        capacidadeTotalVolumes: number;
        capacidadeTotalKg: number;
        totalPosicoes: number;
        posicoesLivres: number;
        posicoesOcupadas: number;
        posicoesBloqueadas: number;
        taxaOcupacaoMediaPercentual: number;
        ocupadoTotalKg: number;
        ocupadoTotalVolumes: number;
        transferenciasEmTransito: number;
        inventariosPendentes: number;
        alertasCriticos: Array<{ cdNome: string; posicaoCodigo: string; tipo: string; mensagem: string }>;
      };
    }>('/api/warehouses/overview/metrics'),

  getWarehouses: () =>
    request<{ success: boolean; warehouses: WarehouseCD[] }>('/api/warehouses'),

  createWarehouse: (data: Partial<WarehouseCD> & { criarEstruturaInicial?: boolean }) =>
    request<{ success: boolean; message: string; warehouse: WarehouseCD }>('/api/warehouses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getWarehouse: (id: string) =>
    request<{
      success: boolean;
      warehouse: WarehouseCD;
      metrics: {
        totalPosicoes: number;
        posicoesOcupadas: number;
        posicoesLivres: number;
        taxaOcupacao: number;
        ocupadoKg: number;
        ocupadoVolumes: number;
        capacidadeKg: number;
        capacidadeVolumes: number;
      };
    }>(`/api/warehouses/${id}`),

  updateWarehouse: (id: string, data: Partial<WarehouseCD>) =>
    request<{ success: boolean; message: string; warehouse: WarehouseCD }>(`/api/warehouses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteWarehouse: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/warehouses/${id}`, {
      method: 'DELETE',
    }),

  createWarehousePosition: (warehouseId: string, data: Partial<WarehousePosition>) =>
    request<{ success: boolean; message: string; position: WarehousePosition }>(`/api/warehouses/${warehouseId}/positions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateWarehouseMatrix: (
    warehouseId: string,
    data: {
      ruas: string[];
      corredorPadrao?: string;
      prateleirasQtd: number;
      niveisQtd: number;
      tipoArmazenagem?: string;
      capacidadeKg?: number;
      capacidadeVolumes?: number;
    }
  ) =>
    request<{
      success: boolean;
      message: string;
      posicoesCriadas: number;
      totalPosicoes: number;
    }>(`/api/warehouses/${warehouseId}/positions/generate-matrix`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  patchWarehousePosition: (warehouseId: string, positionId: string, data: Partial<WarehousePosition>) =>
    request<{ success: boolean; message: string; position: WarehousePosition }>(`/api/warehouses/${warehouseId}/positions/${positionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  allocateWarehousePosition: (
    warehouseId: string,
    positionId: string,
    data: {
      itemId?: string;
      sku: string;
      nome: string;
      quantidade: number;
      pesoKg?: number;
      volumes?: number;
    }
  ) =>
    request<{ success: boolean; message: string; position: WarehousePosition }>(`/api/warehouses/${warehouseId}/positions/${positionId}/allocate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deallocateWarehousePosition: (
    warehouseId: string,
    positionId: string,
    data?: { quantidadeDesalocar?: number; motivo?: string }
  ) =>
    request<{ success: boolean; message: string; position: WarehousePosition }>(`/api/warehouses/${warehouseId}/positions/${positionId}/deallocate`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  getWarehouseTransfers: () =>
    request<{ success: boolean; transfers: WarehouseTransfer[] }>('/api/warehouses/transfers'),

  createWarehouseTransfer: (data: {
    cdOrigemId: string;
    cdDestinoId: string;
    tipo?: 'entre_galpoes' | 'interna_posicoes';
    itens: Array<{
      itemId?: string;
      sku: string;
      nome: string;
      quantidade: number;
      posicaoOrigem?: string;
      posicaoDestino?: string;
    }>;
    motoristaNome?: string;
    veiculoPlaca?: string;
    observacoes?: string;
  }) =>
    request<{ success: boolean; message: string; transfer: WarehouseTransfer }>('/api/warehouses/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateWarehouseTransferStatus: (
    id: string,
    data: {
      status: string;
      motoristaNome?: string;
      veiculoPlaca?: string;
      divergenciasAnotadas?: string;
    }
  ) =>
    request<{ success: boolean; message: string; transfer: WarehouseTransfer }>(`/api/warehouses/transfers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getWarehouseAudits: () =>
    request<{ success: boolean; audits: WarehouseInventoryAudit[] }>('/api/warehouses/audits'),

  createWarehouseAudit: (data: {
    cdId: string;
    tipoInventario?: 'ciclico' | 'rotativo_curva_a' | 'geral_completo';
    responsavelAuditoria?: string;
    observacoes?: string;
  }) =>
    request<{ success: boolean; message: string; audit: WarehouseInventoryAudit }>('/api/warehouses/audits', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  saveWarehouseAuditCounts: (
    id: string,
    data: {
      counts: Array<{
        posicaoCodigo: string;
        itemId?: string;
        saldoContado: number;
        custoUnitario?: number;
      }>;
    }
  ) =>
    request<{ success: boolean; message: string; audit: WarehouseInventoryAudit }>(`/api/warehouses/audits/${id}/counts`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  finalizeWarehouseAudit: (
    id: string,
    data: {
      aplicarAjustesNoEstoque: boolean;
      observacoesFinais?: string;
    }
  ) =>
    request<{ success: boolean; message: string; audit: WarehouseInventoryAudit }>(`/api/warehouses/audits/${id}/finalize`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ==========================================
  // FASE 3: FULFILLMENT & EXPEDIÇÃO (Infracommerce Standard)
  // ==========================================
  getFulfillmentMetrics: () =>
    request<{
      success: boolean;
      metrics: {
        totalPedidos: number;
        pedidosEmAndamento: number;
        pedidosRecebidos: number;
        pedidosEmSeparacao: number;
        pedidosEmEmbalagem: number;
        pedidosProntosExpedicao: number;
        pedidosEmTransito: number;
        pedidosEntregues: number;
        pedidosDevolvidos: number;
        pedidosCancelados: number;
        totalOndasAtivas: number;
        totalEmbaladosHoje: number;
        totalManifestosExpedidos: number;
        taxaOtifPercentual: number;
        tempoMedioCicloMinutos: number;
        alertasRiscoSla: any[];
        totalReversas: number;
      };
    }>('/api/fulfillment/metrics'),

  getFulfillmentOrders: (params?: { stage?: string; cdId?: string; canal?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.stage) q.set('stage', params.stage);
    if (params?.cdId) q.set('cdId', params.cdId);
    if (params?.canal) q.set('canal', params.canal);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ success: boolean; orders: FulfillmentOrder[] }>(`/api/fulfillment/orders${qs}`);
  },

  getFulfillmentOrder: (id: string) =>
    request<{
      success: boolean;
      order: FulfillmentOrder;
      pickingTask?: PickingTask;
      packingTask?: PackingTask;
      manifest?: ShippingManifest;
    }>(`/api/fulfillment/orders/${id}`),

  createFulfillmentOrder: (data: any) =>
    request<{ success: boolean; message: string; order: FulfillmentOrder }>('/api/fulfillment/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateFulfillmentOrderStage: (
    id: string,
    data: {
      novaEtapa: FulfillmentStage;
      observacao?: string;
      responsavelNome?: string;
    }
  ) =>
    request<{ success: boolean; message: string; order: FulfillmentOrder }>(`/api/fulfillment/orders/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getWavePickingTasks: () =>
    request<{ success: boolean; waves: PickingTask[] }>('/api/fulfillment/picking/waves'),

  createWavePickingTask: (data: {
    pedidosIds: string[];
    tipo?: 'single_order' | 'batch_wave';
    operadorNome?: string;
    cdId?: string;
  }) =>
    request<{ success: boolean; message: string; wave: PickingTask }>('/api/fulfillment/picking/waves', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  pickWaveItem: (
    waveId: string,
    data: {
      itemIndex?: number;
      sku?: string;
      marcarTodos?: boolean;
    }
  ) =>
    request<{ success: boolean; message: string; wave: PickingTask }>(`/api/fulfillment/picking/waves/${waveId}/items`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getPackingTasks: () =>
    request<{ success: boolean; tasks: PackingTask[] }>('/api/fulfillment/packing/tasks'),

  executePacking: (data: {
    pedidoId: string;
    tipoEmbalagem?: string;
    pesoBalancaKg: number;
    lacreNumero?: string;
    embaladorNome?: string;
    ignorarDivergenciaPeso?: boolean;
  }) =>
    request<{
      success: boolean;
      message: string;
      packingTask: PackingTask;
      etiquetaCodigo: string;
      codigoRastreio: string;
      order: FulfillmentOrder;
    }>('/api/fulfillment/packing/pack', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getShippingManifests: () =>
    request<{ success: boolean; manifests: ShippingManifest[] }>('/api/fulfillment/manifests'),

  createShippingManifest: (data: {
    cdId?: string;
    transportadoraNome?: string;
    motoristaNome?: string;
    veiculoPlaca?: string;
    pedidosIds: string[];
    observacoes?: string;
  }) =>
    request<{ success: boolean; message: string; manifest: ShippingManifest }>('/api/fulfillment/manifests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getReverseLogistics: () =>
    request<{ success: boolean; tickets: ReverseLogisticsTicket[] }>('/api/fulfillment/reversa'),

  createReverseTicket: (data: Partial<ReverseLogisticsTicket>) =>
    request<{ success: boolean; message: string; ticket: ReverseLogisticsTicket }>('/api/fulfillment/reversa', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  triageReverseTicket: (
    id: string,
    data: {
      condicaoAposTriagem: 'perfeito_reestocar' | 'avariado_descarte' | 'reparo_necessario';
      cdDestinoId?: string;
      posicaoEndereco?: string;
      laudoInspecao?: string;
      liberarEstorno?: boolean;
    }
  ) =>
    request<{ success: boolean; message: string; ticket: ReverseLogisticsTicket }>(`/api/fulfillment/reversa/${id}/triagem`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // ============================================================================
  // ADEGA & TABACARIA — EVOLUÇÃO COMPLETA (4 FASES)
  // ============================================================================

  // FASE 1: Radar MoviLog, Estoque Inteligente, Reposição & Alertas
  getCommerceRadar: (modulo?: 'adega' | 'tabacaria') =>
    request<{
      success: boolean;
      resumo: {
        totalProdutosAtivos: number;
        alertasAtivosCount: number;
        alertasCriticosCount: number;
        alertasResolvidosCount: number;
        itensEmRupturaCount: number;
        itensCriticosCount: number;
        itensEmAtencaoCount: number;
        itensParadosCount: number;
        reposicoesPendentesCount: number;
        pedidosEmAndamentoCount: number;
        totalCapitalCusto: number;
        capitalParadoCusto: number;
      };
      alertasPrioritarios: CommercialAlert[];
      itensRiscoRuptura: SmartStockItem[];
      itensParados: SmartStockItem[];
      recomendacoes: {
        id: string;
        prioridade: 'critica' | 'alta' | 'media';
        titulo: string;
        justificativa: string;
        rotaSugerida: string;
        acaoLabel: string;
      }[];
    }>(modulo ? `/api/commerce/radar?modulo=${modulo}` : '/api/commerce/radar'),

  getCommerceSmartStock: (params?: { modulo?: 'adega' | 'tabacaria'; status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ success: boolean; items: SmartStockItem[]; total: number }>(`/api/commerce/smart-stock${qs}`);
  },

  getCommerceReplenishments: (params?: { modulo?: 'adega' | 'tabacaria'; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ success: boolean; replenishments: CommercialReplenishment[]; total: number }>(`/api/commerce/replenishments${qs}`);
  },

  reviewCommerceReplenishment: (
    id: string,
    data: {
      acao: 'aprovar' | 'descartar';
      quantidadeAprovada?: number;
      fornecedorId?: string;
      gerarPedidoCompra?: boolean;
      observacoes?: string;
    }
  ) =>
    request<{
      success: boolean;
      message: string;
      replenishment: CommercialReplenishment;
      purchase?: CommercialPurchase | null;
    }>(`/api/commerce/replenishments/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCommerceAlerts: (params?: { modulo?: 'adega' | 'tabacaria'; status?: string; prioridade?: string; categoria?: string }) => {
    const q = new URLSearchParams();
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.status) q.set('status', params.status);
    if (params?.prioridade) q.set('prioridade', params.prioridade);
    if (params?.categoria) q.set('categoria', params.categoria);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ success: boolean; alerts: CommercialAlert[]; total: number }>(`/api/commerce/alerts${qs}`);
  },

  resolveCommerceAlert: (id: string, motivoResolucao?: string) =>
    request<{ success: boolean; message: string; alert: CommercialAlert }>(`/api/commerce/alerts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ motivoResolucao }),
    }),

  // FASE 2: Rentabilidade, Produtos Histórico, Fornecedores, Compras Status, Perdas, Inventário & Fechamento
  getCommerceProfitability: (params?: { modulo?: 'adega' | 'tabacaria'; dataInicio?: string; dataFim?: string }) => {
    const q = new URLSearchParams();
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.dataInicio) q.set('dataInicio', params.dataInicio);
    if (params?.dataFim) q.set('dataFim', params.dataFim);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ success: boolean; metrics: any }>(`/api/commerce/profitability${qs}`);
  },

  getCommerceProductHistory: (id: string) =>
    request<{
      success: boolean;
      product: CommercialProduct;
      financeiro: { lucroUnitario: number; margemVendaPercentual: number; markupPercentual: number };
      custoHistorico: any[];
      movements: CommercialStockMovement[];
      purchases: any[];
    }>(`/api/commerce/products/${id}/history`),

  updateCommerceSupplier: (id: string, data: Partial<CommercialSupplier>) =>
    request<{ success: boolean; message: string; supplier: CommercialSupplier }>(`/api/commerce/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getCommerceSupplierHistory: (id: string) =>
    request<{
      success: boolean;
      supplier: CommercialSupplier;
      purchases: CommercialPurchase[];
      totalCompras: number;
      totalComprado: number;
    }>(`/api/commerce/suppliers/${id}/history`),

  updateCommercePurchaseStatus: (id: string, data: { status: string; numeroNota?: string; observacoes?: string }) =>
    request<{ success: boolean; message: string; purchase: CommercialPurchase }>(`/api/commerce/purchases/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getCommerceLosses: (params?: { modulo?: 'adega' | 'tabacaria'; tipo?: string; dataInicio?: string; dataFim?: string }) => {
    const q = new URLSearchParams();
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.tipo) q.set('tipo', params.tipo);
    if (params?.dataInicio) q.set('dataInicio', params.dataInicio);
    if (params?.dataFim) q.set('dataFim', params.dataFim);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{
      success: boolean;
      losses: CommercialLoss[];
      totalQtd: number;
      totalImpactoFinanceiro: number;
    }>(`/api/commerce/losses${qs}`);
  },

  createCommerceLoss: (data: {
    productId: string;
    tipo: CommercialLossReason;
    quantidade: number;
    motivo: string;
    dataPerda?: string;
  }) =>
    request<{ success: boolean; message: string; loss: CommercialLoss; product: CommercialProduct }>('/api/commerce/losses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCommerceInventories: () =>
    request<{ success: boolean; inventories: CommercialInventory[] }>('/api/commerce/inventories'),

  createCommerceInventory: (data: { modulo: 'adega' | 'tabacaria' | 'ambos'; observacoes?: string }) =>
    request<{ success: boolean; message: string; inventory: CommercialInventory }>('/api/commerce/inventories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  saveCommerceInventoryCount: (
    id: string,
    data: { counts: { productId: string; saldoContado: number | null; justificativa?: string }[]; finalizarConferencia?: boolean }
  ) =>
    request<{ success: boolean; message: string; inventory: CommercialInventory }>(`/api/commerce/inventories/${id}/count`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  approveCommerceInventory: (id: string, observacoes?: string) =>
    request<{ success: boolean; message: string; inventory: CommercialInventory }>(`/api/commerce/inventories/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ observacoes }),
    }),

  getCommerceClosings: () =>
    request<{ success: boolean; closings: CommercialPeriodClosing[] }>('/api/commerce/closings'),

  createCommerceClosing: (data: { modulo: 'adega' | 'tabacaria' | 'ambos'; dataInicio: string; dataFim: string; observacoes?: string }) =>
    request<{ success: boolean; message: string; closing: CommercialPeriodClosing }>('/api/commerce/closings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // FASE 3: Pedidos, Entregas, Clientes (LGPD) & Catálogo Digital
  getCommerceOrders: (params?: { status?: string; modulo?: string; tipoAtendimento?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.tipoAtendimento) q.set('tipoAtendimento', params.tipoAtendimento);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ success: boolean; orders: CommercialOrder[]; total: number }>(`/api/commerce/orders${qs}`);
  },

  createCommerceOrder: (data: any) =>
    request<{ success: boolean; message: string; order: CommercialOrder }>('/api/commerce/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCommerceOrderStatus: (
    id: string,
    data: {
      status: CommercialOrderStatus;
      observacao?: string;
      entregadorId?: string;
      entregadorNome?: string;
      entregadorTelefone?: string;
      verificacaoMaioridadeEntrega?: boolean;
      motivoCancelamento?: string;
    }
  ) =>
    request<{ success: boolean; message: string; order: CommercialOrder }>(`/api/commerce/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addCommerceOrderOccurrence: (id: string, descricao: string) =>
    request<{ success: boolean; message: string; order: CommercialOrder }>(`/api/commerce/orders/${id}/occurrences`, {
      method: 'POST',
      body: JSON.stringify({ descricao }),
    }),

  getCommerceCustomers: (search?: string) =>
    request<{ success: boolean; customers: (CommercialCustomer & { totalPedidos?: number; ultimoPedidoEm?: string | null })[] }>(
      search ? `/api/commerce/customers?search=${encodeURIComponent(search)}` : '/api/commerce/customers'
    ),

  createCommerceCustomer: (data: Partial<CommercialCustomer>) =>
    request<{ success: boolean; message: string; customer: CommercialCustomer }>('/api/commerce/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCommerceCustomer: (id: string, data: Partial<CommercialCustomer>) =>
    request<{ success: boolean; message: string; customer: CommercialCustomer }>(`/api/commerce/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  anonymizeCommerceCustomer: (id: string) =>
    request<{ success: boolean; message: string; customer: CommercialCustomer }>(`/api/commerce/customers/${id}/anonymize`, {
      method: 'POST',
    }),

  getCommerceCatalogPreview: () =>
    request<{
      success: boolean;
      companyId: string;
      catalogoPublicoAtivo: boolean;
      catalogoTitulo?: string;
      whatsappPedidos?: string;
      publicPath: string;
      items: any[];
      blockedRestrictedCount: number;
    }>('/api/commerce/catalog'),

  getPublicCommerceCatalog: (companyId: string, params?: { modulo?: string; categoria?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.categoria) q.set('categoria', params.categoria);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{
      success: boolean;
      store: { companyId: string; nome: string; titulo: string; whatsapp: string | null; avisoLegal: string };
      categories: string[];
      items: any[];
      total: number;
    }>(`/api/commerce/catalog/public/${encodeURIComponent(companyId)}${qs}`);
  },

  // FASE 4: Implantação, Modo Espelho 7 dias, Importação CSV/XLSX, Avaliação & Migração
  getCommercePilot: () =>
    request<{
      success: boolean;
      pilot: CommercialPilotConfig;
      diasRestantesEspelho: number | null;
      progressoChecklistPercentual: number;
      estatisticasEspelho: {
        produtosImportadosEspelho: number;
        produtosCadastradosMovilog: number;
        fornecedoresImportadosEspelho: number;
        fornecedoresMovilog: number;
        vendasRegistradasMovilog: number;
        pedidosRegistradosMovilog: number;
        lotesImportacao: number;
      };
    }>('/api/commerce/pilot'),

  updateCommercePilot: (data: any) =>
    request<{ success: boolean; message: string; pilot: CommercialPilotConfig }>('/api/commerce/pilot', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleCommerceMirrorMode: (data: { action: 'start' | 'pause' | 'resume'; sistemaAnteriorNome?: string; observacoes?: string }) =>
    request<{ success: boolean; message: string; pilot: CommercialPilotConfig }>('/api/commerce/pilot/mirror-mode', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  parseCommerceImport: (data: { fileName: string; contentBase64?: string; csvText?: string; tipoAlvo: 'produtos' | 'fornecedores' }) =>
    request<{
      success: boolean;
      formato: 'csv' | 'xlsx';
      headers: string[];
      suggestedMapping: Record<string, string>;
      totalLinhas: number;
      rows: Record<string, string>[];
      existingKeys: { skusCount: number; barcodesCount: number; cnpjsCount: number };
    }>('/api/commerce/imports/parse', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  commitCommerceImport: (data: {
    fileName: string;
    formato: 'csv' | 'xlsx';
    tipoAlvo: 'produtos' | 'fornecedores';
    modulo: 'adega' | 'tabacaria';
    modoEspelho: boolean;
    mapeamentoColunas: Record<string, string>;
    rows: Record<string, any>[];
  }) =>
    request<{ success: boolean; message: string; batch: CommercialImportBatch }>('/api/commerce/imports/commit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCommerceImportHistory: () =>
    request<{ success: boolean; batches: CommercialImportBatch[] }>('/api/commerce/imports/history'),

  getCommercePilotEvaluation: () =>
    request<{
      success: boolean;
      pilot: CommercialPilotConfig;
      metricasReais: {
        produtosTotais: number;
        produtosImportadosEspelho: number;
        vendasPdvQtd: number;
        faturamentoPdvValor: number;
        pedidosQtd: number;
        pedidosEntreguesQtd: number;
        perdasRegistradasQtd: number;
        perdasValor: number;
        inventariosQtd: number;
        alertasResolvidosQtd: number;
        clientesAtivosQtd: number;
        importacoesRealizadasQtd: number;
        recursosUtilizadosCount: number;
        recursosTotaisCount: number;
      };
      recursosAvaliados: { recurso: string; utilizado: boolean; registros: number }[];
      notaAvaliacao: string;
    }>('/api/commerce/pilot/evaluation'),

  executeCommerceMigrationAction: (data: {
    action: 'check_conflicts' | 'start' | 'complete_step' | 'pause' | 'resume' | 'complete';
    etapa?: string;
    observacao?: string;
  }) =>
    request<{
      success: boolean;
      message: string;
      pilot: CommercialPilotConfig;
      checklistResumo: {
        produtosTotal: number;
        fornecedoresTotal: number;
        duplicateSkuCount: number;
        missingPriceCount: number;
        conflicts: number;
      };
    }>('/api/commerce/migration/action', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// WhatsApp Sales helper generator
export const buildWhatsAppSalesUrl = (
  whatsappNumber: string,
  planName: string,
  companyName: string = '',
  cnpj: string = '',
  priceStr: string = '',
  periodStr: string = 'Mensal',
  solicitacaoId?: string
): string => {
  const cleanPhone = (whatsappNumber || '5511999999999').replace(/\D/g, '');
  const solicitacaoLine = solicitacaoId ? `\nIdentificador da Solicitação: ${solicitacaoId}` : '';
  const message = `Olá! Tenho interesse em contratar a plataforma MoviLog (${planName}).

Empresa: ${companyName || 'Nova Empresa'}
CNPJ: ${cnpj || 'A informar'}
Plano: ${planName}
Valor informado: ${priceStr || 'A combinar'}
Período: ${periodStr}${solicitacaoLine}

Gostaria de receber instruções para ativação imediata.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};
