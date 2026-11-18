import { ALL_COLUMNS, ColumnKey, ProcessedPackage } from '../types/logistics';
import { Edit3, RotateCcw } from 'lucide-react';

interface PackagesTableProps {
  packages: ProcessedPackage[];
  visibleColumns: ColumnKey[];
  emptyTitle?: string;
  emptyDescription?: string;
  allowInlineActions?: boolean;
  onQuickOverride?: (id: string, currentStatus: string) => void;
  onRemoveOverride?: (id: string) => void;
  selectedIds?: string[];
  onToggleSelectId?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
}

function getStatusTextClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'sorting') return 'text-emerald-700 font-semibold';
  if (s === 'pendente') return 'text-amber-700 font-semibold';
  if (s === 'problem_solving') return 'text-amber-700 font-semibold';
  if (s === 'returned' || s === 'destroyed' || s === 'cancelled') return 'text-rose-700 font-medium';
  return 'text-slate-700 font-medium';
}

export function PackagesTable({
  packages,
  visibleColumns,
  emptyTitle = 'Nenhum pacote encontrado',
  emptyDescription = 'Ajuste os filtros ou carregue os arquivos de entrada.',
  allowInlineActions = false,
  onQuickOverride,
  onRemoveOverride,
  selectedIds,
  onToggleSelectId,
  onToggleSelectAll,
}: PackagesTableProps) {
  const activeCols = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key));
  const isSelectable = Boolean(onToggleSelectId);
  const selectedSet = new Set(selectedIds ?? []);
  const tableIds = packages.map((p) => p.id);
  const allChecked =
    isSelectable && tableIds.length > 0 && tableIds.every((id) => selectedSet.has(id));

  if (packages.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center">
        <p className="text-sm font-semibold text-slate-900">{emptyTitle}</p>
        <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {isSelectable && (
                <th scope="col" className="no-print w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    aria-label="Selecionar todos os pacotes desta tabela"
                    onChange={() => onToggleSelectAll?.(tableIds)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                </th>
              )}
              {activeCols.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap ${
                    col.key === 'valor' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
              {allowInlineActions && (
                <th scope="col" className="no-print px-4 py-2.5 text-xs font-semibold text-slate-600 text-right whitespace-nowrap">
                  Ação
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {packages.map((pkg) => {
              const isRowSelected = selectedSet.has(pkg.id);
              return (
                <tr
                  key={pkg.id}
                  data-testid={`pkg-row-${pkg.id}`}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    isRowSelected
                      ? 'bg-indigo-50/60'
                      : pkg.isManualOverride
                      ? 'bg-indigo-50/35'
                      : ''
                  }`}
                >
                  {isSelectable && (
                    <td className="no-print px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        aria-label={`Selecionar pacote ${pkg.id}`}
                        onChange={() => onToggleSelectId?.(pkg.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                      />
                    </td>
                  )}
                {activeCols.map((col) => {
                  switch (col.key) {
                    case 'id':
                      return (
                        <td
                          key="id"
                          className="px-4 py-2.5 font-mono text-xs font-medium text-slate-900 tabular-nums whitespace-nowrap"
                        >
                          {pkg.id}
                        </td>
                      );
                    case 'rota':
                      return (
                        <td key="rota" className="px-4 py-2.5 text-xs font-medium text-slate-800 whitespace-nowrap">
                          {pkg.rota}
                        </td>
                      );
                    case 'data':
                      return (
                        <td
                          key="data"
                          className="px-4 py-2.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap"
                        >
                          {pkg.dataFormatada}
                        </td>
                      );
                    case 'descricao':
                      return (
                        <td key="descricao" className="px-4 py-2.5 text-xs text-slate-700 max-w-xs truncate" title={pkg.descricao ?? 'N/A'}>
                          {pkg.descricao ? (
                            <span>{pkg.descricao}</span>
                          ) : (
                            <span className="font-mono text-amber-700 font-medium">N/A</span>
                          )}
                        </td>
                      );
                    case 'valor':
                      return (
                        <td
                          key="valor"
                          className={`px-4 py-2.5 font-mono text-xs text-right tabular-nums whitespace-nowrap ${
                            pkg.valor === null ? 'text-amber-700 font-medium' : 'text-slate-900 font-medium'
                          }`}
                        >
                          {pkg.valorFormatado}
                        </td>
                      );
                    case 'status':
                      return (
                        <td key="status" className="px-4 py-2.5 text-xs whitespace-nowrap">
                          <span className={getStatusTextClass(pkg.statusFinal)}>{pkg.statusFinal}</span>
                          {pkg.isManualOverride && (
                            <span
                              className="ml-2 text-[11px] font-medium text-indigo-700"
                              title={`Alterado manualmente (arquivo original: ${pkg.statusArquivo})`}
                            >
                              · Manual (orig: {pkg.statusArquivo})
                            </span>
                          )}
                        </td>
                      );
                  }
                })}
                {allowInlineActions && (
                  <td className="no-print px-4 py-2.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      {onQuickOverride && (
                        <button
                          type="button"
                          onClick={() => onQuickOverride(pkg.id, pkg.statusFinal)}
                          aria-label={`Alterar status do pacote ${pkg.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                        >
                          <Edit3 className="w-3 h-3" aria-hidden="true" />
                          <span>Editar</span>
                        </button>
                      )}
                      {pkg.isManualOverride && onRemoveOverride && (
                        <button
                          type="button"
                          onClick={() => onRemoveOverride(pkg.id)}
                          aria-label={`Remover override manual de ${pkg.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" aria-hidden="true" />
                          <span>Desfazer</span>
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
