import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import {
  AlertTriangle,
  MessageCircle,
  Search,
  ShieldCheck,
  Store,
} from 'lucide-react';

interface PublicCatalogPageProps {
  companyId: string;
}

export const PublicCatalogPage: React.FC<PublicCatalogPageProps> = ({ companyId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<{
    companyId: string;
    nome: string;
    titulo: string;
    whatsapp: string | null;
    avisoLegal: string;
  } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState('todas');
  const [selectedMod, setSelectedMod] = useState('todos');
  const [search, setSearch] = useState('');

  const loadPublic = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPublicCommerceCatalog(companyId, {
        modulo: selectedMod !== 'todos' ? selectedMod : undefined,
        categoria: selectedCat !== 'todas' ? selectedCat : undefined,
        search: search || undefined,
      });
      setStore(res.store);
      setCategories(res.categories || []);
      setItems(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Catálogo indisponível.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublic();
  }, [companyId, selectedCat, selectedMod]);

  const buildOrderWhatsapp = (itemName: string, price: number) => {
    if (!store?.whatsapp) return null;
    const digits = store.whatsapp.replace(/\D/g, '');
    if (!digits) return null;
    const phone = digits.startsWith('55') ? digits : `55${digits}`;
    const msg = `Olá! Vi no catálogo digital de ${store.nome} o item: ${itemName} (R$ ${price.toFixed(2)}). Gostaria de fazer um pedido.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="min-h-screen bg-[#070811] text-white">
      {/* Header */}
      <header className="border-b border-[#262042] bg-[#0A0714]">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#C4B5FD]">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white">
                {store?.titulo || 'Catálogo Digital'}
              </h1>
              <p className="text-xs text-[#AAA6B5]">
                {store?.nome || 'Vitrine Pública de Produtos Livres'}
              </p>
            </div>
          </div>

          {store?.whatsapp && (
            <a
              href={`https://wa.me/${store.whatsapp.replace(/\D/g, '').startsWith('55') ? store.whatsapp.replace(/\D/g, '') : `55${store.whatsapp.replace(/\D/g, '')}`}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-2 self-start sm:self-auto"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Atendimento WhatsApp</span>
            </a>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {error ? (
          <div className="p-8 rounded-2xl bg-[#121024] border border-rose-500/30 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-white">{error}</p>
          </div>
        ) : (
          <>
            {store?.avisoLegal && (
              <div className="p-3.5 rounded-2xl bg-[#121024] border border-emerald-500/30 flex items-start gap-2.5 text-xs text-[#AAA6B5]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{store.avisoLegal}</span>
              </div>
            )}

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#AAA6B5]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadPublic()}
                  placeholder="Buscar produto ou marca..."
                  className="w-full bg-[#121024] border border-[#262042] rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>
              <select
                value={selectedMod}
                onChange={(e) => setSelectedMod(e.target.value)}
                className="bg-[#121024] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="todos">Todos os Setores</option>
                <option value="adega">Bebidas Sem Álcool & Conveniência</option>
                <option value="tabacaria">Acessórios & Artigos Livres</option>
              </select>
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="bg-[#121024] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="todas">Todas Categorias</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[#AAA6B5]">Carregando catálogo...</div>
            ) : items.length === 0 ? (
              <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
                Nenhum produto disponível encontrado neste catálogo.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const waUrl = buildOrderWhatsapp(item.nome, Number(item.precoVenda));
                  return (
                    <div
                      key={item.id}
                      className="bg-[#121024] border border-[#262042] rounded-2xl p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase text-[#C4B5FD]">
                            {item.categoria}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              item.disponivel
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {item.disponivel ? 'Disponível' : 'Esgotado'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white">{item.nome}</h3>
                        {item.marca && <p className="text-xs text-[#716A86]">{item.marca}</p>}
                        {item.descricao && (
                          <p className="text-xs text-[#AAA6B5] line-clamp-2">{item.descricao}</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#262042] flex items-center justify-between">
                        <div>
                          <span className="text-base font-black text-emerald-400 tabular-nums">
                            R$ {Number(item.precoVenda).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-[#716A86] ml-1">/ {item.unidade}</span>
                        </div>
                        {waUrl && item.disponivel && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold"
                          >
                            Pedir
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
