import * as XLSX from 'xlsx';
import { ALL_COLUMNS, ColumnKey, ProcessedPackage, RouteGroup } from '../types/logistics';

export function getColumnHeader(key: ColumnKey): string {
  return ALL_COLUMNS.find((c) => c.key === key)?.label ?? key;
}

export function getColumnCellValue(pkg: ProcessedPackage, key: ColumnKey): string | number {
  switch (key) {
    case 'id':
      return pkg.id;
    case 'rota':
      return pkg.rota;
    case 'data':
      return pkg.dataFormatada;
    case 'descricao':
      return pkg.descricao ?? 'N/A';
    case 'valor':
      return pkg.valorFormatado;
    case 'status':
      return pkg.isManualOverride ? `${pkg.statusFinal} (Manual)` : pkg.statusFinal;
  }
}

export function escapeCsvCell(val: string | number): string {
  const str = String(val);
  if (/[;"\n\r,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildPackagesCsvString(
  packages: ProcessedPackage[],
  visibleColumns: ColumnKey[]
): string {
  const headers = visibleColumns.map(getColumnHeader);
  const lines = [
    headers.map(escapeCsvCell).join(';'),
    ...packages.map((pkg) =>
      visibleColumns.map((col) => escapeCsvCell(getColumnCellValue(pkg, col))).join(';')
    ),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

export function buildPackagesExcelRows(
  packages: ProcessedPackage[],
  visibleColumns: ColumnKey[]
): Record<string, string | number>[] {
  return packages.map((pkg) => {
    const obj: Record<string, string | number> = {};
    for (const col of visibleColumns) {
      const header = getColumnHeader(col);
      if (col === 'valor') {
        obj[header] = pkg.valor !== null ? pkg.valor : 'N/A';
      } else {
        obj[header] = getColumnCellValue(pkg, col);
      }
    }
    return obj;
  });
}

export function buildPackagesExcelWorkbook(
  packages: ProcessedPackage[],
  visibleColumns: ColumnKey[],
  sheetName: string
): XLSX.WorkBook {
  const rows = buildPackagesExcelRows(packages, visibleColumns);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  return workbook;
}

function triggerDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof URL === 'undefined') {
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPackagesToCSV(
  packages: ProcessedPackage[],
  visibleColumns: ColumnKey[],
  filename: string
): string {
  const csvContent = buildPackagesCsvString(packages, visibleColumns);
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, filename);
  return csvContent;
}

export function exportPackagesToExcel(
  packages: ProcessedPackage[],
  visibleColumns: ColumnKey[],
  sheetName: string,
  filename: string
): XLSX.WorkBook {
  const workbook = buildPackagesExcelWorkbook(packages, visibleColumns, sheetName);
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    XLSX.writeFile(workbook, filename);
  }
  return workbook;
}

export function exportResumoToCSV(
  groups: RouteGroup[],
  visibleColumns: ColumnKey[],
  filename: string
): string {
  const flatPackages = groups.flatMap((g) => g.packages);
  return exportPackagesToCSV(flatPackages, visibleColumns, filename);
}

export function exportResumoToExcel(
  groups: RouteGroup[],
  visibleColumns: ColumnKey[],
  filename: string
): XLSX.WorkBook {
  const flatPackages = groups.flatMap((g) => g.packages);
  return exportPackagesToExcel(flatPackages, visibleColumns, 'Resumo_Top7_Rota', filename);
}
