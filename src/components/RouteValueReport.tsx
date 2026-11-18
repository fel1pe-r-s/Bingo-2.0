import { useState } from 'react';
import { ProcessingSummary, RouteGroup } from '../types/logistics';
import { formatCurrencyBRL } from '../utils/normalizers';
import { copyTextToClipboard } from '../utils/idChunker';
import {
  buildRouteReportText,
  formatRouteLabel,
  formatSingleRouteReportLine,
} from '../utils/routeReport';
import { BarChart3, Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';

interface RouteValueReportProps {
  routeGroups: RouteGroup[];
  summary: ProcessingSummary;
  selectedRouteFilter?: string;
  onSelectRoute?: (rota: string) => void;
  onCopiedReport?: (message: string) => void;
}

export function RouteValueReport({
  routeGroups,
  summary,
  selectedRouteFilter = 'ALL',
  onSelectRoute,
  onCopiedReport,
}: RouteValueReportProps) {
  const [expanded, setExpanded] = useState(true);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);

  if (summary.totalSorting === 0 && routeGroups.length === 0) {
    return null;
  }

  const totalPkgLabel = summary.totalSorting === 1 ? 'pacote' : 'pacotes';

  const handleCopyAll = async () => {
    const text = buildRouteReportText(routeGroups, summary);
    await copyTextToClipboard(text);
    setCopiedTarget('__ALL__');
    window.setTimeout(() => setCopiedTarget((prev) => (prev === '__ALL__' ? null : prev)), 1600);
    onCopiedReport?.(
      `Relatório de valores copiado: Total Geral ${formatCurrencyBRL(summary.totalValorSorting)} (${summary.totalSorting} ${totalPkgLabel}) em ${routeGroups.length} ${routeGroups.length === 1 ? 'rota' : 'rotas'}.`
    );
  };

  const handleCopySingleRoute = async (group: RouteGroup) => {
    const text = formatSingleRouteReportLine(group);
    await copyTextToClipboard(text);
    setCopiedTarget(group.rota);
    window.setTimeout(
      () => setCopiedTarget((prev) => (prev === group.rota ? null : prev)),
      1600
    );
    onCopiedReport?.(`Valor copiado: ${text}`);
  };

  return (
    <section
      aria-label="Relatório de valores por ilha ou rota"
      data-testid="route-value-report"
      className="no-print bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <BarChart3 className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
            <h2 className="font-display text-xs font-bold text-slate-900 whitespace-nowrap">
              Relatório de Valor por Ilha / Rota
            </h2>
          </div>
          <span
            data-testid="route-report-general-total"
            className="text-xs font-mono font-semibold text-slate-800 bg-white border border-slate-200 rounded px-2 py-0.5 tabular-nums whitespace-nowrap"
          >
            Total Geral: {summary.totalSorting} {totalPkgLabel} ·{' '}
            {formatCurrencyBRL(summary.totalValorSorting)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="copy-route-report-btn"
            onClick={handleCopyAll}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
              copiedTarget === '__ALL__'
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {copiedTarget === '__ALL__' ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copiar relatório</span>
              </>
            )}
          </button>

          {routeGroups.length > 0 && (
            <button
              type="button"
              data-testid="toggle-route-report-btn"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap"
            >
              <span>
                {expanded ? 'Recolher' : `Ver rotas (${routeGroups.length})`}
              </span>
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>

      {expanded && routeGroups.length > 0 && (
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[205px] overflow-y-auto bg-white">
          {routeGroups.map((group) => {
            const label = formatRouteLabel(group.rota);
            const isSelected = selectedRouteFilter === group.rota;
            const isCopied = copiedTarget === group.rota;

            return (
              <div
                key={group.rota}
                data-testid={`route-report-card-${group.rota}`}
                className={`rounded-md border px-2.5 py-2 flex items-start justify-between gap-2 transition-colors ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-50/50'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                }`}
              >
                {onSelectRoute ? (
                  <button
                    type="button"
                    onClick={() => onSelectRoute(isSelected ? 'ALL' : group.rota)}
                    title={
                      isSelected
                        ? `Limpar filtro da ${label}`
                        : `Filtrar tabela pela ${label}`
                    }
                    className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                  >
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {label}
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-indigo-700 tabular-nums truncate">
                      Total {formatCurrencyBRL(group.totalValue)}
                    </p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {group.totalPackages}{' '}
                      {group.totalPackages === 1 ? 'pacote' : 'pacotes'}
                    </p>
                  </button>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {label}
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-indigo-700 tabular-nums truncate">
                      Total {formatCurrencyBRL(group.totalValue)}
                    </p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {group.totalPackages}{' '}
                      {group.totalPackages === 1 ? 'pacote' : 'pacotes'}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  data-testid={`copy-route-value-${group.rota}`}
                  onClick={() => handleCopySingleRoute(group)}
                  aria-label={`Copiar valor da ${label}`}
                  title={`Copiar: ${formatSingleRouteReportLine(group)}`}
                  className={`p-1 rounded border shrink-0 transition-colors ${
                    isCopied
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-700 hover:border-indigo-300'
                  }`}
                >
                  {isCopied ? (
                    <Check className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3 h-3" aria-hidden="true" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
