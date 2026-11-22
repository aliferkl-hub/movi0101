import React, { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface TutorialsCenterViewProps {
  onNavigateTab: (tab: string) => void;
}

const GUIDES = [
  {
    id: 'g-pos',
    perfil: 'Operador de Balcão',
    titulo: '1. Abertura de Caixa, Venda Rápida no PDV & Regra +18',
    targetTab: 'pos',
    passos: [
      'Acesse "Caixa & Fechamento" e informe o saldo inicial em dinheiro antes de iniciar o turno.',
      'No PDV, utilize o leitor de código de barras (ou busca por nome/SKU) para adicionar bebidas ou itens de tabacaria.',
      'Quando o carrinho contiver bebida alcoólica ou derivado de tabaco (+18), marque a confirmação obrigatória de conferência documental.',
      'Finalize com Dinheiro, PIX (QR Code instantâneo) ou Maquininha integrada e confira a baixa automática do estoque.',
    ],
  },
  {
    id: 'g-stock',
    perfil: 'Gestor / Comprador',
    titulo: '2. Radar MoviLog, Estoque Inteligente & Central de Reposição',
    targetTab: 'smart_stock',
    passos: [
      'Consulte o Radar MoviLog diariamente para identificar itens zerados, abaixo do mínimo ou parados há mais de 30 dias.',
      'No Estoque Inteligente, acompanhe os dias estimados de cobertura baseados exclusivamente no histórico real de vendas.',
      'Na Central de Reposição, revise a quantidade sugerida, selecione o fornecedor e aprove gerando o Pedido de Compra.',
      'Quando a mercadoria chegar na loja, confirme o recebimento em Compras para creditar o estoque automaticamente.',
    ],
  },
  {
    id: 'g-fin',
    perfil: 'Financeiro / Gerência',
    titulo: '3. Rentabilidade, Perdas, Inventário Físico & Fechamento',
    targetTab: 'profitability',
    passos: [
      'Em Rentabilidade, verifique a receita bruta, CMV, lucro bruto estimado e produtos com margem abaixo de 20%.',
      'Sempre que houver quebra de garrafa, vencimento ou descarte, registre em "Controle de Perdas" para manter o estoque exato.',
      'Execute contagens periódicas no "Inventário Físico", analise divergências financeiras e aprove o ajuste auditado.',
      'Ao final da semana ou mês, consolide o "Fechamento Gerencial" e exporte o arquivo CSV para contabilidade.',
    ],
  },
  {
    id: 'g-orders',
    perfil: 'Atendimento & Delivery',
    titulo: '4. Pedidos Locais, Entregas, Clientes (LGPD) & Catálogo QR Code',
    targetTab: 'orders',
    passos: [
      'Cadastre pedidos de entrega ou retirada no balcão em "Central de Pedidos" — o sistema reserva o estoque na hora.',
      'Itens +18 exigem confirmação dupla: aviso ao cliente na criação do pedido e conferência presencial na entrega.',
      'Em "Entregas", atribua o entregador, acione o cliente via WhatsApp se necessário e registre ocorrências.',
      'No "Catálogo Digital", gere o QR Code de vitrine: itens alcoólicos e tabaco são bloqueados automaticamente por lei.',
    ],
  },
  {
    id: 'g-pilot',
    perfil: 'Administrador / Implantação',
    titulo: '5. Piloto em Modo Espelho (7 Dias), Importação XLSX/CSV & Virada',
    targetTab: 'mirror_mode',
    passos: [
      'Ative o "Modo Espelho" na Central para operar em paralelo por 7 dias sem alterar seu sistema atual.',
      'Baixe o modelo XLSX ou CSV na "Central de Importação", suba seus produtos/fornecedores e revise o mapeamento.',
      'Acompanhe a adesão real da equipe no "Relatório de Avaliação" ao longo dos 7 dias.',
      'Quando estiver satisfeito, acesse "Migração Controlada", execute a verificação de conflitos e conclua a virada definitiva.',
    ],
  },
];

export const TutorialsCenterView: React.FC<TutorialsCenterViewProps> = ({ onNavigateTab }) => {
  const [openId, setOpenId] = useState<string>(GUIDES[0].id);

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#8B5CF6]" />
          Central de Tutoriais & Manuais Operacionais
        </h2>
        <p className="text-xs text-[#AAA6B5]">
          Fluxos objetivos organizados por perfil para treinar operadores, entregadores e gestores em poucos minutos.
        </p>
      </div>

      <div className="space-y-3">
        {GUIDES.map((g) => {
          const isOpen = openId === g.id;
          return (
            <div key={g.id} className="bg-[#121024] border border-[#262042] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? '' : g.id)}
                className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-[#1A1633]/40 transition"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#8B5CF6]/15 text-[#C4B5FD]">
                    {g.perfil}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1.5">{g.titulo}</h3>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-[#AAA6B5] shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#AAA6B5] shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-[#262042] space-y-4">
                  <div className="space-y-2 pt-3">
                    {g.passos.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-[#E2E0EC]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab(g.targetTab)}
                    className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <span>Abrir Funcionalidade</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
