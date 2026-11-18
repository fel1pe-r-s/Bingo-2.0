import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrencyBRL,
  isNaEstacao,
  normalizeId,
  parseFlexibleCurrency,
  parseFlexibleDate,
  resolveFinalStatus,
} from './normalizers';
import { parseDetalhesFile, parseFaltantesFile, parseStatusFile } from './fileParsers';
import { processLogisticsData } from './processor';
import { getDemoDatasetStrings } from '../data/demoData';

test('normalizeId cleans .0 suffixes, commas, quotes, and spaces', () => {
  assert.equal(normalizeId('4401928301.0'), '4401928301');
  assert.equal(normalizeId(4401928301), '4401928301');
  assert.equal(normalizeId(' "4401928302," '), '4401928302');
  assert.equal(normalizeId('ABC-123.0'), 'ABC-123.0');
  assert.equal(normalizeId(null), '');
});

test('isNaEstacao matches accented and unaccented variations case-insensitively', () => {
  assert.equal(isNaEstacao('Na estação'), true);
  assert.equal(isNaEstacao('na estacao'), true);
  assert.equal(isNaEstacao('  NA ESTAÇÃO  '), true);
  assert.equal(isNaEstacao('Em trânsito'), false);
  assert.equal(isNaEstacao(''), false);
});

test('parseFlexibleDate parses multiple formats and outputs dd/mm/yyyy HH:mm', () => {
  const iso = parseFlexibleDate('2026-11-15 07:10:00');
  assert.ok(iso);
  assert.equal(iso.formatted, '15/11/2026 07:10');

  const br = parseFlexibleDate('16/11/2026 08:25');
  assert.ok(br);
  assert.equal(br.formatted, '16/11/2026 08:25');

  const invalid = parseFlexibleDate('');
  assert.equal(invalid, null);
});

test('parseFlexibleCurrency parses BRL, US, and numeric values accurately', () => {
  assert.equal(parseFlexibleCurrency(189.9), 189.9);
  assert.equal(parseFlexibleCurrency('R$ 1.299,50'), 1299.5);
  assert.equal(parseFlexibleCurrency('349,50'), 349.5);
  assert.equal(parseFlexibleCurrency('1,234.56'), 1234.56);
  assert.equal(parseFlexibleCurrency('N/A'), null);
  assert.equal(formatCurrencyBRL(1299.5).replace(/\u00a0/g, ' '), 'R$ 1.299,50');
});

test('resolveFinalStatus applies SUB_STATUS priority rule for sorting and problem_solving', () => {
  assert.equal(resolveFinalStatus('sorting', 'in_station'), 'sorting');
  assert.equal(resolveFinalStatus('PROBLEM_SOLVING', 'in_station'), 'problem_solving');
  assert.equal(resolveFinalStatus('in_cart', 'sorting'), 'sorting');
  assert.equal(resolveFinalStatus('damaged', 'returned'), 'returned');
  assert.equal(resolveFinalStatus('', 'delivered'), 'delivered');
});

test('end-to-end demo dataset processing obeys all filtering, fallback, sorting, BigQuery ID list, and Resumo rules', () => {
  const demo = getDemoDatasetStrings();
  const faltantes = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
  const detalhes = parseDetalhesFile(demo.detalhesValorJson, 'Detalhes_valor.json');
  const status = parseStatusFile(demo.statusJson, 'status.json');
  const na = parseDetalhesFile(demo.detalhesNaJson, 'detalhes_dos_NA.json');

  assert.equal(faltantes.stats.error, undefined);
  assert.equal(faltantes.stats.totalRows, 21);
  assert.equal(faltantes.stats.validRows, 18);

  const result = processLogisticsData({
    faltantes: faltantes.records,
    faltantesTotalBruto: faltantes.stats.totalRows,
    detalhesValor: detalhes.records,
    statusRecords: status.records,
    detalhesNA: na.records,
    manualOverrides: {},
  });

  assert.equal(result.summary.totalFaltantesFiltrados, 18);
  assert.equal(result.summary.totalSorting, 15);
  assert.equal(result.summary.totalOutrosStatus, 3);
  assert.equal(result.summary.totalNA, 2);
  assert.deepEqual(result.naIdList, ['4401928310', '4401928403']);

  const filledByNa = result.sortingPackages.find((p) => p.id === '4401928308');
  assert.ok(filledByNa);
  assert.equal(filledByNa.descricao, 'Suporte Articulado para Monitor');
  assert.equal(filledByNa.fonteDetalhe, 'detalhes_dos_NA');

  for (let i = 1; i < result.sortingPackages.length; i++) {
    assert.ok(result.sortingPackages[i].dataTimestamp >= result.sortingPackages[i - 1].dataTimestamp);
  }

  const spz1Resumo = result.resumoGroups.find((g) => g.rota === 'SP-Z1-04');
  const spz1Full = result.routeGroups.find((g) => g.rota === 'SP-Z1-04');
  assert.ok(spz1Resumo && spz1Full);
  assert.equal(spz1Resumo.packages.length, 7);
  assert.equal(spz1Full.packages.length, 10);
  assert.equal(result.statusIdList.length, 18);
});

test('manual status override always takes precedence over file status', () => {
  const demo = getDemoDatasetStrings();
  const faltantes = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
  const detalhes = parseDetalhesFile(demo.detalhesValorJson, 'Detalhes_valor.json');
  const status = parseStatusFile(demo.statusJson, 'status.json');
  const na = parseDetalhesFile(demo.detalhesNaJson, 'detalhes_dos_NA.json');

  const result = processLogisticsData({
    faltantes: faltantes.records,
    detalhesValor: detalhes.records,
    statusRecords: status.records,
    detalhesNA: na.records,
    manualOverrides: {
      '4401928301': { status: 'delivered', updatedAt: '18/11/2026 09:00' },
      '4401928404': { status: 'sorting', updatedAt: '18/11/2026 09:01' },
    },
  });

  const movedOut = result.otherStatusPackages.find((p) => p.id === '4401928301');
  assert.ok(movedOut);
  assert.equal(movedOut.statusFinal, 'delivered');
  assert.equal(movedOut.statusArquivo, 'sorting');
  assert.equal(movedOut.isManualOverride, true);

  const movedIn = result.sortingPackages.find((p) => p.id === '4401928404');
  assert.ok(movedIn);
  assert.equal(movedIn.statusFinal, 'sorting');
  assert.equal(movedIn.statusArquivo, 'problem_solving');
  assert.equal(movedIn.isManualOverride, true);
});

test('friendly error handling for malformed files and NDJSON/semicolon CSV support', () => {
  const badCsv = parseFaltantesFile('colA,colB\n1,2', 'faltantes.csv');
  assert.ok(badCsv.stats.error?.includes('Colunas obrigatórias não encontradas'));

  const semiCsv = parseFaltantesFile(
    'ID;Rota;Data de Inbound;Localização\n9901;R-01;18/11/2026 10:00;Na estação',
    'faltantes_pt.csv'
  );
  assert.equal(semiCsv.stats.error, undefined);
  assert.equal(semiCsv.records.length, 1);
  assert.equal(semiCsv.records[0].id, '9901');

  const ndjsonStatus = parseStatusFile(
    '{"ID":"9901","STATUS_SHP":"sorting","SUB_STATUS":""}\n{"ID":"9902","STATUS_SHP":"returned","SUB_STATUS":""}',
    'status.json'
  );
  assert.equal(ndjsonStatus.stats.error, undefined);
  assert.equal(ndjsonStatus.records.length, 2);
});

test('when status file is absent, eligible packages show in main/resumo/rotas with pendente as default status', () => {
  const demo = getDemoDatasetStrings();
  const faltantes = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
  const detalhes = parseDetalhesFile(demo.detalhesValorJson, 'Detalhes_valor.json');

  const result = processLogisticsData({
    faltantes: faltantes.records,
    faltantesTotalBruto: faltantes.stats.totalRows,
    detalhesValor: detalhes.records,
    statusRecords: [],
    hasStatusFile: false,
    detalhesNA: [],
    manualOverrides: {
      '4401928404': { status: 'delivered', updatedAt: '18/11/2026 10:00' },
      '4401928301': { status: 'sorting', updatedAt: '18/11/2026 10:01' },
    },
  });

  assert.equal(result.hasStatusFile, false);
  assert.equal(result.summary.totalFaltantesFiltrados, 18);
  assert.equal(result.summary.totalSorting, 17);
  assert.equal(result.summary.totalOutrosStatus, 1);

  const defaultPkg = result.sortingPackages.find((p) => p.id === '4401928302');
  assert.ok(defaultPkg);
  assert.equal(defaultPkg.statusFinal, 'pendente');
  assert.equal(defaultPkg.isManualOverride, false);

  const manualSorting = result.sortingPackages.find((p) => p.id === '4401928301');
  assert.ok(manualSorting);
  assert.equal(manualSorting.statusFinal, 'sorting');
  assert.equal(manualSorting.statusArquivo, 'pendente');

  const manualDelivered = result.otherStatusPackages.find((p) => p.id === '4401928404');
  assert.ok(manualDelivered);
  assert.equal(manualDelivered.statusFinal, 'delivered');

  const spz1Resumo = result.resumoGroups.find((g) => g.rota === 'SP-Z1-04');
  assert.ok(spz1Resumo);
  assert.equal(spz1Resumo.packages.length, 7);
});
