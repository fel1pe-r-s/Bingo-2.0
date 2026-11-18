import {
  ManualOverrideMap,
  ProcessedPackage,
  ProcessingResult,
  RawDetalheRecord,
  RawFaltanteRecord,
  RawStatusRecord,
  RouteGroup,
} from '../types/logistics';
import {
  extractRouteGroup,
  formatCurrencyBRL,
  normalizeId,
  resolveFinalStatus,
} from './normalizers';

export interface ProcessInput {
  faltantes: RawFaltanteRecord[];
  faltantesTotalBruto?: number;
  detalhesValor: RawDetalheRecord[];
  statusRecords: RawStatusRecord[];
  hasStatusFile?: boolean;
  detalhesNA: RawDetalheRecord[];
  manualOverrides: ManualOverrideMap;
}

function buildDetailMap(records: RawDetalheRecord[]): Map<string, RawDetalheRecord> {
  const map = new Map<string, RawDetalheRecord>();
  for (const rec of records) {
    const existing = map.get(rec.id);
    if (!existing) {
      map.set(rec.id, { ...rec });
    } else {
      map.set(rec.id, {
        id: rec.id,
        descricao: existing.descricao ?? rec.descricao,
        valor: existing.valor ?? rec.valor,
      });
    }
  }
  return map;
}

function buildStatusMap(records: RawStatusRecord[]): Map<string, RawStatusRecord> {
  const map = new Map<string, RawStatusRecord>();
  for (const rec of records) {
    const existing = map.get(rec.id);
    if (!existing) {
      map.set(rec.id, rec);
    } else if (
      rec.lastUpdTimestamp !== null &&
      (existing.lastUpdTimestamp === null || rec.lastUpdTimestamp >= existing.lastUpdTimestamp)
    ) {
      map.set(rec.id, rec);
    } else if (rec.lastUpdTimestamp === null && existing.lastUpdTimestamp === null) {
      map.set(rec.id, rec);
    }
  }
  return map;
}

function normalizeOverrideStatus(rawStatus: string): string {
  const trimmed = rawStatus.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'sorting' || lower === 'problem_solving' || lower === 'pendente') {
    return lower;
  }
  return trimmed;
}

export function processLogisticsData(input: ProcessInput): ProcessingResult {
  const hasStatusFile = input.hasStatusFile ?? input.statusRecords.length > 0;
  const detalhesMap = buildDetailMap(input.detalhesValor);
  const naMap = buildDetailMap(input.detalhesNA);
  const statusMap = buildStatusMap(input.statusRecords);

  const uniqueFaltantes = new Map<string, RawFaltanteRecord>();
  for (const item of input.faltantes) {
    const existing = uniqueFaltantes.get(item.id);
    if (!existing || item.dataTimestamp < existing.dataTimestamp) {
      uniqueFaltantes.set(item.id, item);
    }
  }

  const normalizedOverrides: ManualOverrideMap = {};
  for (const [rawId, entry] of Object.entries(input.manualOverrides)) {
    const cleanId = normalizeId(rawId);
    if (cleanId && entry?.status?.trim()) {
      normalizedOverrides[cleanId] = {
        status: entry.status.trim(),
        updatedAt: entry.updatedAt,
      };
    }
  }

  const allFilteredPackages: ProcessedPackage[] = [];

  for (const faltante of uniqueFaltantes.values()) {
    const detPrimary = detalhesMap.get(faltante.id);
    const detFallback = naMap.get(faltante.id);

    let descricao = detPrimary?.descricao ?? null;
    let valor = detPrimary?.valor ?? null;
    let fonteDetalhe: ProcessedPackage['fonteDetalhe'] = 'N/A';

    if (detPrimary && (detPrimary.descricao !== null || detPrimary.valor !== null)) {
      fonteDetalhe = 'Detalhes_valor';
    }

    if (descricao === null && detFallback?.descricao != null) {
      descricao = detFallback.descricao;
      if (fonteDetalhe === 'N/A') fonteDetalhe = 'detalhes_dos_NA';
    }
    if (valor === null && detFallback?.valor != null) {
      valor = detFallback.valor;
      if (fonteDetalhe === 'N/A') fonteDetalhe = 'detalhes_dos_NA';
    }

    const isNA = descricao === null || valor === null;

    const statusRec = statusMap.get(faltante.id);
    const statusArquivo = statusRec
      ? resolveFinalStatus(statusRec.subStatus, statusRec.statusShp)
      : 'pendente';

    const override = normalizedOverrides[faltante.id];
    const statusFinal = override ? normalizeOverrideStatus(override.status) : statusArquivo;
    const rotaGrupo = extractRouteGroup(faltante.rota);

    allFilteredPackages.push({
      id: faltante.id,
      rota: faltante.rota,
      rotaGrupo,
      dataTimestamp: faltante.dataTimestamp,
      dataIso: faltante.dataIso,
      dataFormatada: faltante.dataFormatada,
      descricao,
      valor,
      valorFormatado: formatCurrencyBRL(valor),
      isNA,
      statusArquivo,
      statusFinal,
      isManualOverride: Boolean(override),
      manualUpdatedAt: override?.updatedAt,
      subStatusOriginal: statusRec?.subStatus || undefined,
      statusShpOriginal: statusRec?.statusShp || undefined,
      fonteDetalhe,
    });
  }

  allFilteredPackages.sort((a, b) => {
    if (a.dataTimestamp !== b.dataTimestamp) {
      return a.dataTimestamp - b.dataTimestamp;
    }
    const grupoCmp = a.rotaGrupo.localeCompare(b.rotaGrupo, 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (grupoCmp !== 0) return grupoCmp;
    const rotaCmp = a.rota.localeCompare(b.rota, 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (rotaCmp !== 0) return rotaCmp;
    return a.id.localeCompare(b.id, 'pt-BR', { numeric: true });
  });

  const isMainViewStatus = (pkg: ProcessedPackage) =>
    hasStatusFile
      ? pkg.statusFinal === 'sorting'
      : pkg.statusFinal === 'sorting' || pkg.statusFinal === 'pendente';

  const sortingPackages = allFilteredPackages.filter(isMainViewStatus);
  const otherStatusPackages = allFilteredPackages.filter((pkg) => !isMainViewStatus(pkg));

  const statusIdList = allFilteredPackages.map((pkg) => pkg.id);
  const naIdList = allFilteredPackages.filter((pkg) => pkg.isNA).map((pkg) => pkg.id);

  const routeMap = new Map<string, ProcessedPackage[]>();
  for (const pkg of sortingPackages) {
    const list = routeMap.get(pkg.rotaGrupo);
    if (list) {
      list.push(pkg);
    } else {
      routeMap.set(pkg.rotaGrupo, [pkg]);
    }
  }

  const sortedRouteNames = Array.from(routeMap.keys()).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );

  const routeGroups: RouteGroup[] = sortedRouteNames.map((rota) => {
    const pkgs = routeMap.get(rota)!;
    const totalValue = pkgs.reduce((acc, p) => acc + (p.valor ?? 0), 0);
    const naCount = pkgs.filter((p) => p.isNA).length;
    return {
      rota,
      totalPackages: pkgs.length,
      totalValue,
      naCount,
      packages: pkgs,
    };
  });

  const resumoGroups: RouteGroup[] = routeGroups.map((group) => {
    const top7 = group.packages.slice(0, 7);
    const totalValue = top7.reduce((acc, p) => acc + (p.valor ?? 0), 0);
    const naCount = top7.filter((p) => p.isNA).length;
    return {
      rota: group.rota,
      totalPackages: group.totalPackages,
      totalValue,
      naCount,
      packages: top7,
    };
  });

  const totalValorSorting = sortingPackages.reduce((acc, p) => acc + (p.valor ?? 0), 0);

  return {
    hasStatusFile,
    allFilteredPackages,
    sortingPackages,
    otherStatusPackages,
    resumoGroups,
    routeGroups,
    statusIdList,
    statusIdString: statusIdList.join(','),
    naIdList,
    naIdString: naIdList.join(','),
    summary: {
      hasStatusFile,
      totalFaltantesBruto: input.faltantesTotalBruto ?? input.faltantes.length,
      totalFaltantesFiltrados: allFilteredPackages.length,
      totalSorting: sortingPackages.length,
      totalOutrosStatus: otherStatusPackages.length,
      totalNA: naIdList.length,
      totalValorSorting,
      totalRotasAtivas: routeGroups.length,
    },
  };
}
