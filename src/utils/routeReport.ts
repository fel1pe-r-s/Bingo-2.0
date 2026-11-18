import { ProcessingSummary, RouteGroup } from '../types/logistics';
import { formatCurrencyBRL } from './normalizers';

export function formatRouteLabel(rota: string): string {
  const trimmed = rota.trim();
  if (!trimmed) return 'Sem Rota';
  return trimmed.toLowerCase().startsWith('rota') ? trimmed : `Rota ${trimmed}`;
}

export function formatSingleRouteReportLine(group: RouteGroup): string {
  const pkgLabel = group.totalPackages === 1 ? 'pacote' : 'pacotes';
  return `${formatRouteLabel(group.rota)} total ${formatCurrencyBRL(group.totalValue)} (${group.totalPackages} ${pkgLabel})`;
}

export function buildRouteReportText(
  routeGroups: RouteGroup[],
  summary: ProcessingSummary
): string {
  const statusTitle = summary.hasStatusFile ? 'Sorting' : 'Pendentes';
  const totalPkgLabel = summary.totalSorting === 1 ? 'pacote' : 'pacotes';

  const lines: string[] = [
    `Relatório de Valores por Ilha / Rota (${statusTitle})`,
    `Total Geral: ${summary.totalSorting} ${totalPkgLabel} · ${formatCurrencyBRL(summary.totalValorSorting)}`,
  ];

  if (routeGroups.length > 0) {
    lines.push('');
    for (const group of routeGroups) {
      const pkgLabel = group.totalPackages === 1 ? 'pacote' : 'pacotes';
      lines.push(
        `${formatRouteLabel(group.rota)}: ${group.totalPackages} ${pkgLabel} · ${formatCurrencyBRL(group.totalValue)}`
      );
    }
  }

  return lines.join('\n');
}
