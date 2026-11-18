import { ALL_COLUMNS, ColumnKey } from '../types/logistics';
import { IdBatch } from '../utils/idChunker';
import { Check, Copy, Download, FileSpreadsheet, Layers, Printer, Search, Sparkles } from 'lucide-react';

interface TableToolbarProps {
  visibleColumns: ColumnKey[];
  onToggleColumn: (col: ColumnKey) => void;
  routeOptions?: string[];
  selectedRoute?: string;
  onChangeRoute?: (route: string) => void;
  searchQuery?: string;
  onChangeSearch?: (q: string) => void;
  onExportCsv?: () => void;
  onExportExcel?: () => void;
  onPrintCurrentRoute?: () => void;
  onPrintAllRoutes?: () => void;
  printAllLabel?: string;
  disableRoutePrint?: boolean;
  hideFilters?: boolean;
  onOpenCopyModal?: (initialTab?: 'batches' | 'top7' | 'current') => void;
  activeRouteBatches?: IdBatch[];
  activeRouteTop7Count?: number;
  activeRouteTotalCount?: number;
  onCopyBatch?: (ids: string[], label: string) => void;
  onCopyTop7?: () => void;
  onCopyAllFiltered?: () => void;
  copiedBatchLabel?: string | null;
  onCopyTop7All?: () => void;
  copiedTop7All?: boolean;
}

export function TableToolbar({
  visibleColumns,
  onToggleColumn,
  routeOptions,
  selectedRoute,
  onChangeRoute,
  searchQuery,
  onChangeSearch,
  onExportCsv,
  onExportExcel,
  onPrintCurrentRoute,
  onPrintAllRoutes,
  printAllLabel = 'Imprimir todas as rotas',
  disableRoutePrint = false,
  hideFilters = false,
  onOpenCopyModal,
  activeRouteBatches,
  activeRouteTop7Count,
  activeRouteTotalCount,
  onCopyBatch,
  onCopyTop7,
  onCopyAllFiltered,
  copiedBatchLabel,
  onCopyTop7All,
  copiedTop7All = false,
}: TableToolbarProps) {
  const columnCheckboxes = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="text-xs font-medium text-slate-500">Colunas visíveis:</span>
      {ALL_COLUMNS.map((col) => {
        const checked = visibleColumns.includes(col.key);
        const isOnlyLeft = checked && visibleColumns.length === 1;
        return (
          <label
            key={col.key}
            className={`inline-flex items-center gap-1.5 text-xs select-none ${
              isOnlyLeft ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={isOnlyLeft}
              onChange={() => onToggleColumn(col.key)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <span>{col.label}</span>
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="no-print bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {!hideFilters && onChangeSearch !== undefined ? (
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <label htmlFor="table-search-input" className="sr-only">
                Buscar por ID ou descrição
              </label>
              <input
                id="table-search-input"
                type="search"
                value={searchQuery ?? ''}
                onChange={(e) => onChangeSearch(e.target.value)}
                placeholder="Filtrar por ID ou descrição..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
              />
            </div>

            {routeOptions && onChangeRoute && (
              <div className="flex items-center gap-2">
                <label htmlFor="route-filter-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">
                  Rota:
                </label>
                <select
                  id="route-filter-select"
                  value={selectedRoute ?? 'ALL'}
                  onChange={(e) => onChangeRoute(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                >
                  <option value="ALL">Todas as rotas ({routeOptions.length})</option>
                  {routeOptions.map((r) => (
                    <option key={r} value={r}>
                      {r.toLowerCase().startsWith('rota') ? r : `Rota ${r}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
          columnCheckboxes
        )}

        <div className="flex flex-wrap items-center gap-2">
          {onOpenCopyModal && (
            <button
              type="button"
              onClick={() => onOpenCopyModal('batches')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              title="Abrir painel com lotes de 5 em 5 e Top 7 por rota para copiar para o BigQuery"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copiar IDs</span>
            </button>
          )}
          {onCopyTop7All && (
            <button
              type="button"
              onClick={onCopyTop7All}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                copiedTop7All
                  ? 'bg-emerald-600 text-white border border-emerald-600'
                  : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50'
              }`}
              title="Copiar os primeiros 7 IDs de cada rota"
            >
              {copiedTop7All ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                  <span>Copiar Top 7 (Todas)</span>
                </>
              )}
            </button>
          )}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Exportar CSV</span>
            </button>
          )}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Exportar Excel</span>
            </button>
          )}
          {onPrintCurrentRoute && (
            <button
              type="button"
              onClick={onPrintCurrentRoute}
              disabled={disableRoutePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Imprimir rota atual</span>
            </button>
          )}
          {onPrintAllRoutes && (
            <button
              type="button"
              onClick={onPrintAllRoutes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{printAllLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick batch copying bar for the selected route */}
      {selectedRoute && selectedRoute !== 'ALL' && activeRouteBatches && activeRouteBatches.length > 0 && (
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5 mr-1">
            <Layers className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
            <span>Copiar IDs Rota {selectedRoute}:</span>
          </span>

          {activeRouteBatches.map((b) => (
            <button
              key={b.batchIndex}
              type="button"
              onClick={() => onCopyBatch?.(b.ids, b.label)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                copiedBatchLabel === b.label
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title={`Copiar ${b.count} IDs (${b.startIndex} a ${b.endIndex}) prontos para colar no BigQuery`}
            >
              {copiedBatchLabel === b.label ? (
                <>
                  <Check className="w-3 h-3 text-white" aria-hidden="true" />
                  <span>{b.label} Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  <span>{b.label}</span>
                </>
              )}
            </button>
          ))}

          {activeRouteTop7Count !== undefined && activeRouteTop7Count > 0 && onCopyTop7 && (
            <button
              type="button"
              onClick={onCopyTop7}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                copiedBatchLabel === 'top7'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
              title="Copiar os primeiros 7 IDs desta rota (ordenados por data)"
            >
              {copiedBatchLabel === 'top7' ? (
                <>
                  <Check className="w-3 h-3 text-white" aria-hidden="true" />
                  <span>Top 7 Copiado!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-indigo-600" aria-hidden="true" />
                  <span>Top 7 IDs ({activeRouteTop7Count})</span>
                </>
              )}
            </button>
          )}

          {onCopyAllFiltered && activeRouteTotalCount !== undefined && (
            <button
              type="button"
              onClick={onCopyAllFiltered}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                copiedBatchLabel === 'all-filtered'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title={`Copiar todos os ${activeRouteTotalCount} IDs da rota`}
            >
              <span>Todos ({activeRouteTotalCount})</span>
            </button>
          )}
        </div>
      )}

      {!hideFilters && onChangeSearch !== undefined && (
        <div className="pt-3 border-t border-slate-100">{columnCheckboxes}</div>
      )}
    </div>
  );
}
