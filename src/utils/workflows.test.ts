import test from 'node:test';
import assert from 'node:assert/strict';
import { getDemoDatasetStrings } from '../data/demoData';
import { parseDetalhesFile, parseFaltantesFile, parseStatusFile } from './fileParsers';
import { processLogisticsData } from './processor';
import { buildPackagesCsvString } from './exporters';
import { ALL_COLUMNS, ColumnKey } from '../types/logistics';

test('Workflow Journey: Initial faltantes upload without status file defaults to pendente and generates BigQuery ID lists', () => {
  const demo = getDemoDatasetStrings();
  const faltantes = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
  assert.equal(faltantes.stats.loaded, true);
  assert.equal(faltantes.stats.totalRows, 21);
  assert.equal(faltantes.stats.validRows, 18); // 3 invalid rows filtered out

  // Step 1: Process faltantes alone (no status file, no details yet)
  const step1 = processLogisticsData({
    faltantes: faltantes.records,
    faltantesTotalBruto: faltantes.stats.totalRows,
    detalhesValor: [],
    statusRecords: [],
    hasStatusFile: false,
    detalhesNA: [],
    manualOverrides: {},
  });

  // Verify status is "pendente" for all 18 eligible station packages
  assert.equal(step1.hasStatusFile, false);
  assert.equal(step1.sortingPackages.length, 18);
  assert.equal(step1.otherStatusPackages.length, 0);
  assert.ok(step1.sortingPackages.every((p) => p.statusFinal === 'pendente'));

  // BigQuery Status ID list contains all 18 package IDs ready for IN (...)
  assert.equal(step1.statusIdList.length, 18);
  assert.ok(step1.statusIdString.includes('4401928301,4401928302'));

  // Because no details were uploaded yet, all 18 are N/A
  assert.equal(step1.naIdList.length, 18);
});

test('Workflow Journey: Ingesting status and Detalhes_valor separates sorting from other statuses and refines N/A list', () => {
  const demo = getDemoDatasetStrings();
  const faltantes = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
  const detalhes = parseDetalhesFile(demo.detalhesValorJson, 'Detalhes_valor.json');
  const status = parseStatusFile(demo.statusJson, 'status.json');

  // Step 2: Ingest faltantes + status + detalhesValor (before detalhes_dos_NA)
  const step2 = processLogisticsData({
    faltantes: faltantes.records,
    faltantesTotalBruto: faltantes.stats.totalRows,
    detalhesValor: detalhes.records,
    statusRecords: status.records,
    hasStatusFile: true,
    detalhesNA: [],
    manualOverrides: {},
  });

  assert.equal(step2.hasStatusFile, true);
  // 15 packages in sorting, 3 in other status (problem_solving, in_cart/on_route, damaged/returned)
  assert.equal(step2.sortingPackages.length, 15);
  assert.equal(step2.otherStatusPackages.length, 3);
  assert.ok(step2.sortingPackages.every((p) => p.statusFinal === 'sorting'));

  // Other status packages must contain the expected non-sorting statuses
  const otherStatuses = step2.otherStatusPackages.map((p) => p.statusFinal);
  assert.ok(otherStatuses.includes('problem_solving'));
  assert.ok(otherStatuses.includes('on_route'));
  assert.ok(otherStatuses.includes('returned'));

  // Without detalhes_dos_NA, 4 packages are N/A (4401928308, 4401928310, 4401928403, 4401928502)
  assert.equal(step2.naIdList.length, 4);
  assert.ok(step2.naIdList.includes('4401928308'));
  assert.ok(step2.naIdList.includes('4401928502'));
});

test('Workflow Journey: Ingesting detalhes_dos_NA enriches missing packages with correct fonteDetalhe', () => {
  const demo = getDemoDatasetStrings();
  const faltantes = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
  const detalhes = parseDetalhesFile(demo.detalhesValorJson, 'Detalhes_valor.json');
  const status = parseStatusFile(demo.statusJson, 'status.json');
  const na = parseDetalhesFile(demo.detalhesNaJson, 'detalhes_dos_NA.json');

  // Step 3: Ingest all 4 files
  const step3 = processLogisticsData({
    faltantes: faltantes.records,
    faltantesTotalBruto: faltantes.stats.totalRows,
    detalhesValor: detalhes.records,
    statusRecords: status.records,
    hasStatusFile: true,
    detalhesNA: na.records,
    manualOverrides: {},
  });

  // Packages 4401928308 and 4401928502 were filled by detalhes_dos_NA
  const pkg308 = step3.sortingPackages.find((p) => p.id === '4401928308');
  assert.ok(pkg308);
  assert.equal(pkg308.descricao, 'Suporte Articulado para Monitor');
  assert.equal(pkg308.valor, 149.9);
  assert.equal(pkg308.fonteDetalhe, 'detalhes_dos_NA');
  assert.equal(pkg308.isNA, false);

  const pkg502 = step3.sortingPackages.find((p) => p.id === '4401928502');
  assert.ok(pkg502);
  assert.equal(pkg502.descricao, 'SSD NVMe 1TB PCIe 4.0');
  assert.equal(pkg502.valor, 429.0);
  assert.equal(pkg502.fonteDetalhe, 'detalhes_dos_NA');

  // Only 2 packages remain N/A: 4401928310 and 4401928403
  assert.equal(step3.naIdList.length, 2);
  assert.deepEqual(step3.naIdList, ['4401928310', '4401928403']);
});

test('Workflow Journey: Dynamic manual status overrides and rollbacks update view segregation seamlessly', () => {
  const demo = getDemoDatasetStrings();
  const faltantes = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
  const detalhes = parseDetalhesFile(demo.detalhesValorJson, 'Detalhes_valor.json');
  const status = parseStatusFile(demo.statusJson, 'status.json');

  // Base state
  const base = processLogisticsData({
    faltantes: faltantes.records,
    detalhesValor: detalhes.records,
    statusRecords: status.records,
    hasStatusFile: true,
    detalhesNA: [],
    manualOverrides: {},
  });
  assert.equal(base.sortingPackages.length, 15);
  assert.equal(base.otherStatusPackages.length, 3);

  // Override 1: Move package 4401928301 from sorting -> delivered
  // Override 2: Move package 4401928404 from problem_solving -> sorting
  const withOverrides = processLogisticsData({
    faltantes: faltantes.records,
    detalhesValor: detalhes.records,
    statusRecords: status.records,
    hasStatusFile: true,
    detalhesNA: [],
    manualOverrides: {
      '4401928301': { status: 'delivered', updatedAt: '18/11/2026 10:00' },
      '4401928404': { status: 'sorting', updatedAt: '18/11/2026 10:05' },
    },
  });

  // Net sorting packages is still 15 (one moved out, one moved in)
  assert.equal(withOverrides.sortingPackages.length, 15);
  const pkgMovedOut = withOverrides.otherStatusPackages.find((p) => p.id === '4401928301');
  assert.ok(pkgMovedOut);
  assert.equal(pkgMovedOut.statusFinal, 'delivered');
  assert.equal(pkgMovedOut.isManualOverride, true);

  const pkgMovedIn = withOverrides.sortingPackages.find((p) => p.id === '4401928404');
  assert.ok(pkgMovedIn);
  assert.equal(pkgMovedIn.statusFinal, 'sorting');
  assert.equal(pkgMovedIn.isManualOverride, true);

  // Rollback override on 4401928301
  const rolledBack = processLogisticsData({
    faltantes: faltantes.records,
    detalhesValor: detalhes.records,
    statusRecords: status.records,
    hasStatusFile: true,
    detalhesNA: [],
    manualOverrides: {
      '4401928404': { status: 'sorting', updatedAt: '18/11/2026 10:05' },
    },
  });

  // Now sorting has 16 packages
  assert.equal(rolledBack.sortingPackages.length, 16);
  const pkgRestored = rolledBack.sortingPackages.find((p) => p.id === '4401928301');
  assert.ok(pkgRestored);
  assert.equal(pkgRestored.isManualOverride, false);
  assert.equal(pkgRestored.statusFinal, 'sorting');
});

test('Workflow Journey: Resumo cuts off at top 7 per route while Por Rota shows full packages', () => {
  const demo = getDemoDatasetStrings();
  const faltantes = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
  const detalhes = parseDetalhesFile(demo.detalhesValorJson, 'Detalhes_valor.json');
  const status = parseStatusFile(demo.statusJson, 'status.json');

  const result = processLogisticsData({
    faltantes: faltantes.records,
    detalhesValor: detalhes.records,
    statusRecords: status.records,
    hasStatusFile: true,
    detalhesNA: [],
    manualOverrides: {},
  });

  // Route A has 10 packages in sorting (across A5_am1, >A5_am1, A3, >A3, >A, etc.)
  const fullGroup = result.routeGroups.find((g) => g.rota === 'A');
  assert.ok(fullGroup);
  assert.equal(fullGroup.packages.length, 10);
  assert.equal(fullGroup.totalPackages, 10);
  assert.ok(fullGroup.packages.every((p) => p.rotaGrupo === 'A'));

  // In Resumo, Route A must be strictly capped at 7
  const resumoGroup = result.resumoGroups.find((g) => g.rota === 'A');
  assert.ok(resumoGroup);
  assert.equal(resumoGroup.packages.length, 7);
  assert.equal(resumoGroup.totalPackages, 10);

  // Top 7 must be in ascending chronological order of Inbound date
  for (let i = 1; i < resumoGroup.packages.length; i++) {
    assert.ok(
      resumoGroup.packages[i].dataTimestamp >= resumoGroup.packages[i - 1].dataTimestamp
    );
  }

  // Routes with fewer than 7 packages (e.g. B with 3, C with 2) keep all packages
  const bResumo = result.resumoGroups.find((g) => g.rota === 'B');
  assert.ok(bResumo);
  assert.equal(bResumo.packages.length, 3);
});

test('Workflow Journey: Export formatting respects visible columns dynamically', () => {
  const demo = getDemoDatasetStrings();
  const faltantes = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
  const detalhes = parseDetalhesFile(demo.detalhesValorJson, 'Detalhes_valor.json');
  const status = parseStatusFile(demo.statusJson, 'status.json');

  const result = processLogisticsData({
    faltantes: faltantes.records,
    detalhesValor: detalhes.records,
    statusRecords: status.records,
    hasStatusFile: true,
    detalhesNA: [],
    manualOverrides: {},
  });

  // Export full columns
  const allCols = ALL_COLUMNS.map((c) => c.key);
  const fullCsv = buildPackagesCsvString(result.sortingPackages, allCols);
  assert.ok(fullCsv.includes('ID;Rota;Data;Descrição;Valor;Status'));

  // Export minimal columns (ID and Rota only)
  const minCols: ColumnKey[] = ['id', 'rota'];
  const minCsv = buildPackagesCsvString(result.sortingPackages, minCols);
  const minHeader = minCsv.slice(1).split('\r\n')[0];
  assert.equal(minHeader, 'ID;Rota');
  assert.ok(!minHeader.includes('Descrição'));
  assert.ok(!minHeader.includes('Valor'));
});
