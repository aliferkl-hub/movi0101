import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../../lib/api';
import { CommercialImportBatch } from '../../../types';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';

interface ImportCenterViewProps {
  modulo: 'adega' | 'tabacaria';
}

const PRODUCT_FIELDS = [
  { key: 'nome', label: 'Nome do Produto *' },
  { key: 'sku', label: 'SKU / Código Interno' },
  { key: 'codigoBarras', label: 'Código de Barras (EAN)' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'marca', label: 'Marca' },
  { key: 'precoCusto', label: 'Preço de Custo' },
  { key: 'precoVenda', label: 'Preço de Venda' },
  { key: 'estoqueAtual', label: 'Estoque Atual' },
  { key: 'estoqueMinimo', label: 'Estoque Mínimo' },
  { key: 'estoqueMaximo', label: 'Estoque Máximo' },
  { key: 'unidade', label: 'Unidade (un, lata...)' },
  { key: 'classificacaoLegal', label: 'Classificação Legal (+18)' },
];

const SUPPLIER_FIELDS = [
  { key: 'razaoSocial', label: 'Razão Social *' },
  { key: 'nomeFantasia', label: 'Nome Fantasia' },
  { key: 'cnpjCpf', label: 'CNPJ / CPF' },
  { key: 'contatoNome', label: 'Nome do Contato' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'segmento', label: 'Segmento' },
];

export const ImportCenterView: React.FC<ImportCenterViewProps> = ({ modulo }) => {
  const [tipoAlvo, setTipoAlvo] = useState<'produtos' | 'fornecedores'>('produtos');
  const [targetModulo, setTargetModulo] = useState<'adega' | 'tabacaria'>(modulo);
  const [modoEspelho, setModoEspelho] = useState(true);

  const [parsedFile, setParsedFile] = useState<{
    fileName: string;
    formato: 'csv' | 'xlsx';
    headers: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [batches, setBatches] = useState<CommercialImportBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lastBatch, setLastBatch] = useState<CommercialImportBatch | null>(null);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.getCommerceImportHistory();
      setBatches(res.batches || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar histórico de importações.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleRows =
      tipoAlvo === 'produtos'
        ? [
            {
              nome: targetModulo === 'adega' ? 'Água Mineral Sem Gás 500ml' : 'Seda Slim King Size',
              sku: targetModulo === 'adega' ? 'AGUA-500-EX' : 'SEDA-KS-EX',
              codigoBarras: '7890000001001',
              categoria: targetModulo === 'adega' ? 'Água Mineral' : 'Sedas & Folhas',
              marca: 'Exemplo',
              precoCusto: '1.20',
              precoVenda: '4.00',
              estoqueAtual: '48',
              estoqueMinimo: '12',
              estoqueMaximo: '100',
              unidade: 'un',
              classificacaoLegal: 'sem_restricao',
            },
          ]
        : [
            {
              razaoSocial: 'Distribuidora Modelo LTDA',
              nomeFantasia: 'DistModelo',
              cnpjCpf: '12.345.678/0001-90',
              contatoNome: 'Carlos Silva',
              telefone: '(11) 98888-7777',
              email: 'compras@distmodelo.com.br',
              segmento: targetModulo,
            },
          ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, `modelo_${tipoAlvo}_movilog.${format}`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLastBatch(null);

    const isCsv = file.name.toLowerCase().endsWith('.csv');
    try {
      setParsing(true);
      if (isCsv) {
        const text = await file.text();
        const res = await api.parseCommerceImport({
          fileName: file.name,
          csvText: text,
          tipoAlvo,
        });
        setParsedFile({
          fileName: file.name,
          formato: res.formato,
          headers: res.headers,
          rows: res.rows,
        });
        setMapping(res.suggestedMapping || {});
      } else {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Falha ao ler arquivo XLSX.'));
          reader.readAsDataURL(file);
        });
        const res = await api.parseCommerceImport({
          fileName: file.name,
          contentBase64: base64,
          tipoAlvo,
        });
        setParsedFile({
          fileName: file.name,
          formato: res.formato,
          headers: res.headers,
          rows: res.rows,
        });
        setMapping(res.suggestedMapping || {});
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar arquivo CSV/XLSX.');
      setParsedFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleCellEdit = (rowIndex: number, header: string, val: string) => {
    if (!parsedFile) return;
    setParsedFile((prev) => {
      if (!prev) return null;
      const updated = prev.rows.map((r, idx) => (idx === rowIndex ? { ...r, [header]: val } : r));
      return { ...prev, rows: updated };
    });
  };

  const handleCommit = async () => {
    if (!parsedFile) return;
    try {
      setCommitting(true);
      setErrorMsg(null);
      const res = await api.commitCommerceImport({
        fileName: parsedFile.fileName,
        formato: parsedFile.formato,
        tipoAlvo,
        modulo: targetModulo,
        modoEspelho,
        mapeamentoColunas: mapping,
        rows: parsedFile.rows,
      });
      setSuccessMsg(res.message);
      setLastBatch(res.batch);
      setParsedFile(null);
      loadHistory();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao gravar registros importados.');
    } finally {
      setCommitting(false);
    }
  };

  const targetFields = tipoAlvo === 'produtos' ? PRODUCT_FIELDS : SUPPLIER_FIELDS;

  return (
    <div className="space-y-6">
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#8B5CF6]" />
            Central de Importação Real (CSV & Excel XLSX)
          </h2>
          <p className="text-xs text-[#AAA6B5]">
            Leia planilhas do sistema antigo, mapeie colunas, corrija linhas antes de confirmar e evite duplicidades por SKU, EAN ou CNPJ.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleDownloadTemplate('xlsx')}
            className="px-3 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Baixar Modelo XLSX</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownloadTemplate('csv')}
            className="px-3 py-2 bg-[#1A1633] hover:bg-[#262042] border border-[#2E2854] text-xs font-semibold text-white rounded-xl flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Baixar Modelo CSV</span>
          </button>
        </div>
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

      {/* Upload Config */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Tipo de Dados</label>
            <select
              value={tipoAlvo}
              onChange={(e) => {
                setTipoAlvo(e.target.value as any);
                setParsedFile(null);
              }}
              className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="produtos">Produtos & Estoque</option>
              <option value="fornecedores">Fornecedores</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#AAA6B5] mb-1 block">Módulo Destino</label>
            <select
              value={targetModulo}
              onChange={(e) => setTargetModulo(e.target.value as any)}
              className="w-full bg-[#0A0714] border border-[#262042] rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="adega">Adega & Bebidas</option>
              <option value="tabacaria">Tabacaria & Headshop</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex items-end">
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer p-2.5 rounded-xl bg-[#0A0714] border border-[#262042] w-full">
              <input
                type="checkbox"
                checked={modoEspelho}
                onChange={(e) => setModoEspelho(e.target.checked)}
                className="w-4 h-4 rounded text-[#8B5CF6]"
              />
              <span>Etiquetar como Importado no Modo Espelho (Piloto 7 dias)</span>
            </label>
          </div>
        </div>

        <label className="border-2 border-dashed border-[#262042] hover:border-[#8B5CF6] rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-[#0A0714]/60 transition">
          <Upload className="w-7 h-7 text-[#8B5CF6]" />
          <span className="text-xs font-bold text-white">
            {parsing ? 'Lendo planilha...' : 'Selecionar arquivo .CSV ou .XLSX do computador'}
          </span>
          <span className="text-[11px] text-[#716A86]">
            O processamento valida cabeçalhos e permite revisão completa antes de gravar no banco
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Column Mapping + Editable Preview */}
      {parsedFile && (
        <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">
                Pré-visualização & Mapeamento: {parsedFile.fileName}
              </h3>
              <p className="text-[11px] text-[#AAA6B5]">
                {parsedFile.rows.length} linha(s) lida(s) • Ajuste o mapeamento ou edite células diretamente na tabela abaixo.
              </p>
            </div>
            <button
              onClick={handleCommit}
              disabled={committing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
            >
              {committing ? 'Importando...' : `Confirmar Importação (${parsedFile.rows.length} linhas)`}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 bg-[#0A0714] p-4 rounded-xl border border-[#262042]">
            {targetFields.map((tf) => (
              <div key={tf.key}>
                <label className="text-[10px] font-semibold text-[#AAA6B5] block mb-1">
                  {tf.label}
                </label>
                <select
                  value={mapping[tf.key] || ''}
                  onChange={(e) => setMapping({ ...mapping, [tf.key]: e.target.value })}
                  className="w-full bg-[#121024] border border-[#262042] rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="">-- Não mapear --</option>
                  {parsedFile.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto border border-[#262042] rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#0A0714]">
                <tr className="border-b border-[#262042] text-[10px] uppercase text-[#AAA6B5]">
                  <th className="py-2 px-3">#</th>
                  {parsedFile.headers.map((h) => (
                    <th key={h} className="py-2 px-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262042]/50">
                {parsedFile.rows.slice(0, 50).map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td className="py-1.5 px-3 text-[#716A86] tabular-nums">{rIdx + 2}</td>
                    {parsedFile.headers.map((h) => (
                      <td key={h} className="py-1 px-2">
                        <input
                          type="text"
                          value={row[h] ?? ''}
                          onChange={(e) => handleCellEdit(rIdx, h, e.target.value)}
                          className="w-full min-w-[100px] bg-[#0A0714] border border-[#262042] rounded px-2 py-1 text-xs text-white"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Last Batch Errors Detail if any */}
      {lastBatch && lastBatch.errosDetalhes.length > 0 && (
        <div className="bg-[#121024] border border-amber-500/40 rounded-2xl p-4 space-y-2 text-xs">
          <div className="font-bold text-amber-300">
            Linhas com aviso no lote {lastBatch.arquivoNome}:
          </div>
          {lastBatch.errosDetalhes.map((er, i) => (
            <div key={i} className="text-[#AAA6B5]">
              • Linha {er.linha}: {er.erro}
            </div>
          ))}
        </div>
      )}

      {/* History */}
      <div className="bg-[#121024] border border-[#262042] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Histórico de Lotes Importados</h3>
        {loadingHistory ? (
          <div className="text-xs text-[#AAA6B5] py-4">Carregando histórico...</div>
        ) : batches.length === 0 ? (
          <div className="text-xs text-[#AAA6B5] py-4">Nenhuma importação realizada ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#262042] text-[10px] uppercase text-[#AAA6B5]">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 px-3">Arquivo</th>
                  <th className="py-2 px-3">Tipo / Modo</th>
                  <th className="py-2 px-3 text-right">Importados</th>
                  <th className="py-2 px-3 text-right">Duplicados Ignor.</th>
                  <th className="py-2 pl-3 text-right">Erros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262042]/50">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-3 text-[#AAA6B5]">
                      {new Date(b.criadoEm).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 px-3 font-semibold text-white">{b.arquivoNome}</td>
                    <td className="py-2 px-3 text-[#C4B5FD]">
                      {b.tipoAlvo} • {b.modoEspelho ? 'Espelho 7d' : 'Migrado'}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-400 tabular-nums">
                      {b.importadosQtd}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-300 tabular-nums">
                      {b.ignoradosDuplicadosQtd}
                    </td>
                    <td className="py-2 pl-3 text-right text-rose-400 tabular-nums">{b.errosQtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
