import { ColumnKey, RouteGroup } from '../types/logistics';
import { formatCurrencyBRL } from '../utils/normalizers';
import { PackagesTable } from './PackagesTable';
import { TableToolbar } from './TableToolbar';
import { Printer } from 'lucide-react';

interface RoutesViewProps {
  routeGroups: RouteGroup[];
  selectedRouteName: string | null;
  onSelectRoute: (rota: string) => void;
  visibleColumns: ColumnKey[];
  onToggleColumn: (col: ColumnKey) => void;
  onPrintCurrentRoute: (rota: string) => void;
  onPrintAllRoutes: () => void;
  onQuickOverride: (id: string, currentStatus: string) => void;
  onRemoveOverride: (id: string) => void;
}

export function RoutesView({
  routeGroups,
  selectedRouteName,
  onSelectRoute,
  visibleColumns,
  onToggleColumn,
  onPrintCurrentRoute,
  onPrintAllRoutes,
  onQuickOverride,
  onRemoveOverride,
}: RoutesViewProps) {
  const activeGroup =
    routeGroups.find((g) => g.rota === selectedRouteName) ?? routeGroups[0] ?? null;

  return (
    <div className="space-y-4">
      <TableToolbar
        visibleColumns={visibleColumns}
        onToggleColumn={onToggleColumn}
        onPrintAllRoutes={routeGroups.length > 0 ? onPrintAllRoutes : undefined}
        printAllLabel="Imprimir todas as rotas (páginas separadas)"
        hideFilters
      />

      {routeGroups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">Nenhuma rota encontrada</p>
          <p className="mt-1 text-xs text-slate-500">
            Carregue os arquivos de entrada para listar as rotas disponíveis.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
          <div
            aria-label="Lista de rotas"
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-display text-xs font-bold text-slate-700">
                Rotas Encontradas ({routeGroups.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
              {routeGroups.map((group) => {
                const isSelected = activeGroup?.rota === group.rota;
                return (
                  <button
                    key={group.rota}
                    type="button"
                    onClick={() => onSelectRoute(group.rota)}
                    aria-pressed={isSelected}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/80 text-indigo-900'
                        : 'bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{group.rota}</p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {formatCurrencyBRL(group.totalValue)}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                        isSelected ? 'text-indigo-700' : 'text-slate-600'
                      }`}
                    >
                      {group.totalPackages} pct
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeGroup && (
            <div className="space-y-3 min-w-0">
              <div className="bg-white border border-slate-200 rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Rota {activeGroup.rota} (Completa)
                  </h3>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {activeGroup.totalPackages} pacotes · Valor total:{' '}
                    <span className="font-mono font-semibold text-slate-800">
                      {formatCurrencyBRL(activeGroup.totalValue)}
                    </span>
                    {activeGroup.naCount > 0 ? ` · ${activeGroup.naCount} N/A` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onPrintCurrentRoute(activeGroup.rota)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Imprimir esta rota</span>
                </button>
              </div>

              <PackagesTable
                packages={activeGroup.packages}
                visibleColumns={visibleColumns}
                allowInlineActions
                onQuickOverride={onQuickOverride}
                onRemoveOverride={onRemoveOverride}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
