import { useMemo, useState } from 'react';
import { ColumnKey, RouteGroup } from '../types/logistics';
import { formatCurrencyBRL } from '../utils/normalizers';
import { formatIdsForClipboard } from '../utils/batches';
import { BatchIdCopier } from './BatchIdCopier';
import { PackagesTable } from './PackagesTable';
import { TableToolbar } from './TableToolbar';
import { Check, Copy } from 'lucide-react';

interface ResumoViewProps {
  resumoGroups: RouteGroup[];
  visibleColumns: ColumnKey[];
  onToggleColumn: (col: ColumnKey) => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onPrintAllResumo: () => void;
  onQuickOverride: (id: string, currentStatus: string) => void;
  onRemoveOverride: (id: string) => void;
  copiedBatchKeys: string[];
  activeBatchSessionKey?: string | null;
  onCopyBatch: (batchKey: string, label: string, ids: string[], formattedText: string) => void;
  selectedIds: string[];
  onToggleSelectId: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
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
  copiedBatchKeys,
  activeBatchSessionKey,
  onCopyBatch,
  selectedIds,
  onToggleSelectId,
  onToggleSelectAll,
}: ResumoViewProps) {
  const [justCopiedRoute, setJustCopiedRoute] = useState<string | null>(null);

  const flatResumoPackages = useMemo(
    () => resumoGroups.flatMap((g) => g.packages),
    [resumoGroups]
  );

  const handleCopyRouteTop7 = (group: RouteGroup) => {
    const ids = group.packages.map((p) => p.id);
    if (ids.length === 0) return;
    const text = formatIdsForClipboard(ids, false);
    const batchKey = `resumo::${group.rota}::${ids.join(',')}`;
    setJustCopiedRoute(group.rota);
    setTimeout(() => setJustCopiedRoute(null), 1600);
    onCopyBatch(batchKey, `Resumo · Rota ${group.rota} (${ids.length} IDs)`, ids, text);
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
      />

      <BatchIdCopier
        packages={flatResumoPackages}
        defaultBatchSize={7}
        title="Lotes do Resumo (7 por rota)"
        copiedBatchKeys={copiedBatchKeys}
        activeBatchSessionKey={activeBatchSessionKey}
        onCopyBatch={onCopyBatch}
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
          {resumoGroups.map((group) => {
            const remaining = Math.max(0, group.totalPackages - group.packages.length);
            const routeKey = `resumo::${group.rota}::${group.packages.map((p) => p.id).join(',')}`;
            const wasCopied = copiedBatchKeys.includes(routeKey);
            const isJustCopied = justCopiedRoute === group.rota;

            return (
              <section
                key={group.rota}
                data-testid={`resumo-group-${group.rota}`}
                className="space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Rota {group.rota}
                    </h3>
                    <span className="text-xs text-slate-500 tabular-nums">
                      Exibindo {group.packages.length} de {group.totalPackages} pacotes
                      {remaining > 0 ? ` · ${remaining} aguardando próxima leva` : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                      Subtotal (Top 7): {formatCurrencyBRL(group.totalValue)}
                    </span>
                    <button
                      type="button"
                      data-testid={`resumo-copy-route-${group.rota}`}
                      onClick={() => handleCopyRouteTop7(group)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
                        isJustCopied
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : wasCopied
                          ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200/70'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      {isJustCopied || wasCopied ? (
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {isJustCopied
                          ? `Copiado (${group.packages.length})`
                          : `Copiar ${group.packages.length} IDs`}
                      </span>
                    </button>
                  </div>
                </div>

                <PackagesTable
                  packages={group.packages}
                  visibleColumns={visibleColumns}
                  allowInlineActions
                  onQuickOverride={onQuickOverride}
                  onRemoveOverride={onRemoveOverride}
                  selectedIds={selectedIds}
                  onToggleSelectId={onToggleSelectId}
                  onToggleSelectAll={onToggleSelectAll}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
