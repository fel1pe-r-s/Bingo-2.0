import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPackagesCsvString,
  buildPackagesExcelRows,
  buildPackagesExcelWorkbook,
  escapeCsvCell,
  exportPackagesToCSV,
  exportPackagesToExcel,
  exportResumoToCSV,
  exportResumoToExcel,
  getColumnCellValue,
  getColumnHeader,
} from './exporters';
import { ColumnKey, ProcessedPackage, RouteGroup } from '../types/logistics';

const samplePackages: ProcessedPackage[] = [
  {
    id: '4401928301',
    rota: 'SP-Z1-04',
    rotaGrupo: 'Z',
    dataTimestamp: 1794747000000,
    dataIso: '2026-11-15T07:10:00.000Z',
    dataFormatada: '15/11/2026 07:10',
    descricao: 'Fone Bluetooth TWS Pro',
    valor: 189.9,
    valorFormatado: 'R$ 189,90',
    isNA: false,
    statusArquivo: 'sorting',
    statusFinal: 'sorting',
    isManualOverride: false,
    fonteDetalhe: 'Detalhes_valor',
  },
  {
    id: '4401928302',
    rota: 'SP-Z1-04',
    rotaGrupo: 'Z',
    dataTimestamp: 1794751500000,
    dataIso: '2026-11-15T08:25:00.000Z',
    dataFormatada: '15/11/2026 08:25',
    descricao: null,
    valor: null,
    valorFormatado: 'N/A',
    isNA: true,
    statusArquivo: 'problem_solving',
    statusFinal: 'sorting',
    isManualOverride: true,
    manualUpdatedAt: '18/11/2026 10:00',
    fonteDetalhe: 'N/A',
  },
];

const sampleGroups: RouteGroup[] = [
  {
    rota: 'SP-Z1-04',
    totalPackages: 2,
    totalValue: 189.9,
    naCount: 1,
    packages: samplePackages,
  },
];

test('escapeCsvCell escapes semicolons, commas, newlines, and internal double quotes', () => {
  assert.equal(escapeCsvCell('Simples'), 'Simples');
  assert.equal(escapeCsvCell(123), '123');
  assert.equal(escapeCsvCell('Texto;Com;PontoEVirgula'), '"Texto;Com;PontoEVirgula"');
  assert.equal(escapeCsvCell('Texto, Com, Virgula'), '"Texto, Com, Virgula"');
  assert.equal(escapeCsvCell('Linha 1\nLinha 2'), '"Linha 1\nLinha 2"');
  assert.equal(escapeCsvCell('Item "Especial"'), '"Item ""Especial"""');
});

test('getColumnHeader maps ColumnKey to user-friendly Portuguese header', () => {
  assert.equal(getColumnHeader('id'), 'ID');
  assert.equal(getColumnHeader('rota'), 'Rota');
  assert.equal(getColumnHeader('data'), 'Data');
  assert.equal(getColumnHeader('descricao'), 'Descrição');
  assert.equal(getColumnHeader('valor'), 'Valor');
  assert.equal(getColumnHeader('status'), 'Status');
});

test('getColumnCellValue extracts formatted values and attaches (Manual) tag for overrides', () => {
  const pkg1 = samplePackages[0];
  assert.equal(getColumnCellValue(pkg1, 'id'), '4401928301');
  assert.equal(getColumnCellValue(pkg1, 'rota'), 'SP-Z1-04');
  assert.equal(getColumnCellValue(pkg1, 'data'), '15/11/2026 07:10');
  assert.equal(getColumnCellValue(pkg1, 'descricao'), 'Fone Bluetooth TWS Pro');
  assert.equal(getColumnCellValue(pkg1, 'valor'), 'R$ 189,90');
  assert.equal(getColumnCellValue(pkg1, 'status'), 'sorting');

  const pkg2 = samplePackages[1];
  assert.equal(getColumnCellValue(pkg2, 'descricao'), 'N/A');
  assert.equal(getColumnCellValue(pkg2, 'valor'), 'N/A');
  assert.equal(getColumnCellValue(pkg2, 'status'), 'sorting (Manual)');
});

test('buildPackagesCsvString outputs UTF-8 BOM, semicolon delimiter, and respects visibleColumns', () => {
  const allCols: ColumnKey[] = ['id', 'rota', 'data', 'descricao', 'valor', 'status'];
  const csv = buildPackagesCsvString(samplePackages, allCols);

  // Must begin with UTF-8 BOM \uFEFF
  assert.ok(csv.startsWith('\uFEFF'));

  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'ID;Rota;Data;Descrição;Valor;Status');
  assert.equal(lines[1], '4401928301;SP-Z1-04;15/11/2026 07:10;Fone Bluetooth TWS Pro;"R$ 189,90";sorting');
  assert.equal(lines[2], '4401928302;SP-Z1-04;15/11/2026 08:25;N/A;N/A;sorting (Manual)');

  // Subset of columns
  const subsetCols: ColumnKey[] = ['id', 'rota', 'valor'];
  const subsetCsv = buildPackagesCsvString(samplePackages, subsetCols);
  const subsetLines = subsetCsv.slice(1).split('\r\n');
  assert.equal(subsetLines[0], 'ID;Rota;Valor');
  assert.equal(subsetLines[1], '4401928301;SP-Z1-04;"R$ 189,90"');
});

test('buildPackagesExcelRows structures objects with numeric valor for Excel compatibility', () => {
  const cols: ColumnKey[] = ['id', 'rota', 'valor', 'status'];
  const rows = buildPackagesExcelRows(samplePackages, cols);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].ID, '4401928301');
  assert.equal(rows[0].Rota, 'SP-Z1-04');
  assert.equal(rows[0].Valor, 189.9); // raw numeric float in Excel
  assert.equal(rows[0].Status, 'sorting');

  assert.equal(rows[1].ID, '4401928302');
  assert.equal(rows[1].Valor, 'N/A'); // null is represented as 'N/A'
  assert.equal(rows[1].Status, 'sorting (Manual)');
});

test('buildPackagesExcelWorkbook creates valid XLSX workbook with named worksheet', () => {
  const cols: ColumnKey[] = ['id', 'rota', 'data', 'valor'];
  const workbook = buildPackagesExcelWorkbook(samplePackages, cols, 'Minha_Aba_Sorting');

  assert.ok(workbook.SheetNames.includes('Minha_Aba_Sorting'));
  const sheet = workbook.Sheets['Minha_Aba_Sorting'];
  assert.ok(sheet);
  assert.equal(sheet['A1'].v, 'ID');
  assert.equal(sheet['B1'].v, 'Rota');
  assert.equal(sheet['A2'].v, '4401928301');
  assert.equal(sheet['D2'].v, 189.9);
});

test('exportResumoToCSV and exportResumoToExcel correctly flatten RouteGroup[] packages', () => {
  const cols: ColumnKey[] = ['id', 'rota', 'status'];
  const csv = exportResumoToCSV(sampleGroups, cols, 'resumo.csv');
  assert.ok(csv.includes('4401928301;SP-Z1-04;sorting'));
  assert.ok(csv.includes('4401928302;SP-Z1-04;sorting (Manual)'));

  const wb = exportResumoToExcel(sampleGroups, cols, 'resumo.xlsx');
  assert.ok(wb.SheetNames.includes('Resumo_Top7_Rota'));
});

test('exportPackagesToCSV and exportPackagesToExcel execute safely in non-browser environment without errors', () => {
  const cols: ColumnKey[] = ['id', 'rota'];
  const csv = exportPackagesToCSV(samplePackages, cols, 'test.csv');
  assert.ok(csv.includes('4401928301;SP-Z1-04'));

  const wb = exportPackagesToExcel(samplePackages, cols, 'Sheet1', 'test.xlsx');
  assert.ok(wb.SheetNames.includes('Sheet1'));
});
