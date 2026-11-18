import { ProcessedPackage, RouteGroup } from '../types/logistics';

export interface IdBatch {
  batchIndex: number; // 1-based index (1, 2, 3...)
  label: string;      // e.g. "Lote 1 (1-5)"
  startIndex: number; // 1-based start
  endIndex: number;   // 1-based end
  count: number;
  ids: string[];
  idString: string;
}

export interface RouteBatchSummary {
  rota: string;
  totalPackages: number;
  batchesOf5: IdBatch[];
  top7: {
    count: number;
    ids: string[];
    idString: string;
  };
  allIds: {
    count: number;
    ids: string[];
    idString: string;
  };
}

/**
 * Splits an array into sub-arrays of fixed size.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0 || items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Builds structured 5-by-5 batches (or custom batchSize) for a list of packages.
 */
export function buildIdBatches(packages: ProcessedPackage[], batchSize = 5): IdBatch[] {
  if (!packages || packages.length === 0 || batchSize <= 0) return [];

  const batches: IdBatch[] = [];
  for (let i = 0; i < packages.length; i += batchSize) {
    const slice = packages.slice(i, i + batchSize);
    const ids = slice.map((p) => p.id);
    const batchIndex = Math.floor(i / batchSize) + 1;
    const startIndex = i + 1;
    const endIndex = i + slice.length;

    batches.push({
      batchIndex,
      label: `Lote ${batchIndex} (${startIndex}-${endIndex})`,
      startIndex,
      endIndex,
      count: ids.length,
      ids,
      idString: ids.join(','),
    });
  }
  return batches;
}

/**
 * Extracts the top N package IDs (e.g. top 7 by chronological inbound date) from packages.
 */
export function getTopNIds(packages: ProcessedPackage[], n = 7): {
  count: number;
  ids: string[];
  idString: string;
} {
  if (!packages || packages.length === 0 || n <= 0) {
    return { count: 0, ids: [], idString: '' };
  }
  const slice = packages.slice(0, n);
  const ids = slice.map((p) => p.id);
  return {
    count: ids.length,
    ids,
    idString: ids.join(','),
  };
}

/**
 * Summarizes batches of 5 and top 7 for a specific route group.
 */
export function summarizeRouteBatches(group: RouteGroup): RouteBatchSummary {
  const allIds = group.packages.map((p) => p.id);
  return {
    rota: group.rota,
    totalPackages: group.packages.length,
    batchesOf5: buildIdBatches(group.packages, 5),
    top7: getTopNIds(group.packages, 7),
    allIds: {
      count: allIds.length,
      ids: allIds,
      idString: allIds.join(','),
    },
  };
}

/**
 * Extracts Top 7 IDs across all route groups combined.
 */
export function getAllTopNIdsFromGroups(
  groups: RouteGroup[],
  n = 7
): {
  total: number;
  ids: string[];
  idString: string;
  perRoute: { rota: string; count: number; ids: string[]; idString: string }[];
} {
  const perRoute = groups.map((g) => {
    const top = getTopNIds(g.packages, n);
    return {
      rota: g.rota,
      count: top.count,
      ids: top.ids,
      idString: top.idString,
    };
  });

  const allTopIds = perRoute.flatMap((r) => r.ids);
  return {
    total: allTopIds.length,
    ids: allTopIds,
    idString: allTopIds.join(','),
    perRoute,
  };
}

/**
 * Copies plain text to clipboard with modern navigator API and textarea fallback.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continue to fallback
  }

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch {
    // Fallback failed
  }
  return false;
}
