import { ColumnKey, RouteGroup } from '../types/logistics';
import { formatCurrencyBRL } from '../utils/normalizers';
import { PackagesTable } from './PackagesTable';
import { TableToolbar } from './TableToolbar';

interface ResumoViewProps {
  resumoGroups: RouteGroup[];
  visibleColumns: ColumnKey[];
  onToggleColumn: (col: ColumnKey) => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onPrintAllResumo: () => void;
  onQuickOverride: (id: string, currentStatus: string) => void;
  onRemoveOverride: (id: string) => void;
}

export function ResumoView({
  resumoGroups,
  visibleColumns,
  onToggleColumn,
  onExportCsv,
  onExportExcel,
  onPrintAllResumo,
  onQuickOverride,
  onRemoveOverride,
}: ResumoViewProps) {
  return (
    <div className="space-y-4">
      <TableToolbar
        visibleColumns={visibleColumns}
        onToggleColumn={onToggleColumn}
        onExportCsv={onExportCsv}
        onExportExcel={onExportExcel}
        onPrintAllRoutes={onPrintAllResumo}
        printAllLabel="Imprimir todas as rotas (Top 7/página)"
        hideFilters
      />

      {resumoGroups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">Nenhuma rota com pacotes elegíveis</p>
          <p className="mt-1 text-xs text-slate-500">
            Carregue os arquivos ou ajuste os overrides manuais para visualizar o resumo por rota.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {resumoGroups.map((group) => (
            <section
              key={group.rota}
              data-testid={`resumo-group-${group.rota}`}
              className="space-y-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                <div className="flex items-baseline gap-2.5">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Rota {group.rota}
                  </h3>
                  <span className="text-xs text-slate-500 tabular-nums">
                    Exibindo {group.packages.length} de {group.totalPackages} pacotes
                  </span>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                  Subtotal (Top 7): {formatCurrencyBRL(group.totalValue)}
                </span>
              </div>

              <PackagesTable
                packages={group.packages}
                visibleColumns={visibleColumns}
                allowInlineActions
                onQuickOverride={onQuickOverride}
                onRemoveOverride={onRemoveOverride}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
