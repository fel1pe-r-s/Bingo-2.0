import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCsvDelimiter,
  findColumnKey,
  parseCsvRows,
  parseDetalhesFile,
  parseFaltantesFile,
  parseJsonRows,
  parseStatusFile,
  parseTabularFile,
} from './fileParsers';

test('detectCsvDelimiter correctly identifies commas, semicolons and tabs in headers', () => {
  assert.equal(detectCsvDelimiter('id,rota,data,localizacao'), ',');
  assert.equal(detectCsvDelimiter('id;rota;data;localizacao'), ';');
  assert.equal(detectCsvDelimiter("id\trota\tdata\tlocalizacao"), '\t');
  // Semicolons inside quotes should not fool the detector if commas are unquoted
  assert.equal(detectCsvDelimiter('"col;1",col2,col3'), ',');
  // Commas inside quotes should not fool the detector if semicolons are unquoted
  assert.equal(detectCsvDelimiter('"col,1";col2;col3'), ';');
});

test('parseCsvRows handles quotes, escaped quotes, embedded delimiters, newlines, and BOM', () => {
  // Comma CSV with quotes and commas inside quotes
  const csv1 = 'ID,Nome,Local\n101,"Pacote, Frágil",São Paulo\n102,"Item ""Especial""",Rio';
  const rows1 = parseCsvRows(csv1);
  assert.equal(rows1.length, 2);
  assert.equal(rows1[0].Nome, 'Pacote, Frágil');
  assert.equal(rows1[1].Nome, 'Item "Especial"');

  // Semicolon CSV with Windows CRLF
  const csv2 = 'ID;Rota;Valor\r\n201;R-01;129,90\r\n202;R-02;85,00';
  const rows2 = parseCsvRows(csv2);
  assert.equal(rows2.length, 2);
  assert.equal(rows2[0].ID, '201');
  assert.equal(rows2[0].Valor, '129,90');

  // UTF-8 BOM prefix
  const csvBOM = '\uFEFFID,Rota\n301,R-03';
  const rowsBOM = parseCsvRows(csvBOM);
  assert.equal(rowsBOM.length, 1);
  assert.equal(rowsBOM[0].ID, '301');

  // Multi-line cell inside quotes
  const csvMultiline = 'ID,Desc\n401,"Linha 1\nLinha 2"';
  const rowsMultiline = parseCsvRows(csvMultiline);
  assert.equal(rowsMultiline.length, 1);
  assert.equal(rowsMultiline[0].Desc, 'Linha 1\nLinha 2');

  // Empty string
  assert.deepEqual(parseCsvRows(''), []);
  assert.deepEqual(parseCsvRows('   \n  '), []);
});

test('parseJsonRows handles arrays, wrapper objects (rows/data/records), NDJSON and errors on invalid JSON', () => {
  // Standard array
  const jsonArr = JSON.stringify([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  assert.equal(parseJsonRows(jsonArr).length, 2);

  // Wrapper object with "rows"
  const jsonRows = JSON.stringify({ rows: [{ id: 10 }, { id: 20 }] });
  assert.equal(parseJsonRows(jsonRows).length, 2);

  // Wrapper object with "data"
  const jsonData = JSON.stringify({ data: [{ id: 30 }] });
  assert.equal(parseJsonRows(jsonData).length, 1);

  // BigQuery NDJSON (newline-delimited JSON)
  const ndjson = '{"id":"ND1","status":"sorting"}\n{"id":"ND2","status":"problem_solving"}';
  const ndjsonParsed = parseJsonRows(ndjson);
  assert.equal(ndjsonParsed.length, 2);
  assert.equal(ndjsonParsed[0].id, 'ND1');
  assert.equal(ndjsonParsed[1].status, 'problem_solving');

  // Empty string
  assert.deepEqual(parseJsonRows(''), []);

  // Invalid JSON syntax throws friendly error
  assert.throws(
    () => parseJsonRows('invalid json content'),
    /Formato JSON inválido/
  );
});

test('parseTabularFile auto-detects CSV vs JSON and throws friendly error when empty', () => {
  // CSV file
  const rowsCsv = parseTabularFile('ID,Rota\n1,R-01', 'faltantes.csv');
  assert.equal(rowsCsv.length, 1);

  // JSON file
  const rowsJson = parseTabularFile('[{"ID":"1","Rota":"R-01"}]', 'data.json');
  assert.equal(rowsJson.length, 1);

  // Empty file throws error
  assert.throws(
    () => parseTabularFile('', 'vazio.csv'),
    /está vazio/
  );
});

test('findColumnKey finds matching headers by normalized aliases with priority order', () => {
  const headers = ['N.º Rota', 'Data de Inbound', 'ID do pacote', 'Localização do pacote'];

  const idCol = findColumnKey(headers, ['id do pacote', 'id pacote', 'id']);
  assert.equal(idCol, 'ID do pacote');

  const rotaCol = findColumnKey(headers, ['no rota', 'numero rota', 'rota', 'route']);
  assert.equal(rotaCol, 'N.º Rota');

  const dataCol = findColumnKey(headers, ['data inbound', 'data de inbound', 'data']);
  assert.equal(dataCol, 'Data de Inbound');

  const notFound = findColumnKey(headers, ['cliente', 'destinatario']);
  assert.equal(notFound, null);
});

test('parseFaltantesFile filters rows by Location "Na estação" and Inbound date, with column validation', () => {
  const validCsv = [
    'ID do pacote,N.º Rota,Data de Inbound,Localização do pacote',
    '1001.0,R-01,15/11/2026 08:00,Na estação',
    '1002,R-01,15/11/2026 08:30,NA ESTAÇÃO',
    '1003,,15/11/2026 09:00,Na estacao', // Missing route -> fallback to 'Sem Rota'
    '1004,R-02,,Na estação', // Missing date -> discarded
    '1005,R-02,15/11/2026 10:00,Em trânsito', // Location not in station -> discarded
    '1006,R-02,15/11/2026 10:30,Entregue', // Location not in station -> discarded
  ].join('\n');

  const parsed = parseFaltantesFile(validCsv, 'faltantes.csv');
  assert.equal(parsed.stats.loaded, true);
  assert.equal(parsed.stats.totalRows, 6);
  assert.equal(parsed.stats.validRows, 3);
  assert.equal(parsed.records.length, 3);

  assert.equal(parsed.records[0].id, '1001'); // cleaned .0
  assert.equal(parsed.records[0].rota, 'R-01');
  assert.equal(parsed.records[1].id, '1002');
  assert.equal(parsed.records[2].id, '1003');
  assert.equal(parsed.records[2].rota, 'Sem Rota');

  // Missing mandatory column returns error in stats
  const missingColCsv = 'ID,Rota,Data\n1,R-01,15/11/2026';
  const badParsed = parseFaltantesFile(missingColCsv, 'faltantes_bad.csv');
  assert.equal(badParsed.stats.loaded, false);
  assert.ok(badParsed.stats.error?.includes('Colunas obrigatórias não encontradas'));
});

test('parseDetalhesFile extracts ID, Descrição, and Valor across CSV and JSON with currency parsing', () => {
  const jsonContent = JSON.stringify([
    { SHP_SHIPMENT_ID: '2001', SHP_ITEM_DESC: 'Monitor Gamer 27"', SHP_ORDER_COST: 'R$ 1.250,00' },
    { SHP_SHIPMENT_ID: 2002, SHP_ITEM_DESC: 'Cabo HDMI 2.1', SHP_ORDER_COST: 45.9 },
    { SHP_SHIPMENT_ID: '2003', SHP_ITEM_DESC: null, SHP_ORDER_COST: 'N/A' },
  ]);

  const parsed = parseDetalhesFile(jsonContent, 'Detalhes_valor.json');
  assert.equal(parsed.stats.loaded, true);
  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.records[0].id, '2001');
  assert.equal(parsed.records[0].descricao, 'Monitor Gamer 27"');
  assert.equal(parsed.records[0].valor, 1250.0);
  assert.equal(parsed.records[1].valor, 45.9);
  assert.equal(parsed.records[2].descricao, null);
  assert.equal(parsed.records[2].valor, null);

  // Missing ID column returns error in stats
  const invalidJson = JSON.stringify([{ PRODUTO: 'Cadeira', PRECO: 500 }]);
  const badParsed = parseDetalhesFile(invalidJson, 'bad_detalhes.json');
  assert.equal(badParsed.stats.loaded, false);
  assert.ok(badParsed.stats.error?.includes('Coluna de ID não encontrada'));
});

test('parseStatusFile extracts ID, STATUS_SHP, SUB_STATUS and parses LAST_UPD dates', () => {
  const csvContent = [
    'ID;STATUS_SHP;SUB_STATUS;LAST_UPD',
    '3001;in_station;sorting;2026-11-17 08:00:00',
    '3002;delivered;;17/11/2026 09:30',
  ].join('\n');

  const parsed = parseStatusFile(csvContent, 'status.csv');
  assert.equal(parsed.stats.loaded, true);
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].id, '3001');
  assert.equal(parsed.records[0].statusShp, 'in_station');
  assert.equal(parsed.records[0].subStatus, 'sorting');
  assert.ok(parsed.records[0].lastUpdTimestamp !== null);

  assert.equal(parsed.records[1].id, '3002');
  assert.equal(parsed.records[1].statusShp, 'delivered');
  assert.equal(parsed.records[1].subStatus, '');

  // Missing status columns returns error
  const invalidCsv = 'ID;OutraColuna\n1;teste';
  const badParsed = parseStatusFile(invalidCsv, 'bad_status.csv');
  assert.equal(badParsed.stats.loaded, false);
  assert.ok(badParsed.stats.error?.includes('Colunas obrigatórias não encontradas'));
});
