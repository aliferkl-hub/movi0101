import React, { useState, useEffect } from 'react';
import { CommercePOSView } from './CommercePOSView';
import { CommerceProductsView } from './CommerceProductsView';
import { CommerceStockView } from './CommerceStockView';
import { CommerceCashView } from './CommerceCashView';
import { CommercePurchasesView } from './CommercePurchasesView';
import { CommerceDashboardView } from './CommerceDashboardView';
import { TerminalsIntegrationView } from './TerminalsIntegrationView';

// Fase 1 — Radar, Estoque Inteligente, Reposição & Alertas
import { RadarDashboardView } from './phase1/RadarDashboardView';
import { SmartStockView } from './phase1/SmartStockView';
import { ReplenishmentCenterView } from './phase1/ReplenishmentCenterView';
import { AlertsCenterView } from './phase1/AlertsCenterView';

// Fase 2 — Rentabilidade, Fornecedores, Perdas, Inventário & Fechamento
import { ProfitabilityDashboardView } from './phase2/ProfitabilityDashboardView';
import { SuppliersCenterView } from './phase2/SuppliersCenterView';
import { LossesControlView } from './phase2/LossesControlView';
import { InventoryCountView } from './phase2/InventoryCountView';
import { ManagerialClosingView } from './phase2/ManagerialClosingView';

// Fase 3 — Pedidos, Entregas, Clientes (LGPD) & Catálogo Digital
import { OrdersCenterView } from './phase3/OrdersCenterView';
import { DeliveriesCenterView } from './phase3/DeliveriesCenterView';
import { CustomersCenterView } from './phase3/CustomersCenterView';
import { DigitalCatalogView } from './phase3/DigitalCatalogView';

// Fase 4 — Implantação, Modo Espelho, Importação, Tutoriais, Avaliação & Migração
import { OnboardingCenterView } from './phase4/OnboardingCenterView';
import { MirrorModeView } from './phase4/MirrorModeView';
import { ImportCenterView } from './phase4/ImportCenterView';
import { TutorialsCenterView } from './phase4/TutorialsCenterView';
import { EvaluationReportView } from './phase4/EvaluationReportView';
import { MigrationCenterView } from './phase4/MigrationCenterView';

import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  Flame,
  Layers,
  Navigation,
  Package,
  PackageMinus,
  Radar,
  RefreshCw,
  Rocket,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wine,
} from 'lucide-react';

export type CommerceTabId =
  | 'pos'
  | 'orders'
  | 'deliveries'
  | 'cash'
  | 'terminals'
  | 'radar'
  | 'smart_stock'
  | 'replenishment'
  | 'alerts'
  | 'stock'
  | 'products'
  | 'suppliers'
  | 'purchases'
  | 'losses'
  | 'inventory_count'
  | 'profitability'
  | 'closing'
  | 'dashboard'
  | 'customers'
  | 'catalog'
  | 'onboarding'
  | 'mirror_mode'
  | 'import_center'
  | 'tutorials'
  | 'evaluation'
  | 'migration';

type GroupId = 'operacao' | 'radar' | 'gestao' | 'clientes' | 'piloto';

interface TabItem {
  id: CommerceTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: GroupId;
}

const ALL_TABS: TabItem[] = [
  // 1. Operação Diária
  { id: 'pos', label: 'PDV & Vendas', icon: ShoppingCart, group: 'operacao' },
  { id: 'orders', label: 'Pedidos', icon: ShoppingBag, group: 'operacao' },
  { id: 'deliveries', label: 'Entregas Locais', icon: Navigation, group: 'operacao' },
  { id: 'cash', label: 'Caixa & Turno', icon: Wallet, group: 'operacao' },
  { id: 'terminals', label: 'Maquininhas (POS)', icon: CreditCard, group: 'operacao' },

  // 2. Radar & Estoque
  { id: 'radar', label: 'Radar MoviLog', icon: Radar, group: 'radar' },
  { id: 'smart_stock', label: 'Estoque Inteligente', icon: Activity, group: 'radar' },
  { id: 'replenishment', label: 'Reposição', icon: RefreshCw, group: 'radar' },
  { id: 'alerts', label: 'Alertas', icon: Bell, group: 'radar' },
  { id: 'stock', label: 'Movimentações', icon: Boxes, group: 'radar' },

  // 3. Gestão & Controle
  { id: 'products', label: 'Produtos & Preços', icon: Package, group: 'gestao' },
  { id: 'suppliers', label: 'Fornecedores', icon: Building2, group: 'gestao' },
  { id: 'purchases', label: 'Compras & Notas', icon: Truck, group: 'gestao' },
  { id: 'losses', label: 'Perdas & Avarias', icon: PackageMinus, group: 'gestao' },
  { id: 'inventory_count', label: 'Inventário Físico', icon: ClipboardCheck, group: 'gestao' },
  { id: 'profitability', label: 'Rentabilidade', icon: TrendingUp, group: 'gestao' },
  { id: 'closing', label: 'Fechamento Gerencial', icon: CalendarCheck, group: 'gestao' },
  { id: 'dashboard', label: 'Indicadores Gerais', icon: BarChart3, group: 'gestao' },

  // 4. Clientes & Vitrine
  { id: 'customers', label: 'Clientes (LGPD)', icon: Users, group: 'clientes' },
  { id: 'catalog', label: 'Catálogo Digital + QR', icon: Store, group: 'clientes' },

  // 5. Implantação & 7 Dias
  { id: 'onboarding', label: 'Implantação', icon: Rocket, group: 'piloto' },
  { id: 'mirror_mode', label: 'Modo Espelho (7d)', icon: Layers, group: 'piloto' },
  { id: 'import_center', label: 'Importação CSV/XLSX', icon: FileSpreadsheet, group: 'piloto' },
  { id: 'tutorials', label: 'Tutoriais', icon: BookOpen, group: 'piloto' },
  { id: 'evaluation', label: 'Avaliação 7d', icon: BarChart3, group: 'piloto' },
  { id: 'migration', label: 'Migração Controlada', icon: ArrowRightLeft, group: 'piloto' },
];

const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'operacao', label: '1. Operação Diária' },
  { id: 'radar', label: '2. Radar & Estoque' },
  { id: 'gestao', label: '3. Gestão & Controle' },
  { id: 'clientes', label: '4. Clientes & Vitrine' },
  { id: 'piloto', label: '5. Implantação & Piloto' },
];

const VALID_TAB_IDS = new Set<string>(ALL_TABS.map((t) => t.id));

interface CommerceModuleViewProps {
  modulo: 'adega' | 'tabacaria';
  activeView?: string;
  onNavigate: (module: string, view?: string) => void;
}

export const CommerceModuleView: React.FC<CommerceModuleViewProps> = ({
  modulo,
  activeView = 'pos',
  onNavigate,
}) => {
  const initialTab: CommerceTabId = VALID_TAB_IDS.has(activeView)
    ? (activeView as CommerceTabId)
    : 'pos';

  const [currentTab, setCurrentTab] = useState<CommerceTabId>(initialTab);
  const [activeGroup, setActiveGroup] = useState<GroupId>(
    ALL_TABS.find((t) => t.id === initialTab)?.group || 'operacao'
  );

  useEffect(() => {
    if (activeView && VALID_TAB_IDS.has(activeView)) {
      const next = activeView as CommerceTabId;
      setCurrentTab(next);
      const grp = ALL_TABS.find((t) => t.id === next)?.group;
      if (grp) setActiveGroup(grp);
    }
  }, [activeView]);

  const navigateTab = (tabId: string) => {
    const resolved: CommerceTabId = VALID_TAB_IDS.has(tabId) ? (tabId as CommerceTabId) : 'pos';
    setCurrentTab(resolved);
    const grp = ALL_TABS.find((t) => t.id === resolved)?.group;
    if (grp) setActiveGroup(grp);
    onNavigate(modulo, resolved);
  };

  const handleSelectGroup = (grp: GroupId) => {
    setActiveGroup(grp);
    const currentItem = ALL_TABS.find((t) => t.id === currentTab);
    if (!currentItem || currentItem.group !== grp) {
      const firstOfGroup = ALL_TABS.find((t) => t.group === grp);
      if (firstOfGroup) {
        setCurrentTab(firstOfGroup.id);
        onNavigate(modulo, firstOfGroup.id);
      }
    }
  };

  const isAdega = modulo === 'adega';
  const visibleTabs = ALL_TABS.filter((t) => t.group === activeGroup);

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#121024] via-[#1A1633] to-[#121024] border border-[#262042] rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${
              isAdega
                ? 'bg-purple-600/20 text-purple-400 border-purple-500/40 shadow-purple-900/20'
                : 'bg-amber-600/20 text-amber-400 border-amber-500/40 shadow-amber-900/20'
            }`}
          >
            {isAdega ? <Wine className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-white tracking-tight">
                {isAdega ? 'Módulo Adega & Bebidas' : 'Módulo Tabacaria & Headshop'}
              </h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isAdega
                    ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {isAdega ? 'Bebidas & Conveniência' : 'Tabacaria & Artigos'}
              </span>
            </div>
            <p className="text-xs text-[#AAA6B5]">
              Gestão comercial inteligente: PDV rápido +18, Radar de reposição, Rentabilidade, Entregas e Modo Espelho 7 dias.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => navigateTab('radar')}
            className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5 transition"
          >
            <Radar className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Radar MoviLog</span>
          </button>

          <button
            onClick={() => onNavigate(isAdega ? 'tabacaria' : 'adega', currentTab)}
            className="px-3.5 py-2 bg-[#0A0714] hover:bg-[#1A1633] border border-[#262042] text-xs font-semibold text-[#C4B5FD] rounded-xl flex items-center gap-2 transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Alternar para {isAdega ? 'Tabacaria' : 'Adega'}</span>
          </button>
        </div>
      </div>

      {/* Group Selector + Contextual Sub-Navigation */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#262042]">
          {GROUPS.map((grp) => {
            const active = activeGroup === grp.id;
            return (
              <button
                key={grp.id}
                onClick={() => handleSelectGroup(grp.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  active
                    ? 'bg-[#8B5CF6]/20 text-white border border-[#8B5CF6]/50'
                    : 'text-[#AAA6B5] hover:text-white hover:bg-[#1A1633]/50 border border-transparent'
                }`}
              >
                {grp.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigateTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/30'
                    : 'text-[#AAA6B5] hover:text-white hover:bg-[#0A0714]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Screen Contents */}
      <div>
        {/* Operação Diária */}
        {currentTab === 'pos' && (
          <CommercePOSView modulo={modulo} onNavigateToCash={() => navigateTab('cash')} />
        )}
        {currentTab === 'orders' && <OrdersCenterView modulo={modulo} />}
        {currentTab === 'deliveries' && <DeliveriesCenterView modulo={modulo} />}
        {currentTab === 'cash' && <CommerceCashView modulo={modulo} />}
        {currentTab === 'terminals' && (
          <TerminalsIntegrationView
            initialModulo={modulo}
            onNavigateToPOS={(m) => onNavigate(m, 'pos')}
          />
        )}

        {/* Radar & Estoque */}
        {currentTab === 'radar' && (
          <RadarDashboardView modulo={modulo} onNavigateTab={navigateTab} />
        )}
        {currentTab === 'smart_stock' && (
          <SmartStockView modulo={modulo} onNavigateTab={navigateTab} />
        )}
        {currentTab === 'replenishment' && (
          <ReplenishmentCenterView modulo={modulo} onNavigateTab={navigateTab} />
        )}
        {currentTab === 'alerts' && (
          <AlertsCenterView modulo={modulo} onNavigateTab={navigateTab} />
        )}
        {currentTab === 'stock' && <CommerceStockView modulo={modulo} />}

        {/* Gestão & Controle */}
        {currentTab === 'products' && (
          <CommerceProductsView modulo={modulo} onNavigateToStock={() => navigateTab('stock')} />
        )}
        {currentTab === 'suppliers' && <SuppliersCenterView modulo={modulo} />}
        {currentTab === 'purchases' && <CommercePurchasesView modulo={modulo} />}
        {currentTab === 'losses' && <LossesControlView modulo={modulo} />}
        {currentTab === 'inventory_count' && <InventoryCountView modulo={modulo} />}
        {currentTab === 'profitability' && (
          <ProfitabilityDashboardView modulo={modulo} onNavigateTab={navigateTab} />
        )}
        {currentTab === 'closing' && <ManagerialClosingView modulo={modulo} />}
        {currentTab === 'dashboard' && (
          <CommerceDashboardView modulo={modulo} onNavigateToTab={navigateTab} />
        )}

        {/* Clientes & Vitrine */}
        {currentTab === 'customers' && <CustomersCenterView />}
        {currentTab === 'catalog' && <DigitalCatalogView />}

        {/* Implantação & 7 Dias */}
        {currentTab === 'onboarding' && <OnboardingCenterView onNavigateTab={navigateTab} />}
        {currentTab === 'mirror_mode' && <MirrorModeView onNavigateTab={navigateTab} />}
        {currentTab === 'import_center' && <ImportCenterView modulo={modulo} />}
        {currentTab === 'tutorials' && <TutorialsCenterView onNavigateTab={navigateTab} />}
        {currentTab === 'evaluation' && <EvaluationReportView />}
        {currentTab === 'migration' && <MigrationCenterView />}
      </div>
    </div>
  );
};
