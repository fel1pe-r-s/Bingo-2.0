import { useMemo, useState } from 'react';
import { Check, Copy, Layers, ListFilter, Sparkles, X } from 'lucide-react';
import { ProcessedPackage, RouteGroup } from '../types/logistics';
import {
  buildIdBatches,
  copyTextToClipboard,
  getAllTopNIdsFromGroups,
  getTopNIds,
  summarizeRouteBatches,
} from '../utils/idChunker';

interface CopyIdsModalProps {
  open: boolean;
  onClose: () => void;
  routeGroups: RouteGroup[];
  currentFilteredPackages: ProcessedPackage[];
  initialTab?: 'batches' | 'top7' | 'current';
  selectedRouteFilter?: string;
}

export function CopyIdsModal({
  open,
  onClose,
  routeGroups,
  currentFilteredPackages,
  initialTab = 'batches',
  selectedRouteFilter = 'ALL',
}: CopyIdsModalProps) {
  const [activeTab, setActiveTab] = useState<'batches' | 'top7' | 'current'>(initialTab);
  const [quoteSql, setQuoteSql] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [targetRoute, setTargetRoute] = useState<string>(selectedRouteFilter);

  const routeSummaries = useMemo(() => {
    return routeGroups.map((g) => summarizeRouteBatches(g));
  }, [routeGroups]);

  const allTop7Summary = useMemo(() => {
    return getAllTopNIdsFromGroups(routeGroups, 7);
  }, [routeGroups]);

  const currentIds = useMemo(() => {
    return currentFilteredPackages.map((p) => p.id);
  }, [currentFilteredPackages]);

  if (!open) return null;

  const formatText = (ids: string[]) => {
    if (quoteSql) {
      return ids.map((id) => `'${id}'`).join(',');
    }
    return ids.join(',');
  };

  const handleCopy = async (key: string, ids: string[]) => {
    const text = formatText(ids);
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const visibleSummaries =
    targetRoute === 'ALL'
      ? routeSummaries
      : routeSummaries.filter((s) => s.rota === targetRoute);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-ids-modal-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
          <div>
            <h2 id="copy-ids-modal-title" className="font-display text-base font-bold text-slate-900">
              Copiar IDs para BigQuery / Sorting
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Copie listas de IDs em lotes de 5 em 5 ou os Top 7 por rota prontos para colar no filtro{' '}
              <code className="font-mono text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded">IN (...)</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Navigation and SQL toggle */}
        <div className="px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('batches')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'batches'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>De 5 em 5 por Rota</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('top7')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'top7'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Top 7 por Rota</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'current'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Visualização Atual ({currentIds.length})</span>
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={quoteSql}
              onChange={(e) => setQuoteSql(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <span>Adicionar aspas simples (<code className="font-mono text-[11px]">'ID'</code>)</span>
          </label>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'batches' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900">
                <span>
                  Cada rota é dividida em <strong>lotes de 5 pacotes</strong> ordenados pela data de inbound mais antiga.
                </span>
                <div className="flex items-center gap-2">
                  <label htmlFor="modal-filter-route" className="font-semibold text-slate-700 whitespace-nowrap">
                    Filtrar rota:
                  </label>
                  <select
                    id="modal-filter-route"
                    value={targetRoute}
                    onChange={(e) => setTargetRoute(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="ALL">Todas as rotas ({routeSummaries.length})</option>
                    {routeSummaries.map((s) => (
                      <option key={s.rota} value={s.rota}>
                        Rota {s.rota} ({s.totalPackages} pacotes)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {visibleSummaries.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">Nenhuma rota com pacotes elegíveis.</div>
              ) : (
                <div className="space-y-4">
                  {visibleSummaries.map((s) => (
                    <div
                      key={s.rota}
                      className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-baseline gap-2">
                          <h3 className="font-display text-sm font-bold text-slate-900">Rota {s.rota}</h3>
                          <span className="text-xs text-slate-500">
                            {s.totalPackages} pacotes · {s.batchesOf5.length} lote(s) de 5
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(`all-${s.rota}`, s.allIds.ids)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                        >
                          {copiedKey === `all-${s.rota}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                              <span className="text-emerald-700">Todos Copiados!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Copiar Todos da Rota ({s.totalPackages})</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {s.batchesOf5.map((b) => {
                          const key = `batch-${s.rota}-${b.batchIndex}`;
                          const isCopied = copiedKey === key;
                          return (
                            <div
                              key={key}
                              className="border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-3 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800">{b.label}</p>
                                <p className="text-[11px] font-mono text-slate-500 truncate" title={b.idString}>
                                  {b.ids.slice(0, 3).join(', ')}
                                  {b.ids.length > 3 ? `, +${b.ids.length - 3}` : ''}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(key, b.ids)}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                                  isCopied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Copiar 5 IDs</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'top7' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/70 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-950">
                <span>
                  Exibindo os <strong>primeiros 7 pacotes de cada rota</strong> ordenados pela data de inbound mais antiga.
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('all-top7', allTop7Summary.ids)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md shadow-sm transition-colors whitespace-nowrap ${
                    copiedKey === 'all-top7'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  {copiedKey === 'all-top7' ? (
                    <>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Todos Copiados ({allTop7Summary.total} IDs)!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Copiar Top 7 de Todas as Rotas ({allTop7Summary.total} IDs)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allTop7Summary.perRoute.map((r) => {
                  const key = `top7-${r.rota}`;
                  const isCopied = copiedKey === key;
                  return (
                    <div
                      key={key}
                      className="border border-slate-200 rounded-lg p-3.5 bg-white shadow-sm space-y-2 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <h4 className="font-display text-sm font-bold text-slate-900">Rota {r.rota}</h4>
                          <span className="text-xs text-slate-500 font-mono">{r.count} pacote(s)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(key, r.ids)}
                          className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded transition-colors ${
                            isCopied
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Copiar {r.count} IDs</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] font-mono text-slate-600 break-all bg-slate-50 p-2 rounded border border-slate-100 max-h-20 overflow-y-auto">
                        {r.idString}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'current' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Pacotes Filtrados Atualmente na Tela
                    </h3>
                    <p className="text-xs text-slate-500">
                      Total de <strong>{currentIds.length}</strong> pacotes na listagem ativa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('current-all', currentIds)}
                    disabled={currentIds.length === 0}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md shadow-sm transition-colors ${
                      copiedKey === 'current-all'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                    }`}
                  >
                    {copiedKey === 'current-all' ? (
                      <>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>IDs Copiados!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copiar Todos os {currentIds.length} IDs</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="current-ids-textarea" className="text-xs font-semibold text-slate-700">
                    String pronta para o BigQuery:
                  </label>
                  <textarea
                    id="current-ids-textarea"
                    readOnly
                    rows={6}
                    value={formatText(currentIds)}
                    className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none select-all"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
