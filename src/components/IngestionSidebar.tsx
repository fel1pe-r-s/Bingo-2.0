import { useState, ChangeEvent, FormEvent } from 'react';
import {
  FileParseStats,
  ManualOverrideMap,
  ProcessingSummary,
} from '../types/logistics';
import { formatCurrencyBRL } from '../utils/normalizers';
import {
  Check,
  Copy,
  Database,
  FileUp,
  HelpCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';

export type FileSlotKey = 'faltantes' | 'detalhesValor' | 'status' | 'detalhesNA';

interface IngestionSidebarProps {
  fileStats: Record<FileSlotKey, FileParseStats>;
  summary: ProcessingSummary;
  onUploadFile: (slot: FileSlotKey, file: File) => void;
  onClearFile: (slot: FileSlotKey) => void;
  onReprocess: () => void;
  onLoadDemo: () => void;
  onResetAll: () => void;
  onOpenGuide: () => void;
  statusIdList: string[];
  statusIdString: string;
  naIdList: string[];
  naIdString: string;
  manualOverrides: ManualOverrideMap;
  knownIds: string[];
  manualIdInput: string;
  onChangeManualIdInput: (val: string) => void;
  manualStatusInput: string;
  onChangeManualStatusInput: (val: string) => void;
  onSaveManualOverride: (id: string, status: string) => void;
  onRemoveManualOverride: (id: string) => void;
  onClearAllOverrides: () => void;
  selectedIds?: string[];
  activeBatchLabel?: string | null;
  idSectionPulseKey?: number;
  isRefreshing?: boolean;
}

const FILE_SLOTS: {
  key: FileSlotKey;
  label: string;
  hint: string;
  accept: string;
  requiredNote: string;
}[] = [
  {
    key: 'faltantes',
    label: '1. faltantes.csv',
    hint: 'ID, Rota, Data Inbound, Localização',
    accept: '.csv,.json,.txt',
    requiredNote: 'Obrigatório para filtrar',
  },
  {
    key: 'detalhesValor',
    label: '2. Detalhes_valor',
    hint: 'JSON ou CSV (Descrição e Valor)',
    accept: '.json,.csv,.txt',
    requiredNote: 'Opcional',
  },
  {
    key: 'status',
    label: '3. status',
    hint: 'JSON ou CSV (STATUS_SHP / SUB_STATUS)',
    accept: '.json,.csv,.txt',
    requiredNote: 'Opcional',
  },
  {
    key: 'detalhesNA',
    label: '4. detalhes_dos_NA',
    hint: 'JSON ou CSV complementar para N/A',
    accept: '.json,.csv,.txt',
    requiredNote: 'Opcional',
  },
];

const COMMON_STATUSES = [
  'sorting',
  'pendente',
  'problem_solving',
  'delivered',
  'on_route',
  'in_cart',
  'returned',
  'destroyed',
];

export function IngestionSidebar({
  fileStats,
  summary,
  onUploadFile,
  onClearFile,
  onReprocess,
  onLoadDemo,
  onResetAll,
  onOpenGuide,
  statusIdList,
  statusIdString,
  naIdList,
  naIdString,
  manualOverrides,
  knownIds,
  manualIdInput,
  onChangeManualIdInput,
  manualStatusInput,
  onChangeManualStatusInput,
  onSaveManualOverride,
  onRemoveManualOverride,
  onClearAllOverrides,
  selectedIds = [],
  activeBatchLabel = null,
  idSectionPulseKey = 0,
  isRefreshing = false,
}: IngestionSidebarProps) {
  const [copiedKey, setCopiedKey] = useState<'status' | 'na' | 'selected' | null>(null);
  const [quoteSqlStrings, setQuoteSqlStrings] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const handleFileChange = (slot: FileSlotKey) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(slot, file);
    }
    e.target.value = '';
  };

  const formatForCopy = (ids: string[], rawCommaSeparated: string) => {
    if (!quoteSqlStrings) return rawCommaSeparated;
    return ids.map((id) => `'${id}'`).join(',');
  };

  const handleCopy = async (kind: 'status' | 'na' | 'selected', text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(kind);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedKey(kind);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const handleOverrideSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanId = manualIdInput.trim();
    const cleanStatus = manualStatusInput.trim();
    if (!cleanId) {
      setOverrideError('Informe o ID ou cole uma lista de IDs para aplicar o status manual.');
      return;
    }
    if (!cleanStatus) {
      setOverrideError('Informe o novo status do pacote.');
      return;
    }
    setOverrideError(null);
    onSaveManualOverride(cleanId, cleanStatus);
  };

  const overrideEntries = Object.entries(manualOverrides);

  return (
    <aside
      aria-label="Controles de arquivos, status manual e listas BigQuery"
      className="no-print w-full xl:w-[360px] shrink-0 space-y-5"
    >
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-slate-900">
            Arquivos de Entrada (Offline)
          </h2>
          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Como usar</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {FILE_SLOTS.map((slot) => {
            const stat = fileStats[slot.key];
            return (
              <div
                key={slot.key}
                className={`py-2.5 first:pt-0 last:pb-0 transition-colors ${
                  stat.error ? 'bg-rose-50/50 rounded px-2 my-1' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{slot.label}</p>
                    <p className="text-[11px] text-slate-500">
                      {slot.hint} · {slot.requiredNote}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <label
                      htmlFor={`file-input-${slot.key}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded cursor-pointer hover:bg-slate-50"
                    >
                      <FileUp className="w-3 h-3" aria-hidden="true" />
                      <span>{stat.loaded ? 'Trocar' : 'Enviar'}</span>
                    </label>
                    <input
                      id={`file-input-${slot.key}`}
                      type="file"
                      accept={slot.accept}
                      aria-label={`Enviar ${slot.label}`}
                      onChange={handleFileChange(slot.key)}
                      className="sr-only"
                    />
                    {stat.loaded && (
                      <button
                        type="button"
                        onClick={() => onClearFile(slot.key)}
                        aria-label={`Remover arquivo ${slot.label}`}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {stat.error && (
                  <p role="alert" className="mt-1.5 text-xs text-rose-700 font-medium">
                    {stat.error}
                  </p>
                )}

                {stat.loaded && !stat.error && (
                  <p className="mt-1 font-mono text-[11px] text-slate-600 tabular-nums truncate">
                    {stat.fileName} · {stat.totalRows} lidos
                    {slot.key === 'faltantes' ? ` · ${stat.validRows} na estação` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReprocess}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isRefreshing ? 'Atualizando...' : 'Processar / Atualizar'}</span>
            </button>
            <button
              type="button"
              onClick={onResetAll}
              title="Limpar todos os arquivos carregados"
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              Limpar
            </button>
          </div>
          <button
            type="button"
            onClick={onLoadDemo}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200/70"
          >
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Carregar Dados de Exemplo</span>
          </button>
        </div>

        {summary.totalFaltantesBruto > 0 && (
          <div
            key={`summary-${idSectionPulseKey}-${summary.totalSorting}-${summary.totalOutrosStatus}`}
            className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1 tabular-nums rounded animate-sortflow-flash"
          >
            <div className="flex justify-between">
              <span>Faltantes (Na estação + Inbound):</span>
              <span className="font-mono font-semibold text-slate-900">
                {summary.totalFaltantesFiltrados} / {summary.totalFaltantesBruto}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{summary.hasStatusFile ? 'Restaram em sorting:' : 'Exibidos (pendente):'}</span>
              <span className="font-mono font-semibold text-emerald-700">
                {summary.totalSorting} ({formatCurrencyBRL(summary.totalValorSorting)})
              </span>
            </div>
            <div className="flex justify-between">
              <span>Outros status separados:</span>
              <span className="font-mono font-semibold text-slate-800">
                {summary.totalOutrosStatus}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-slate-900">
            Listas de IDs para BigQuery
          </h2>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={quoteSqlStrings}
              onChange={(e) => setQuoteSqlStrings(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <span>Aspas &apos;ID&apos;</span>
          </label>
        </div>

        <div
          key={`selected-ids-${idSectionPulseKey}`}
          data-testid="sidebar-selected-ids-box"
          className={`space-y-1.5 rounded-md p-2.5 border transition-colors ${
            selectedIds.length > 0
              ? 'border-indigo-200 bg-indigo-50/40 animate-sortflow-flash'
              : 'border-slate-200/80 bg-slate-50/60'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="bq-selected-ids" className="text-xs font-semibold text-indigo-950 truncate">
              Lote / Selecionados ({selectedIds.length})
              {activeBatchLabel ? ` · ${activeBatchLabel}` : ''}
            </label>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => handleCopy('selected', formatForCopy(selectedIds, selectedIds.join(',')))}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-white border border-indigo-200 rounded hover:bg-indigo-100 disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
            >
              {copiedKey === 'selected' ? (
                <>
                  <Check className="w-3 h-3" aria-hidden="true" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" aria-hidden="true" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <textarea
            id="bq-selected-ids"
            readOnly
            rows={2}
            value={
              selectedIds.length > 0
                ? formatForCopy(selectedIds, selectedIds.join(','))
                : 'Clique em um lote ou marque checkboxes para atualizar os IDs selecionados aqui.'
            }
            className="w-full px-2.5 py-1.5 font-mono text-[11px] bg-white border border-slate-200 rounded text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="bq-status-ids" className="text-xs font-semibold text-slate-700">
              1. IDs para Status ({statusIdList.length})
            </label>
            <button
              type="button"
              disabled={statusIdList.length === 0}
              onClick={() => handleCopy('status', formatForCopy(statusIdList, statusIdString))}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {copiedKey === 'status' ? (
                <>
                  <Check className="w-3 h-3" aria-hidden="true" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" aria-hidden="true" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <textarea
            id="bq-status-ids"
            readOnly
            rows={2}
            value={
              statusIdList.length > 0
                ? formatForCopy(statusIdList, statusIdString)
                : 'Carregue faltantes.csv para gerar os IDs filtrados.'
            }
            className="w-full px-2.5 py-2 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="bq-na-ids" className="text-xs font-semibold text-slate-700">
              2. IDs que estão N/A ({naIdList.length})
            </label>
            {naIdList.length > 0 && (
              <button
                type="button"
                onClick={() => handleCopy('na', formatForCopy(naIdList, naIdString))}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 rounded hover:bg-amber-100"
              >
                {copiedKey === 'na' ? (
                  <>
                    <Check className="w-3 h-3" aria-hidden="true" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" aria-hidden="true" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            )}
          </div>
          {naIdList.length === 0 ? (
            <p
              data-testid="na-empty-message"
              className="px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded"
            >
              Nenhum pacote N/A
            </p>
          ) : (
            <textarea
              id="bq-na-ids"
              readOnly
              rows={2}
              value={formatForCopy(naIdList, naIdString)}
              className="w-full px-2.5 py-2 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          )}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-slate-900">
            Status Manual (Override)
          </h2>
          {overrideEntries.length > 0 && (
            <button
              type="button"
              onClick={onClearAllOverrides}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-700"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Limpar todos ({overrideEntries.length})</span>
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-500">
          O status manual sempre vence o status do arquivo. Aceita 1 ID ou vários IDs colados separados por vírgula.
        </p>

        <form onSubmit={handleOverrideSubmit} className="space-y-2.5">
          <div>
            <label htmlFor="manual-override-id" className="block text-xs font-medium text-slate-700 mb-1">
              ID(s) do pacote
            </label>
            <input
              id="manual-override-id"
              list="known-package-ids"
              type="text"
              value={manualIdInput}
              onChange={(e) => onChangeManualIdInput(e.target.value)}
              placeholder="Ex: 4401928301 ou 4401928301,4401928302"
              className="w-full px-3 py-1.5 font-mono text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
            />
            <datalist id="known-package-ids">
              {knownIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="manual-override-status" className="block text-xs font-medium text-slate-700 mb-1">
              Novo status
            </label>
            <div className="flex gap-2">
              <input
                id="manual-override-status"
                list="common-status-options"
                type="text"
                value={manualStatusInput}
                onChange={(e) => onChangeManualStatusInput(e.target.value)}
                placeholder="Ex: sorting, delivered..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
              />
              <datalist id="common-status-options">
                {COMMON_STATUSES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                Salvar
              </button>
            </div>
          </div>

          {overrideError && (
            <p role="alert" className="text-xs text-rose-700 font-medium">
              {overrideError}
            </p>
          )}
        </form>

        {overrideEntries.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5 max-h-40 overflow-y-auto">
            <p className="text-[11px] font-medium text-slate-500">
              Alterações ativas nesta sessão:
            </p>
            {overrideEntries.map(([id, entry]) => (
              <div
                key={id}
                className="flex items-center justify-between gap-2 text-xs py-1 px-2 bg-slate-50 rounded border border-slate-200/70"
              >
                <div className="min-w-0 truncate">
                  <span className="font-mono font-medium text-slate-900">{id}</span>
                  <span className="mx-1.5 text-slate-400">→</span>
                  <span className="font-semibold text-indigo-700">{entry.status}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveManualOverride(id)}
                  aria-label={`Remover status manual de ${id}`}
                  className="text-slate-400 hover:text-rose-600 p-0.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
