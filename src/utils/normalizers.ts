export function stripAccents(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeColumnKey(header: string): string {
  return stripAccents(header)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeId(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (!str) return '';

  str = str.replace(/^['"]+|['"]+$/g, '').trim();
  str = str.replace(/^,+|,+$/g, '').trim();
  if (/^\d+\.0+$/.test(str)) {
    str = str.replace(/\.0+$/, '');
  }
  return str;
}

export function isNaEstacao(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  const normalized = stripAccents(String(raw))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized === 'na estacao';
}

export function formatDateBR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export interface ParsedDateResult {
  timestamp: number;
  iso: string;
  formatted: string;
}

export function parseFlexibleDate(raw: unknown): ParsedDateResult | null {
  if (raw === null || raw === undefined) return null;

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return {
      timestamp: raw.getTime(),
      iso: raw.toISOString(),
      formatted: formatDateBR(raw),
    };
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    let ms = raw;
    if (raw > 30000 && raw < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      ms = excelEpoch + Math.round(raw * 86400 * 1000);
    } else if (raw > 0 && raw < 1e11) {
      ms = raw * 1000;
    }
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return { timestamp: d.getTime(), iso: d.toISOString(), formatted: formatDateBR(d) };
  }

  const text = String(raw).trim();
  if (!text || /^(null|na|n\/a|-)$/i.test(text)) return null;

  if (/^\d{10,13}$/.test(text)) {
    const num = Number(text);
    return parseFlexibleDate(num);
  }

  const brMatch = text.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    let year = Number(brMatch[3]);
    if (year < 100) year += 2000;
    const hour = brMatch[4] ? Number(brMatch[4]) : 0;
    const min = brMatch[5] ? Number(brMatch[5]) : 0;
    const sec = brMatch[6] ? Number(brMatch[6]) : 0;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day, hour, min, sec);
      if (!Number.isNaN(d.getTime())) {
        return { timestamp: d.getTime(), iso: d.toISOString(), formatted: formatDateBR(d) };
      }
    }
  }

  const isoNaiveMatch = text.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/
  );
  if (isoNaiveMatch) {
    const year = Number(isoNaiveMatch[1]);
    const month = Number(isoNaiveMatch[2]);
    const day = Number(isoNaiveMatch[3]);
    const hour = isoNaiveMatch[4] ? Number(isoNaiveMatch[4]) : 0;
    const min = isoNaiveMatch[5] ? Number(isoNaiveMatch[5]) : 0;
    const sec = isoNaiveMatch[6] ? Number(isoNaiveMatch[6]) : 0;
    const d = new Date(year, month - 1, day, hour, min, sec);
    if (!Number.isNaN(d.getTime())) {
      return { timestamp: d.getTime(), iso: d.toISOString(), formatted: formatDateBR(d) };
    }
  }

  const normalizedUtc = text.replace(/\s+UTC$/i, 'Z').replace(' ', 'T');
  const parsed = new Date(normalizedUtc);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      timestamp: parsed.getTime(),
      iso: parsed.toISOString(),
      formatted: formatDateBR(parsed),
    };
  }

  return null;
}

export function parseFlexibleCurrency(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }

  let str = String(raw).trim();
  if (!str || /^(n\/a|na|null|undefined|-)$/i.test(str)) return null;

  str = str.replace(/R\$|\$|BRL|\s+/gi, '').trim();
  if (!str) return null;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      str = str.replace(',', '.');
    } else if (/^\d{1,3}(,\d{3})+$/.test(str)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (hasDot) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    }
  }

  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : null;
}

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrencyBRL(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return brlFormatter.format(value);
}

export function normalizeDescription(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str || /^(n\/a|na|null|undefined|-)$/i.test(str)) return null;
  return str;
}

export function resolveFinalStatus(subStatusRaw: unknown, statusShpRaw: unknown): string {
  const sub = subStatusRaw === null || subStatusRaw === undefined ? '' : String(subStatusRaw).trim();
  const subLower = sub.toLowerCase();

  if (subLower === 'sorting' || subLower === 'problem_solving') {
    return subLower;
  }

  const shp = statusShpRaw === null || statusShpRaw === undefined ? '' : String(statusShpRaw).trim();
  if (!shp) {
    return sub || 'pendente';
  }

  const shpLower = shp.toLowerCase();
  if (shpLower === 'sorting' || shpLower === 'problem_solving') {
    return shpLower;
  }
  return shp;
}
