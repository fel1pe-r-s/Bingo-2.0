import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractRouteGroup,
  formatCurrencyBRL,
  formatDateBR,
  isNaEstacao,
  normalizeColumnKey,
  normalizeDescription,
  normalizeId,
  parseFlexibleCurrency,
  parseFlexibleDate,
  resolveFinalStatus,
  stripAccents,
} from './normalizers';

test('stripAccents removes diacritics while preserving casing and symbols', () => {
  assert.equal(stripAccents('estação'), 'estacao');
  assert.equal(stripAccents('ESTAÇÃO'), 'ESTACAO');
  assert.equal(stripAccents('São Paulo - Área 01'), 'Sao Paulo - Area 01');
  assert.equal(stripAccents('N.º Rota'), 'N.o Rota');
  assert.equal(stripAccents('áéíóúãõâêîôûàèìòùç'), 'aeiouaoaeiouaeiouc');
  assert.equal(stripAccents(''), '');
});

test('normalizeColumnKey cleans accents, casing, and special characters into space-separated tokens', () => {
  assert.equal(normalizeColumnKey('ID do pacote'), 'id do pacote');
  assert.equal(normalizeColumnKey('N.º Rota'), 'n o rota');
  assert.equal(normalizeColumnKey('Data de Inbound'), 'data de inbound');
  assert.equal(normalizeColumnKey('Localização do pacote'), 'localizacao do pacote');
  assert.equal(normalizeColumnKey('SHP_SHIPMENT_ID'), 'shp shipment id');
  assert.equal(normalizeColumnKey('  SUB-STATUS / ETAPA  '), 'sub status etapa');
  assert.equal(normalizeColumnKey('VALOR_REAL ($)'), 'valor real');
});

test('normalizeId trims quotes, commas, spaces and trailing .0 from numeric IDs', () => {
  assert.equal(normalizeId('4401928301.0'), '4401928301');
  assert.equal(normalizeId('4401928301.00'), '4401928301');
  assert.equal(normalizeId(4401928301), '4401928301');
  assert.equal(normalizeId('"4401928302,"'), '4401928302');
  assert.equal(normalizeId("'4401928303'"), '4401928303');
  assert.equal(normalizeId(' ,,, 4401928304 ,,, '), '4401928304');
  assert.equal(normalizeId('PKG-001.0'), 'PKG-001.0'); // alphanumeric float preserved
  assert.equal(normalizeId(null), '');
  assert.equal(normalizeId(undefined), '');
  assert.equal(normalizeId('   '), '');
});

test('isNaEstacao detects "Na estação" in any casing, accent, or whitespace variation', () => {
  assert.equal(isNaEstacao('Na estação'), true);
  assert.equal(isNaEstacao('na estacao'), true);
  assert.equal(isNaEstacao('NA ESTAÇÃO'), true);
  assert.equal(isNaEstacao('  Na   estação  '), true);
  assert.equal(isNaEstacao('Em trânsito'), false);
  assert.equal(isNaEstacao('Entregue'), false);
  assert.equal(isNaEstacao('Extraviado'), false);
  assert.equal(isNaEstacao(''), false);
  assert.equal(isNaEstacao(null), false);
  assert.equal(isNaEstacao(undefined), false);
});

test('formatDateBR formats Date objects strictly into dd/mm/yyyy HH:mm', () => {
  const d = new Date(2026, 10, 15, 8, 5, 0); // Month 10 is November in JS Date
  assert.equal(formatDateBR(d), '15/11/2026 08:05');
});

test('parseFlexibleDate supports Brazilian dates, ISO formats, BigQuery UTC, epoch numbers, and Excel serial dates', () => {
  // Brazilian format with time
  const br1 = parseFlexibleDate('15/11/2026 08:25');
  assert.ok(br1);
  assert.equal(br1.formatted, '15/11/2026 08:25');

  // Brazilian format with seconds and dashes
  const br2 = parseFlexibleDate('16-11-2026 14:30:45');
  assert.ok(br2);
  assert.equal(br2.formatted, '16/11/2026 14:30');

  // Brazilian format date-only (defaults to 00:00)
  const br3 = parseFlexibleDate('20/01/2026');
  assert.ok(br3);
  assert.equal(br3.formatted, '20/01/2026 00:00');

  // ISO string with space
  const iso1 = parseFlexibleDate('2026-11-15 07:10:00');
  assert.ok(iso1);
  assert.equal(iso1.formatted, '15/11/2026 07:10');

  // BigQuery UTC string
  const bqUtc = parseFlexibleDate('2026-11-15 12:00:00 UTC');
  assert.ok(bqUtc);
  assert.ok(bqUtc.iso.endsWith('.000Z') || bqUtc.iso.endsWith('Z'));

  // Native Date object
  const dateObj = new Date(2026, 4, 10, 15, 30);
  const parsedObj = parseFlexibleDate(dateObj);
  assert.ok(parsedObj);
  assert.equal(parsedObj.formatted, '10/05/2026 15:30');

  // Numeric epoch milliseconds
  const epochMs = 1794747600000;
  const parsedEpoch = parseFlexibleDate(epochMs);
  assert.ok(parsedEpoch);

  // Excel serial date (e.g. 46341.5)
  const excelSerial = parseFlexibleDate(46341.5);
  assert.ok(excelSerial);

  // Rejects invalid inputs
  assert.equal(parseFlexibleDate(''), null);
  assert.equal(parseFlexibleDate(null), null);
  assert.equal(parseFlexibleDate('N/A'), null);
  assert.equal(parseFlexibleDate('null'), null);
  assert.equal(parseFlexibleDate('data-invalida'), null);
  assert.equal(parseFlexibleDate('32/13/2026'), null);
  assert.equal(parseFlexibleDate(new Date('invalid')), null);
});

test('parseFlexibleCurrency parses Brazilian R$, US $, floats, and handles null/N/A', () => {
  assert.equal(parseFlexibleCurrency(189.9), 189.9);
  assert.equal(parseFlexibleCurrency(0), 0);
  assert.equal(parseFlexibleCurrency('R$ 1.299,50'), 1299.5);
  assert.equal(parseFlexibleCurrency('R$ 349,50'), 349.5);
  assert.equal(parseFlexibleCurrency('129,90'), 129.9);
  assert.equal(parseFlexibleCurrency('12,5'), 12.5);
  assert.equal(parseFlexibleCurrency('$ 1,234.56'), 1234.56);
  assert.equal(parseFlexibleCurrency('1,234.56'), 1234.56);
  assert.equal(parseFlexibleCurrency('150.00'), 150.0);
  assert.equal(parseFlexibleCurrency('N/A'), null);
  assert.equal(parseFlexibleCurrency('na'), null);
  assert.equal(parseFlexibleCurrency('-'), null);
  assert.equal(parseFlexibleCurrency(''), null);
  assert.equal(parseFlexibleCurrency(null), null);
  assert.equal(parseFlexibleCurrency(undefined), null);
});

test('formatCurrencyBRL formats number into currency and returns N/A for null/invalid', () => {
  const formatted = formatCurrencyBRL(1299.5).replace(/\u00a0/g, ' ');
  assert.equal(formatted, 'R$ 1.299,50');
  assert.equal(formatCurrencyBRL(0).replace(/\u00a0/g, ' '), 'R$ 0,00');
  assert.equal(formatCurrencyBRL(null), 'N/A');
  assert.equal(formatCurrencyBRL(Number.NaN), 'N/A');
});

test('normalizeDescription returns cleaned string or null for N/A indicators', () => {
  assert.equal(normalizeDescription('Teclado Mecânico'), 'Teclado Mecânico');
  assert.equal(normalizeDescription('  Fone Bluetooth  '), 'Fone Bluetooth');
  assert.equal(normalizeDescription('N/A'), null);
  assert.equal(normalizeDescription('na'), null);
  assert.equal(normalizeDescription('null'), null);
  assert.equal(normalizeDescription('-'), null);
  assert.equal(normalizeDescription(''), null);
  assert.equal(normalizeDescription(null), null);
});

test('resolveFinalStatus prioritizes SUB_STATUS sorting/problem_solving and defaults appropriately', () => {
  // Rule 1: SUB_STATUS = sorting or problem_solving wins
  assert.equal(resolveFinalStatus('sorting', 'in_station'), 'sorting');
  assert.equal(resolveFinalStatus('SORTING', 'in_station'), 'sorting');
  assert.equal(resolveFinalStatus('problem_solving', 'in_station'), 'problem_solving');
  assert.equal(resolveFinalStatus('PROBLEM_SOLVING', 'in_station'), 'problem_solving');

  // Rule 2: Other sub-statuses yield to STATUS_SHP
  assert.equal(resolveFinalStatus('in_cart', 'on_route'), 'on_route');
  assert.equal(resolveFinalStatus('damaged', 'returned'), 'returned');
  assert.equal(resolveFinalStatus('waiting', 'delivered'), 'delivered');

  // Rule 3: STATUS_SHP is sorting or problem_solving
  assert.equal(resolveFinalStatus('cart_pending', 'sorting'), 'sorting');
  assert.equal(resolveFinalStatus('', 'problem_solving'), 'problem_solving');

  // Rule 4: Fallbacks
  assert.equal(resolveFinalStatus('in_transit', ''), 'in_transit');
  assert.equal(resolveFinalStatus('', ''), 'pendente');
  assert.equal(resolveFinalStatus(null, null), 'pendente');
});

test('extractRouteGroup correctly groups route variations by route letter (A, >A, A5_am1, >A3 -> A)', () => {
  // Routes of group A
  assert.equal(extractRouteGroup('A5_am1'), 'A');
  assert.equal(extractRouteGroup('>A5_am1'), 'A');
  assert.equal(extractRouteGroup('A3'), 'A');
  assert.equal(extractRouteGroup('>A3'), 'A');
  assert.equal(extractRouteGroup('A'), 'A');
  assert.equal(extractRouteGroup('>A'), 'A');
  assert.equal(extractRouteGroup('> a5_am1'), 'A');
  assert.equal(extractRouteGroup('Rota A5_am1'), 'A');
  assert.equal(extractRouteGroup('Rota >A3'), 'A');
  assert.equal(extractRouteGroup('Route >A'), 'A');

  // Routes of group B
  assert.equal(extractRouteGroup('B2_am1'), 'B');
  assert.equal(extractRouteGroup('>B2_am1'), 'B');
  assert.equal(extractRouteGroup('B'), 'B');
  assert.equal(extractRouteGroup('>B'), 'B');
  assert.equal(extractRouteGroup('b1_pm'), 'B');

  // Multi-letter routes
  assert.equal(extractRouteGroup('AA1_am1'), 'AA');
  assert.equal(extractRouteGroup('>AA3'), 'AA');

  // Hub prefixed routes
  assert.equal(extractRouteGroup('SP-A5_am1'), 'A');
  assert.equal(extractRouteGroup('SP->B2_am1'), 'B');

  // Edge cases and fallbacks
  assert.equal(extractRouteGroup(null), 'Sem Rota');
  assert.equal(extractRouteGroup(undefined), 'Sem Rota');
  assert.equal(extractRouteGroup(''), 'Sem Rota');
  assert.equal(extractRouteGroup(' - '), 'Sem Rota');
  assert.equal(extractRouteGroup('>'), 'Sem Rota');
  assert.equal(extractRouteGroup('104'), '104');
});

