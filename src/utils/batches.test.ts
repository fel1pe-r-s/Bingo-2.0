import test from 'node:test';
import assert from 'node:assert/strict';
import { ProcessedPackage } from '../types/logistics';
import { buildRouteIdBatches, formatIdsForClipboard, parseBatchIdsInput } from './batches';

function makePkg(id: string, rota: string, rotaGrupo = rota): ProcessedPackage {
  return {
    id,
    rota,
    rotaGrupo,
    dataTimestamp: 1000,
    dataIso: '2026-11-15T07:10:00.000Z',
    dataFormatada: '15/11/2026 07:10',
    descricao: 'Item',
    valor: 100,
    valorFormatado: 'R$ 100,00',
    isNA: false,
    statusArquivo: 'sorting',
    statusFinal: 'sorting',
    isManualOverride: false,
    fonteDetalhe: 'Detalhes_valor',
  };
}

test('buildRouteIdBatches splits packages by route in 5-by-5 batches', () => {
  const packages: ProcessedPackage[] = [
    ...Array.from({ length: 10 }, (_, i) => makePkg(`A${i + 1}`, 'R-01')),
    ...Array.from({ length: 3 }, (_, i) => makePkg(`B${i + 1}`, 'R-02')),
  ];

  const batches = buildRouteIdBatches(packages, 5, false);
  assert.equal(batches.length, 3);

  assert.equal(batches[0].rota, 'R-01');
  assert.equal(batches[0].startPos, 1);
  assert.equal(batches[0].endPos, 5);
  assert.equal(batches[0].formatted, 'A1,A2,A3,A4,A5');

  assert.equal(batches[1].rota, 'R-01');
  assert.equal(batches[1].startPos, 6);
  assert.equal(batches[1].endPos, 10);
  assert.equal(batches[1].formatted, 'A6,A7,A8,A9,A10');

  assert.equal(batches[2].rota, 'R-02');
  assert.equal(batches[2].startPos, 1);
  assert.equal(batches[2].endPos, 3);
  assert.equal(batches[2].formatted, 'B1,B2,B3');
});

test('buildRouteIdBatches groups sub-routes under rotaGrupo (e.g. A5_am1 and >A3 under A)', () => {
  const packages: ProcessedPackage[] = [
    makePkg('1', 'A5_am1', 'A'),
    makePkg('2', '>A3', 'A'),
    makePkg('3', 'A1', 'A'),
    makePkg('4', '>A', 'A'),
    makePkg('5', 'A2', 'A'),
    makePkg('6', 'A4', 'A'),
  ];

  const batches = buildRouteIdBatches(packages, 5, false);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].rota, 'A');
  assert.deepEqual(batches[0].ids, ['1', '2', '3', '4', '5']);
  assert.equal(batches[1].rota, 'A');
  assert.deepEqual(batches[1].ids, ['6']);
});

test('formatIdsForClipboard supports SQL single-quoted formatting', () => {
  assert.equal(formatIdsForClipboard(['101', '102'], false), '101,102');
  assert.equal(formatIdsForClipboard(['101', '102'], true), "'101','102'");
});

test('parseBatchIdsInput extracts, normalizes, and deduplicates pasted ID lists', () => {
  const parsed = parseBatchIdsInput(" '4401.0', 4402,\n4403; 4401 ");
  assert.deepEqual(parsed, ['4401', '4402', '4403']);
});
