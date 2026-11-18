import {
  FileParseStats,
  RawDetalheRecord,
  RawFaltanteRecord,
  RawStatusRecord,
} from '../types/logistics';
import {
  isNaEstacao,
  normalizeColumnKey,
  normalizeDescription,
  normalizeId,
  parseFlexibleCurrency,
  parseFlexibleDate,
} from './normalizers';

type GenericRow = Record<string, unknown>;

export function detectCsvDelimiter(headerLine: string): string {
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  let inQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ',') commas++;
      else if (ch === ';') semis++;
      else if (ch === '\t') tabs++;
    }
  }

  if (semis > commas && semis >= tabs) return ';';
  if (tabs > commas && tabs > semis) return '\t';
  return ',';
}

export function parseCsvRows(content: string): GenericRow[] {
  const clean = content.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  const firstNewline = clean.search(/\r?\n/);
  const firstLine = firstNewline === -1 ? clean : clean.slice(0, firstNewline);
  const delimiter = detectCsvDelimiter(firstLine);

  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(cell.trim());
        matrix.push(row);
        row = [];
        cell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell.trim());
        matrix.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    matrix.push(row);
  }

  if (matrix.length < 2) return [];

  const headers = matrix[0].map((h) => h.trim());
  const records: GenericRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const values = matrix[r];
    if (values.length === 1 && values[0] === '') continue;
    const obj: GenericRow = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      obj[key] = values[c] ?? '';
    }
    records.push(obj);
  }

  return records;
}

export function parseJsonRows(content: string): GenericRow[] {
  const clean = content.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is GenericRow => typeof item === 'object' && item !== null);
    }
    if (typeof parsed === 'object' && parsed !== null) {
      for (const wrapperKey of ['rows', 'data', 'records', 'items', 'results']) {
        const candidate = (parsed as GenericRow)[wrapperKey];
        if (Array.isArray(candidate)) {
          return candidate.filter(
            (item): item is GenericRow => typeof item === 'object' && item !== null
          );
        }
      }
      return [parsed as GenericRow];
    }
  } catch {
    const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      try {
        const ndjsonRows: GenericRow[] = [];
        for (const line of lines) {
          const obj = JSON.parse(line);
          if (typeof obj === 'object' && obj !== null) {
            ndjsonRows.push(obj as GenericRow);
          } else {
            throw new Error('Not an object');
          }
        }
        if (ndjsonRows.length > 0) return ndjsonRows;
      } catch {
        // Fall through to descriptive error below
      }
    }
  }

  throw new Error('Formato JSON inválido. Esperado um array de objetos ou JSON por linha (NDJSON).');
}

export function parseTabularFile(content: string, fileName: string): GenericRow[] {
  const clean = content.replace(/^\uFEFF/, '').trim();
  if (!clean) {
    throw new Error(`O arquivo "${fileName}" está vazio.`);
  }

  const lowerName = fileName.toLowerCase();
  const looksLikeJson = lowerName.endsWith('.json') || clean.startsWith('[') || clean.startsWith('{');

  if (looksLikeJson) {
    try {
      return parseJsonRows(clean);
    } catch (err) {
      if (lowerName.endsWith('.json')) {
        throw err instanceof Error
          ? err
          : new Error(`Não foi possível ler o JSON "${fileName}".`);
      }
    }
  }

  const csvRows = parseCsvRows(clean);
  if (csvRows.length === 0) {
    throw new Error(
      `Não foram encontradas linhas de dados válidas em "${fileName}". Verifique o cabeçalho e o separador.`
    );
  }
  return csvRows;
}

export function findColumnKey(headers: string[], aliases: string[]): string | null {
  const normalizedMap = headers.map((raw) => ({
    raw,
    norm: normalizeColumnKey(raw),
  }));

  const normalizedAliases = aliases.map((a) => normalizeColumnKey(a));

  for (const alias of normalizedAliases) {
    const exact = normalizedMap.find((h) => h.norm === alias);
    if (exact) return exact.raw;
  }

  for (const alias of normalizedAliases) {
    if (alias.length < 3) continue;
    const partial = normalizedMap.find(
      (h) => h.norm.includes(alias) || (h.norm.length >= 4 && alias.includes(h.norm))
    );
    if (partial) return partial.raw;
  }

  return null;
}

function collectHeaders(rows: GenericRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows.slice(0, 25)) {
    for (const key of Object.keys(row)) {
      set.add(key);
    }
  }
  return Array.from(set);
}

export function parseFaltantesFile(
  content: string,
  fileName: string
): { records: RawFaltanteRecord[]; stats: FileParseStats } {
  try {
    const rows = parseTabularFile(content, fileName);
    const headers = collectHeaders(rows);

    const idCol = findColumnKey(headers, [
      'id do pacote',
      'id pacote',
      'shp shipment id',
      'shipment id',
      'id',
      'pedido',
      'codigo pacote',
      'codigo',
    ]);
    const rotaCol = findColumnKey(headers, [
      'n o rota',
      'no rota',
      'n rota',
      'numero rota',
      'numero da rota',
      'rota',
      'route',
      'route id',
      'cluster',
    ]);
    const dataCol = findColumnKey(headers, [
      'data de inbound',
      'data inbound',
      'dt inbound',
      'inbound date',
      'inbound',
      'data',
      'date',
    ]);
    const locCol = findColumnKey(headers, [
      'localizacao do pacote',
      'localizacao pacote',
      'localizacao',
      'pacote localizacao',
      'location',
    ]);

    const missing: string[] = [];
    if (!idCol) missing.push('ID do pacote');
    if (!rotaCol) missing.push('Rota');
    if (!dataCol) missing.push('Data de Inbound');
    if (!locCol) missing.push('Localização do pacote');

    if (missing.length > 0) {
      throw new Error(
        `Colunas obrigatórias não encontradas em "${fileName}": ${missing.join(', ')}. Colunas lidas: ${headers.join(', ')}`
      );
    }

    const validRecords: RawFaltanteRecord[] = [];
    for (const row of rows) {
      const id = normalizeId(row[idCol!]);
      if (!id) continue;

      const parsedDate = parseFlexibleDate(row[dataCol!]);
      if (!parsedDate) continue;

      const locRaw = row[locCol!];
      if (!isNaEstacao(locRaw)) continue;

      const rotaRaw = row[rotaCol!];
      const rota = rotaRaw !== null && rotaRaw !== undefined && String(rotaRaw).trim() !== ''
        ? String(rotaRaw).trim()
        : 'Sem Rota';

      validRecords.push({
        id,
        rota,
        dataTimestamp: parsedDate.timestamp,
        dataIso: parsedDate.iso,
        dataFormatada: parsedDate.formatted,
        localizacao: String(locRaw).trim(),
      });
    }

    return {
      records: validRecords,
      stats: {
        loaded: true,
        fileName,
        totalRows: rows.length,
        validRows: validRecords.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao ler faltantes.';
    return {
      records: [],
      stats: {
        loaded: false,
        fileName,
        totalRows: 0,
        validRows: 0,
        error: message,
      },
    };
  }
}

export function parseDetalhesFile(
  content: string,
  fileName: string
): { records: RawDetalheRecord[]; stats: FileParseStats } {
  try {
    const rows = parseTabularFile(content, fileName);
    const headers = collectHeaders(rows);

    const idCol = findColumnKey(headers, [
      'shp shipment id',
      'shipment id',
      'id do pacote',
      'id pacote',
      'id',
      'pedido',
      'order id',
    ]);
    const descCol = findColumnKey(headers, [
      'shp item desc',
      'item desc',
      'descricao',
      'desc',
      'description',
      'produto',
      'item',
    ]);
    const valorCol = findColumnKey(headers, [
      'valor real',
      'shp order cost',
      'order cost',
      'valor',
      'value',
      'cost',
      'price',
      'preco',
    ]);

    if (!idCol) {
      throw new Error(
        `Coluna de ID não encontrada em "${fileName}". Esperado: ID, SHP_SHIPMENT_ID ou PEDIDO.`
      );
    }

    const records: RawDetalheRecord[] = [];
    for (const row of rows) {
      const id = normalizeId(row[idCol]);
      if (!id) continue;

      const descricao = descCol ? normalizeDescription(row[descCol]) : null;
      const valor = valorCol ? parseFlexibleCurrency(row[valorCol]) : null;

      records.push({
        id,
        descricao,
        valor,
      });
    }

    return {
      records,
      stats: {
        loaded: true,
        fileName,
        totalRows: rows.length,
        validRows: records.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao ler detalhes.';
    return {
      records: [],
      stats: {
        loaded: false,
        fileName,
        totalRows: 0,
        validRows: 0,
        error: message,
      },
    };
  }
}

export function parseStatusFile(
  content: string,
  fileName: string
): { records: RawStatusRecord[]; stats: FileParseStats } {
  try {
    const rows = parseTabularFile(content, fileName);
    const headers = collectHeaders(rows);

    const idCol = findColumnKey(headers, [
      'id',
      'shp shipment id',
      'shipment id',
      'id do pacote',
      'pedido',
    ]);
    const subStatusCol = findColumnKey(headers, ['sub status', 'sub_status', 'substatus']);
    const statusShpCol = findColumnKey(headers, [
      'status shp',
      'status_shp',
      'shp status',
      'status',
    ]);
    const lastUpdCol = findColumnKey(headers, [
      'last upd',
      'last_upd',
      'updated at',
      'ultima atualizacao',
      'data atualizacao',
    ]);

    if (!idCol || (!statusShpCol && !subStatusCol)) {
      throw new Error(
        `Colunas obrigatórias não encontradas em "${fileName}". Esperado: ID e STATUS_SHP / SUB_STATUS.`
      );
    }

    const records: RawStatusRecord[] = [];
    for (const row of rows) {
      const id = normalizeId(row[idCol]);
      if (!id) continue;

      const statusShp = statusShpCol && row[statusShpCol] != null ? String(row[statusShpCol]).trim() : '';
      const subStatus = subStatusCol && row[subStatusCol] != null ? String(row[subStatusCol]).trim() : '';
      const parsedUpd = lastUpdCol ? parseFlexibleDate(row[lastUpdCol]) : null;

      records.push({
        id,
        statusShp,
        subStatus,
        lastUpdTimestamp: parsedUpd ? parsedUpd.timestamp : null,
      });
    }

    return {
      records,
      stats: {
        loaded: true,
        fileName,
        totalRows: rows.length,
        validRows: records.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao ler status.';
    return {
      records: [],
      stats: {
        loaded: false,
        fileName,
        totalRows: 0,
        validRows: 0,
        error: message,
      },
    };
  }
}
