import { useMemo, useState } from 'react';
import { ColumnKey, ProcessedPackage } from '../types/logistics';
import { PackagesTable } from './PackagesTable';
import { TableToolbar } from './TableToolbar';

interface OtherStatusViewProps {
  packages: ProcessedPackage[];
  visibleColumns: ColumnKey[];
  onToggleColumn: (col: ColumnKey) => void;
  onQuickOverride: (id: string, currentStatus: string) => void;
  onRemoveOverride: (id: string) => void;
  onMoveToSorting: (id: string) => void;
}

export function OtherStatusView({
  packages,
  visibleColumns,
  onToggleColumn,
  onQuickOverride,
  onRemoveOverride,
  onMoveToSorting,
}: OtherStatusViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const distinctStatuses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of packages) {
      counts.set(p.statusFinal, (counts.get(p.statusFinal) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [packages]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return packages.filter((p) => {
      if (statusFilter !== 'ALL' && p.statusFinal !== statusFilter) return false;
      if (q) {
        const matchId = p.id.toLowerCase().includes(q);
        const matchDesc = (p.descricao ?? '').toLowerCase().includes(q);
        const matchRota = p.rota.toLowerCase().includes(q);
        if (!matchId && !matchDesc && !matchRota) return false;
      }
      return true;
    });
  }, [packages, statusFilter, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">
            Pacotes com Outros Status (Fora de Sorting)
          </h2>
          <p className="text-xs text-slate-500">
            Pacotes filtrados de faltantes cujo status final difere da fila principal (ex: problem_solving, on_route, delivered, returned).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos ({packages.length})
          </button>
          {distinctStatuses.map(([status, count]) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {status} ({count})
            </button>
          ))}
        </div>
      </div>

      <TableToolbar
        visibleColumns={visibleColumns}
        onToggleColumn={onToggleColumn}
        searchQuery={searchQuery}
        onChangeSearch={setSearchQuery}
      />

      {filtered.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Deseja retornar algum pacote para <strong className="text-slate-900">sorting</strong>? Clique em &ldquo;Editar&rdquo; na linha ou use o override rápido abaixo:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {filtered.slice(0, 5).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onMoveToSorting(p.id)}
                className="px-2 py-1 font-mono text-[11px] font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100"
              >
                Mover {p.id} → sorting
              </button>
            ))}
          </div>
        </div>
      )}

      <PackagesTable
        packages={filtered}
        visibleColumns={visibleColumns}
        emptyTitle="Nenhum pacote em outros status"
        emptyDescription="Todos os pacotes filtrados estão na visualização principal ou não há dados carregados."
        allowInlineActions
        onQuickOverride={onQuickOverride}
        onRemoveOverride={onRemoveOverride}
      />
    </div>
  );
}
