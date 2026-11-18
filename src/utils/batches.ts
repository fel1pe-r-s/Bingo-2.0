import { ProcessedPackage } from '../types/logistics';
import { normalizeId } from './normalizers';

export interface IdBatch {
  key: string;
  rota: string;
  batchIndex: number;
  totalBatchesInRoute: number;
  startPos: number;
  endPos: number;
  ids: string[];
  formatted: string;
}

/**
 * Groups packages by route (preserving existing package order) and splits each route into
 * fixed-size batches (e.g. 5-by-5 on Principal or 7-by-route on Resumo).
 */
export function buildRouteIdBatches(
  packages: ProcessedPackage[],
  batchSize: number,
  quoteStrings = false
): IdBatch[] {
  const safeSize = Math.max(1, Math.floor(batchSize));
  const byRoute = new Map<string, string[]>();

  for (const pkg of packages) {
    const routeKey = pkg.rotaGrupo || pkg.rota;
    let list = byRoute.get(routeKey);
    if (!list) {
      list = [];
      byRoute.set(routeKey, list);
    }
    list.push(pkg.id);
  }

  const routeOrder = Array.from(byRoute.keys()).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );

  const batches: IdBatch[] = [];

  for (const rota of routeOrder) {
    const ids = byRoute.get(rota)!;
    const totalBatchesInRoute = Math.ceil(ids.length / safeSize);

    for (let i = 0; i < totalBatchesInRoute; i++) {
      const startIdx = i * safeSize;
      const chunk = ids.slice(startIdx, startIdx + safeSize);
      const formatted = formatIdsForClipboard(chunk, quoteStrings);

      batches.push({
        key: `${rota}::${i + 1}`,
        rota,
        batchIndex: i + 1,
        totalBatchesInRoute,
        startPos: startIdx + 1,
        endPos: startIdx + chunk.length,
        ids: chunk,
        formatted,
      });
    }
  }

  return batches;
}

export function formatIdsForClipboard(ids: string[], quoteStrings = false): string {
  if (!quoteStrings) return ids.join(',');
  return ids.map((id) => `'${id}'`).join(',');
}

/**
 * Parses one or multiple IDs pasted from comma-, semicolon-, space-, or newline-separated text.
 */
export function parseBatchIdsInput(rawInput: string): string[] {
  if (!rawInput || !rawInput.trim()) return [];
  const tokens = rawInput.split(/[\s,;]+/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const token of tokens) {
    const clean = normalizeId(token);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }

  return result;
}
