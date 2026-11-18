import { useEffect, useMemo, useRef, useState } from 'react';
import { ProcessedPackage } from '../types/logistics';
import { buildRouteIdBatches, formatIdsForClipboard, IdBatch } from '../utils/batches';
import { Check, ChevronLeft, ChevronRight, Copy, Layers } from 'lucide-react';

interface BatchIdCopierProps {
  packages: ProcessedPackage[];
  defaultBatchSize: 5 | 7;
  title: string;
  selectedRouteFilter?: string;
  copiedBatchKeys: string[];
  activeBatchSessionKey?: string | null;
  onCopyBatch: (batchKey: string, label: string, ids: string[], formattedText: string) => void;
}

export function BatchIdCopier({
  packages,
  defaultBatchSize,
  title,
  selectedRouteFilter = 'ALL',
  copiedBatchKeys,
  activeBatchSessionKey,
  onCopyBatch,
}: BatchIdCopierProps) {
  const [batchSize, setBatchSize] = useState<number>(defaultBatchSize);
  const [quoteSqlStrings, setQuoteSqlStrings] = useState(false);
  const [localRoute, setLocalRoute] = useState<string>('');
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number>(1);
  const [justCopiedKey, setJustCopiedKey] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const batches = useMemo(
    () => buildRouteIdBatches(packages, batchSize, quoteSqlStrings),
    [packages, batchSize, quoteSqlStrings]
  );

  const routesInfo = useMemo(() => {
    const map = new Map<string, IdBatch[]>();
    for (const b of batches) {
      const list = map.get(b.rota);
      if (list) list.push(b);
      else map.set(b.rota, [b]);
    }
    return Array.from(map.entries()).map(([rota, routeBatches]) => ({
      rota,
      batches: routeBatches,
      packageCount: routeBatches.reduce((sum, b) => sum + b.ids.length, 0),
    }));
  }, [batches]);

  const activeRoute = useMemo(() => {
    if (
      selectedRouteFilter !== 'ALL' &&
      routesInfo.some((r) => r.rota === selectedRouteFilter)
    ) {
      return selectedRouteFilter;
    }
    if (localRoute && routesInfo.some((r) => r.rota === localRoute)) {
      return localRoute;
    }
    return routesInfo[0]?.rota ?? '';
  }, [selectedRouteFilter, localRoute, routesInfo]);

  const activeRouteBatches = useMemo(() => {
    return routesInfo.find((r) => r.rota === activeRoute)?.batches ?? [];
  }, [routesInfo, activeRoute]);

  useEffect(() => {
    if (activeRouteBatches.length === 0) return;
    if (!activeRouteBatches.some((b) => b.batchIndex === selectedBatchIndex)) {
      setSelectedBatchIndex(activeRouteBatches[0].batchIndex);
    }
  }, [activeRouteBatches, selectedBatchIndex]);

  const currentBatch = useMemo(
    () =>
      activeRouteBatches.find((b) => b.batchIndex === selectedBatchIndex) ??
      activeRouteBatches[0] ??
      null,
    [activeRouteBatches, selectedBatchIndex]
  );

  const allIds = useMemo(() => packages.map((p) => p.id), [packages]);

  const triggerCopyBatch = (batch: IdBatch) => {
    const sessionKey = `${batch.key}::${batch.ids.join(',')}`;
    setSelectedBatchIndex(batch.batchIndex);
    setJustCopiedKey(batch.key);
    setTimeout(() => setJustCopiedKey(null), 1600);
    const label = `Rota ${batch.rota} · Lote ${batch.batchIndex} (${batch.startPos}–${batch.endPos})`;
    onCopyBatch(sessionKey, label, batch.ids, batch.formatted);
  };

  const handleCopyAll = () => {
    if (allIds.length === 0) return;
    const text = formatIdsForClipboard(allIds, quoteSqlStrings);
    setJustCopiedKey('__ALL__');
    setTimeout(() => setJustCopiedKey(null), 1600);
    onCopyBatch('__ALL__', `Todos os ${allIds.length} IDs filtrados`, allIds, text);
  };

  const handleJumpToBatch = (batchIdx: number) => {
    setSelectedBatchIndex(batchIdx);
    const btn = stripRef.current?.querySelector<HTMLButtonElement>(
      `[data-batch-idx="${batchIdx}"]`
    );
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const scrollStrip = (direction: 'left' | 'right') => {
    if (!stripRef.current) return;
    const delta = direction === 'left' ? -260 : 260;
    stripRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (packages.length === 0) return null;

  return (
    <section
      aria-label={title}
      className="no-print bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Compact header */}
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Layers className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
            <h3 className="font-display text-xs font-bold text-slate-900 whitespace-nowrap">
              {title}
            </h3>
          </div>

          <div className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5 text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => setBatchSize(5)}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                batchSize === 5 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              5 em 5
            </button>
            <button
              type="button"
              onClick={() => setBatchSize(7)}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                batchSize === 7 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 em 7
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <label htmlFor="batch-route-select" className="text-[11px] font-medium text-slate-500">
              Rota:
            </label>
            <select
              id="batch-route-select"
              value={activeRoute}
              onChange={(e) => {
                setLocalRoute(e.target.value);
                setSelectedBatchIndex(1);
              }}
              className="max-w-[175px] px-2 py-1 text-xs font-medium bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {routesInfo.map((r) => (
                <option key={r.rota} value={r.rota}>
                  {r.rota.toLowerCase().startsWith('rota') ? r.rota : `Rota ${r.rota}`} ({r.packageCount} · {r.batches.length}l)
                </option>
              ))}
            </select>
          </div>

          {activeRouteBatches.length > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <label htmlFor="batch-jump-select" className="text-[11px] font-medium text-slate-500">
                Lote:
              </label>
              <select
                id="batch-jump-select"
                value={currentBatch?.batchIndex ?? 1}
                onChange={(e) => handleJumpToBatch(Number(e.target.value))}
                className="max-w-[135px] px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {activeRouteBatches.map((b) => {
                  const sessionKey = `${b.key}::${b.ids.join(',')}`;
                  const done = copiedBatchKeys.includes(sessionKey);
                  return (
                    <option key={b.key} value={b.batchIndex}>
                      {done ? '✓ ' : ''}Lote {b.batchIndex} ({b.startPos}–{b.endPos})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={quoteSqlStrings}
              onChange={(e) => setQuoteSqlStrings(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <span>Aspas &apos;ID&apos;</span>
          </label>

          {currentBatch && (
            <button
              type="button"
              onClick={() => triggerCopyBatch(currentBatch)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                justCopiedKey === currentBatch.key
                  ? 'bg-emerald-600 text-white'
                  : 'text-white bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {justCopiedKey === currentBatch.key ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    Copiar Lote {currentBatch.batchIndex} ({currentBatch.ids.length})
                  </span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyAll}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap ${
              justCopiedKey === '__ALL__'
                ? 'bg-emerald-600 text-white'
                : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
            }`}
          >
            {justCopiedKey === '__ALL__' ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copiado ({allIds.length})</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copiar todos ({allIds.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Single-line horizontal strip — never wraps vertically or hides the table */}
      <div className="px-3 py-2 flex items-center gap-1.5 bg-white">
        {activeRouteBatches.length > 4 && (
          <button
            type="button"
            onClick={() => scrollStrip('left')}
            aria-label="Rolar lotes para a esquerda"
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        <div
          ref={stripRef}
          className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5"
        >
          {activeRouteBatches.map((batch) => {
            const sessionKey = `${batch.key}::${batch.ids.join(',')}`;
            const isJustCopied = justCopiedKey === batch.key;
            const isActiveSelected = activeBatchSessionKey === sessionKey;
            const wasCopiedInSession = copiedBatchKeys.includes(sessionKey);

            return (
              <button
                key={batch.key}
                type="button"
                data-batch-idx={batch.batchIndex}
                data-testid={`batch-copy-${batch.rota}-${batch.batchIndex}`}
                onClick={() => triggerCopyBatch(batch)}
                title={`Copiar e selecionar ${batch.ids.length} IDs na tabela: ${batch.formatted}`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  isJustCopied
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isActiveSelected
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-400 font-semibold'
                    : wasCopiedInSession
                    ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200/70'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60'
                }`}
              >
                {isJustCopied || wasCopiedInSession ? (
                  <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
                ) : (
                  <Copy className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                )}
                <span>
                  Lote {batch.batchIndex} ({batch.startPos}–{batch.endPos})
                </span>
              </button>
            );
          })}
        </div>

        {activeRouteBatches.length > 4 && (
          <button
            type="button"
            onClick={() => scrollStrip('right')}
            aria-label="Rolar lotes para a direita"
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 shrink-0"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
