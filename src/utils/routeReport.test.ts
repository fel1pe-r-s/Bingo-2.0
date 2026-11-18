import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRouteReportText,
  formatRouteLabel,
  formatSingleRouteReportLine,
} from './routeReport';
import { ProcessingSummary, RouteGroup } from '../types/logistics';

test('formatRouteLabel normalizes route names with Rota prefix', () => {
  assert.equal(formatRouteLabel('A'), 'Rota A');
  assert.equal(formatRouteLabel('Rota B'), 'Rota B');
  assert.equal(formatRouteLabel('rota c'), 'rota c');
  assert.equal(formatRouteLabel('  '), 'Sem Rota');
});

test('formatSingleRouteReportLine formats route total and package count cleanly', () => {
  const group: RouteGroup = {
    rota: 'A',
    totalPackages: 4,
    totalValue: 213,
    naCount: 0,
    packages: [],
  };

  assert.equal(formatSingleRouteReportLine(group), 'Rota A total R$\u00a0213,00 (4 pacotes)');
});

test('buildRouteReportText includes general total, package count, and every route breakdown', () => {
  const routeGroups: RouteGroup[] = [
    { rota: 'A', totalPackages: 4, totalValue: 213, naCount: 0, packages: [] },
    { rota: 'B', totalPackages: 1, totalValue: 87.5, naCount: 0, packages: [] },
  ];
  const summary: ProcessingSummary = {
    hasStatusFile: true,
    totalFaltantesBruto: 10,
    totalFaltantesFiltrados: 6,
    totalSorting: 5,
    totalOutrosStatus: 1,
    totalNA: 0,
    totalValorSorting: 300.5,
    totalRotasAtivas: 2,
  };

  const text = buildRouteReportText(routeGroups, summary);
  assert.match(text, /Relatório de Valores por Ilha \/ Rota \(Sorting\)/);
  assert.match(text, /Total Geral: 5 pacotes · R\$\s300,50/);
  assert.match(text, /Rota A: 4 pacotes · R\$\s213,00/);
  assert.match(text, /Rota B: 1 pacote · R\$\s87,50/);
});
