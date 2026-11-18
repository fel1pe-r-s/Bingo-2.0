import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIdBatches,
  chunkArray,
  getAllTopNIdsFromGroups,
  getTopNIds,
  summarizeRouteBatches,
} from './idChunker';
import { ProcessedPackage, RouteGroup } from '../types/logistics';

function makeMockPackage(id: string, rota = 'A', rotaGrupo = 'A'): ProcessedPackage {
  return {
    id,
    rota,
    rotaGrupo,
    dataTimestamp: 1000,
    dataIso: '2026-11-15T10:00:00Z',
    dataFormatada: '15/11/2026 10:00',
    descricao: 'Item Teste',
    valor: 100,
    valorFormatado: 'R$ 100,00',
    isNA: false,
    statusArquivo: 'sorting',
    statusFinal: 'sorting',
    isManualOverride: false,
    fonteDetalhe: 'Detalhes_valor',
  };
}

test('chunkArray splits array into even chunks with remainder in last chunk', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const chunks = chunkArray(items, 5);
  assert.equal(chunks.length, 3);
  assert.deepEqual(chunks[0], [1, 2, 3, 4, 5]);
  assert.deepEqual(chunks[1], [6, 7, 8, 9, 10]);
  assert.deepEqual(chunks[2], [11, 12]);
});

test('chunkArray returns empty array for empty inputs or invalid sizes', () => {
  assert.deepEqual(chunkArray([], 5), []);
  assert.deepEqual(chunkArray([1, 2], 0), []);
  assert.deepEqual(chunkArray([1, 2], -1), []);
});

test('buildIdBatches partitions route packages into batches of 5 with indices and comma strings', () => {
  const pkgs = Array.from({ length: 12 }, (_, i) => makeMockPackage(`PKG-${i + 1}`));
  const batches = buildIdBatches(pkgs, 5);

  assert.equal(batches.length, 3);

  // Batch 1: 1 to 5
  assert.equal(batches[0].batchIndex, 1);
  assert.equal(batches[0].label, 'Lote 1 (1-5)');
  assert.equal(batches[0].startIndex, 1);
  assert.equal(batches[0].endIndex, 5);
  assert.equal(batches[0].count, 5);
  assert.equal(batches[0].idString, 'PKG-1,PKG-2,PKG-3,PKG-4,PKG-5');

  // Batch 2: 6 to 10
  assert.equal(batches[1].batchIndex, 2);
  assert.equal(batches[1].label, 'Lote 2 (6-10)');
  assert.equal(batches[1].startIndex, 6);
  assert.equal(batches[1].endIndex, 10);
  assert.equal(batches[1].count, 5);
  assert.equal(batches[1].idString, 'PKG-6,PKG-7,PKG-8,PKG-9,PKG-10');

  // Batch 3: 11 to 12
  assert.equal(batches[2].batchIndex, 3);
  assert.equal(batches[2].label, 'Lote 3 (11-12)');
  assert.equal(batches[2].startIndex, 11);
  assert.equal(batches[2].endIndex, 12);
  assert.equal(batches[2].count, 2);
  assert.equal(batches[2].idString, 'PKG-11,PKG-12');
});

test('getTopNIds extracts first 7 IDs of a route in chronological order', () => {
  const pkgs = Array.from({ length: 10 }, (_, i) => makeMockPackage(`ID-${i + 1}`));
  const top7 = getTopNIds(pkgs, 7);

  assert.equal(top7.count, 7);
  assert.deepEqual(top7.ids, ['ID-1', 'ID-2', 'ID-3', 'ID-4', 'ID-5', 'ID-6', 'ID-7']);
  assert.equal(top7.idString, 'ID-1,ID-2,ID-3,ID-4,ID-5,ID-6,ID-7');

  // When packages < 7, returns all packages
  const small = pkgs.slice(0, 3);
  const topSmall = getTopNIds(small, 7);
  assert.equal(topSmall.count, 3);
  assert.equal(topSmall.idString, 'ID-1,ID-2,ID-3');
});

test('summarizeRouteBatches provides 5-in-5 batches, Top 7 and all IDs for a route', () => {
  const pkgs = Array.from({ length: 10 }, (_, i) => makeMockPackage(`ID-${i + 1}`, 'A5_am1', 'A'));
  const group: RouteGroup = {
    rota: 'A',
    totalPackages: 10,
    totalValue: 1000,
    naCount: 0,
    packages: pkgs,
  };

  const summary = summarizeRouteBatches(group);
  assert.equal(summary.rota, 'A');
  assert.equal(summary.totalPackages, 10);
  assert.equal(summary.batchesOf5.length, 2);
  assert.equal(summary.batchesOf5[0].idString, 'ID-1,ID-2,ID-3,ID-4,ID-5');
  assert.equal(summary.batchesOf5[1].idString, 'ID-6,ID-7,ID-8,ID-9,ID-10');
  assert.equal(summary.top7.count, 7);
  assert.equal(summary.allIds.count, 10);
});

test('getAllTopNIdsFromGroups combines Top 7 across multiple route groups', () => {
  const groupA: RouteGroup = {
    rota: 'A',
    totalPackages: 10,
    totalValue: 1000,
    naCount: 0,
    packages: Array.from({ length: 10 }, (_, i) => makeMockPackage(`A-${i + 1}`, 'A', 'A')),
  };
  const groupB: RouteGroup = {
    rota: 'B',
    totalPackages: 3,
    totalValue: 300,
    naCount: 0,
    packages: Array.from({ length: 3 }, (_, i) => makeMockPackage(`B-${i + 1}`, 'B', 'B')),
  };

  const result = getAllTopNIdsFromGroups([groupA, groupB], 7);
  // Route A provides 7, Route B provides 3 -> Total 10
  assert.equal(result.total, 10);
  assert.equal(result.perRoute.length, 2);
  assert.equal(result.perRoute[0].count, 7);
  assert.equal(result.perRoute[1].count, 3);
  assert.ok(result.idString.startsWith('A-1,A-2,A-3,A-4,A-5,A-6,A-7,B-1,B-2,B-3'));
});
