import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ColumnKey, RouteGroup } from '../types/logistics';
import { formatCurrencyBRL } from '../utils/normalizers';
import { copyTextToClipboard, getTopNIds } from '../utils/idChunker';
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
  onCopyTop7All?: () => void;
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
  onCopyTop7All,
}: ResumoViewProps) {
  const [copiedRouteKey, setCopiedRouteKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyRouteTop7 = async (group: RouteGroup) => {
    const top7 = getTopNIds(group.packages, 7);
    await copyTextToClipboard(top7.idString);
    setCopiedRouteKey(group.rota);
    setTimeout(() => setCopiedRouteKey(null), 2000);
  };

  const handleCopyTop7All = async () => {
    if (onCopyTop7All) {
      onCopyTop7All();
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

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
        onCopyTop7All={resumoGroups.length > 0 ? handleCopyTop7All : undefined}
        copiedTop7All={copiedAll}
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
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                    Subtotal (Top 7): {formatCurrencyBRL(group.totalValue)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyRouteTop7(group)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      copiedRouteKey === group.rota
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    {copiedRouteKey === group.rota ? (
                      <>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copiar {Math.min(group.packages.length, 7)} IDs</span>
                      </>
                    )}
                  </button>
                </div>
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
