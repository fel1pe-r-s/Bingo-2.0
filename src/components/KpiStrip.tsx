import { ProcessingSummary } from '../types/logistics';
import { formatCurrencyBRL } from '../utils/normalizers';

interface KpiStripProps {
  summary: ProcessingSummary;
  filteredCount?: number;
  filteredValue?: number;
  hasActiveRouteOrSearchFilter?: boolean;
}

export function KpiStrip({
  summary,
  filteredCount,
  filteredValue,
  hasActiveRouteOrSearchFilter,
}: KpiStripProps) {
  const displayCount = hasActiveRouteOrSearchFilter && filteredCount !== undefined ? filteredCount : summary.totalSorting;
  const displayValue = hasActiveRouteOrSearchFilter && filteredValue !== undefined ? filteredValue : summary.totalValorSorting;

  const primaryLabel = summary.hasStatusFile ? 'Sorting' : 'Pendentes';

  return (
    <section
      aria-label="Indicadores operacionais"
      className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
    >
      <div className="px-5 py-4">
        <p className="text-xs font-medium text-slate-500">
          {hasActiveRouteOrSearchFilter ? `${primaryLabel} (Filtro Atual)` : `Pacotes (${primaryLabel})`}
        </p>
        <p
          data-testid="kpi-sorting-count"
          className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums"
        >
          {displayCount}
        </p>
        <p className="mt-1 text-xs text-slate-500 tabular-nums">
          {summary.totalFaltantesFiltrados} válidos na estação · {summary.totalOutrosStatus} outros status
        </p>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs font-medium text-slate-500">
          {hasActiveRouteOrSearchFilter ? 'Valor Total (Filtro Atual)' : `Valor Total (${primaryLabel})`}
        </p>
        <p
          data-testid="kpi-sorting-value"
          className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums"
        >
          {formatCurrencyBRL(displayValue)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {summary.hasStatusFile
            ? 'Soma dos itens com valor válido'
            : 'Arquivo status ausente · padrão pendente'}
        </p>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs font-medium text-slate-500">Rotas Ativas ({primaryLabel})</p>
        <p
          data-testid="kpi-routes-count"
          className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums"
        >
          {summary.totalRotasAtivas}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Ordenadas por data mais antiga
        </p>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs font-medium text-slate-500">Pacotes sem Detalhe (N/A)</p>
        <p
          data-testid="kpi-na-count"
          className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
            summary.totalNA > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {summary.totalNA}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {summary.totalNA > 0 ? 'Sem descrição ou valor válido' : 'Todos detalhados'}
        </p>
      </div>
    </section>
  );
}
