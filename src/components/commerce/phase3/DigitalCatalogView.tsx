import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  QrCode,
  Save,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';

export const DigitalCatalogView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState('');
  const [catalogoAtivo, setCatalogoAtivo] = useState(false);
  const [catalogoTitulo, setCatalogoTitulo] = useState('');
  const [whatsappPedidos, setWhatsappPedidos] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getCommerceCatalogPreview();
      setCompanyId(res.companyId);
      setCatalogoAtivo(res.catalogoPublicoAtivo);
      setCatalogoTitulo(res.catalogoTitulo || '');
      setWhatsappPedidos(res.whatsappPedidos || '');
      setItems(res.items || []);
      setBlockedCount(res.blockedRestrictedCount || 0);

      const url = `${window.location.origin}${res.publicPath}`;
      const qrRes = await api.getQRCode(url);
      setQrDataUrl(qrRes.dataUrl);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar configurações do catálogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const publicUrl = companyId ? `${window.location.origin}/catalogo/${companyId}` : '';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      await api.updateCommercePilot({
        catalogoPublicoAtivo: catalogoAtivo,
        catalogoTitulo,
        whatsappPedidos,
      });
      setSuccessMsg('Configurações do catálogo digital atualizadas.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar catálogo.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-[#8B5CF6]" />
            Catálogo Digital & QR Code de Vitrine
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Vitrine pública para itens sem restrição legal (água, refrigerantes, acessórios headshop, gelo, snacks).
          </p>
        </div>

        {publicUrl && (
          <a
            href={`/catalogo/${companyId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Abrir Vitrine Pública</span>
          </a>
        )}
      </div>

      {/* Mandatory Legal Compliance Banner */}
      <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-emerald-300">
            Filtro Legal Ativo — Bloqueio Automático de Itens +18
          </div>
          <p className="text-[#AAA6B5]">
            Por conformidade legal, apenas produtos classificados como <strong className="text-white">sem_restricao</strong> (idade mínima 0) aparecem no catálogo público.{' '}
            <strong className="text-amber-300">{blockedCount} item(ns) com restrição (+18 álcool/tabaco)</strong> estão ocultos da vitrine pública automaticamente.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
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

      {loading ? (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-12 text-center text-xs text-[#AAA6B5]">
          Carregando catálogo digital...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Config Form */}
          <form
            onSubmit={handleSave}
            className="lg:col-span-2 bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-white">Configuração da Vitrine</h3>
            <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer p-3 rounded-xl bg-[#0A0714] border border-[#262042]">
              <input
                type="checkbox"
                checked={catalogoAtivo}
                onChange={(e) => setCatalogoAtivo(e.target.checked)}
                className="w-4 h-4 rounded text-[#8B5CF6]"
              />
              <span>Ativar acesso público ao catálogo via link e QR Code</span>
            </label>

            <div>
              <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                Título Exibido na Vitrine
              </label>
              <input
                type="text"
                value={catalogoTitulo}
                onChange={(e) => setCatalogoTitulo(e.target.value)}
                className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">
                WhatsApp para Pedidos (com DDD)
              </label>
              <input
                type="text"
                value={whatsappPedidos}
                onChange={(e) => setWhatsappPedidos(e.target.value)}
                placeholder="Ex: 5511999999999"
                className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Link Público</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="flex-1 bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-[#C4B5FD] font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3.5 py-2 bg-[#1A1633] hover:bg-[#262042] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Vitrine'}</span>
            </button>
          </form>

          {/* QR Code Card */}
          <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#8B5CF6]" />
              <span>QR Code do Balcão / Embalagem</span>
            </div>
            {qrDataUrl ? (
              <div className="bg-white p-3 rounded-2xl">
                <img src={qrDataUrl} alt="QR Code Catálogo Público" className="w-44 h-44" />
              </div>
            ) : (
              <div className="w-44 h-44 rounded-2xl bg-[#0A0714] border border-[#262042] flex items-center justify-center text-xs text-[#716A86]">
                Gerando QR...
              </div>
            )}
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`catalogo-qr-${companyId}.png`}
                className="text-xs font-semibold text-[#C4B5FD] hover:text-white underline"
              >
                Baixar Imagem PNG
              </a>
            )}
          </div>
        </div>
      )}

      {/* Preview Table */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">
          Pré-visualização dos Itens Públicos ({items.length})
        </h3>
        {items.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#0A0714] border border-[#262042] text-center text-xs text-[#AAA6B5]">
            Nenhum item classificado como "sem_restricao" está ativo no catálogo no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((it) => (
              <div key={it.id} className="p-3.5 rounded-xl bg-[#0A0714] border border-[#262042] space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-white text-xs">{it.nome}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      it.disponivel ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {it.disponivel ? 'Disponível' : 'Indisponível'}
                  </span>
                </div>
                <div className="text-[11px] text-[#716A86]">
                  {it.categoria} • {it.modulo}
                </div>
                <div className="text-sm font-black text-emerald-400 tabular-nums">
                  R$ {Number(it.precoVenda).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
