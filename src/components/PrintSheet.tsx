import { ALL_COLUMNS, ColumnKey, PrintMode, RouteGroup } from '../types/logistics';
import { formatCurrencyBRL } from '../utils/normalizers';

interface PrintSheetProps {
  printMode: PrintMode;
  generatedAt: string;
  visibleColumns: ColumnKey[];
  currentRouteGroup: RouteGroup | null;
  allRouteGroups: RouteGroup[];
  resumoGroups: RouteGroup[];
}

export function PrintSheet({
  printMode,
  generatedAt,
  visibleColumns,
  currentRouteGroup,
  allRouteGroups,
  resumoGroups,
}: PrintSheetProps) {
  if (printMode === 'none') return null;

  const activeCols = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  let pages: RouteGroup[] = [];
  let modeSubtitle = '';

  if (printMode === 'current-route' && currentRouteGroup) {
    pages = [currentRouteGroup];
    modeSubtitle = 'Relatório Completo da Rota';
  } else if (printMode === 'all-routes-principal') {
    pages = allRouteGroups;
    modeSubtitle = 'Relatório Completo por Rota';
  } else if (printMode === 'all-routes-resumo') {
    pages = resumoGroups;
    modeSubtitle = 'Resumo Operacional · Primeiros 7 Pacotes por Rota';
  }

  return (
    <div id="print-sheet-root" className="hidden print-only text-slate-900 bg-white">
      {pages.map((group) => {
        const subtotal = group.packages.reduce((acc, p) => acc + (p.valor ?? 0), 0);
        return (
          <section key={group.rota} className="print-page-break py-2">
            <header className="border-b-2 border-slate-900 pb-3 mb-4 flex items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  SortFlow · {modeSubtitle}
                </p>
                <h1 className="font-display text-2xl font-bold text-slate-900 mt-0.5">
                  Rota {group.rota}
                </h1>
              </div>
              <div className="text-right text-xs text-slate-700 tabular-nums space-y-0.5">
                <p>
                  Gerado em: <span className="font-mono font-semibold">{generatedAt}</span>
                </p>
                <p>
                  Pacotes impressos:{' '}
                  <span className="font-mono font-semibold">{group.packages.length}</span>
                  {printMode === 'all-routes-resumo' && group.totalPackages > group.packages.length
                    ? ` (de ${group.totalPackages} na rota)`
                    : ''}{' '}
                  · Total: <span className="font-mono font-semibold">{formatCurrencyBRL(subtotal)}</span>
                </p>
              </div>
            </header>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-400 bg-slate-100">
                  {activeCols.map((col) => (
                    <th
                      key={col.key}
                      className={`py-2 px-2.5 font-bold text-slate-900 ${
                        col.key === 'valor' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {group.packages.map((pkg) => (
                  <tr key={pkg.id} className="print-avoid-break">
                    {activeCols.map((col) => {
                      switch (col.key) {
                        case 'id':
                          return (
                            <td key="id" className="py-1.5 px-2.5 font-mono font-medium whitespace-nowrap">
                              {pkg.id}
                            </td>
                          );
                        case 'rota':
                          return (
                            <td key="rota" className="py-1.5 px-2.5 whitespace-nowrap">
                              {pkg.rota}
                            </td>
                          );
                        case 'data':
                          return (
                            <td key="data" className="py-1.5 px-2.5 font-mono whitespace-nowrap">
                              {pkg.dataFormatada}
                            </td>
                          );
                        case 'descricao':
                          return (
                            <td key="descricao" className="py-1.5 px-2.5">
                              {pkg.descricao ?? 'N/A'}
                            </td>
                          );
                        case 'valor':
                          return (
                            <td key="valor" className="py-1.5 px-2.5 font-mono text-right whitespace-nowrap">
                              {pkg.valorFormatado}
                            </td>
                          );
                        case 'status':
                          return (
                            <td key="status" className="py-1.5 px-2.5 whitespace-nowrap">
                              {pkg.statusFinal}
                              {pkg.isManualOverride ? ' (Manual)' : ''}
                            </td>
                          );
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
