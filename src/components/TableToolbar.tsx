import { ALL_COLUMNS, ColumnKey } from '../types/logistics';
import { Download, FileSpreadsheet, Printer, Search } from 'lucide-react';

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
                      {r}
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

      {!hideFilters && onChangeSearch !== undefined && (
        <div className="pt-3 border-t border-slate-100">{columnCheckboxes}</div>
      )}
    </div>
  );
}
