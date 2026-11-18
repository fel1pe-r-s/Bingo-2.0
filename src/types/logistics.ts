export type ColumnKey = 'id' | 'rota' | 'data' | 'descricao' | 'valor' | 'status';

export const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'rota', label: 'Rota' },
  { key: 'data', label: 'Data' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'valor', label: 'Valor' },
  { key: 'status', label: 'Status' },
];

export interface RawFaltanteRecord {
  id: string;
  rota: string;
  dataTimestamp: number;
  dataIso: string;
  dataFormatada: string;
  localizacao: string;
}

export interface RawDetalheRecord {
  id: string;
  descricao: string | null;
  valor: number | null;
}

export interface RawStatusRecord {
  id: string;
  statusShp: string;
  subStatus: string;
  lastUpdTimestamp: number | null;
}

export interface FileParseStats {
  loaded: boolean;
  fileName: string;
  totalRows: number;
  validRows: number;
  error?: string;
}

export interface ManualOverrideEntry {
  status: string;
  updatedAt: string;
}

export type ManualOverrideMap = Record<string, ManualOverrideEntry>;

export interface ProcessedPackage {
  id: string;
  rota: string;
  rotaGrupo: string;
  dataTimestamp: number;
  dataIso: string;
  dataFormatada: string;
  descricao: string | null;
  valor: number | null;
  valorFormatado: string;
  isNA: boolean;
  statusArquivo: string;
  statusFinal: string;
  isManualOverride: boolean;
  manualUpdatedAt?: string;
  subStatusOriginal?: string;
  statusShpOriginal?: string;
  fonteDetalhe: 'Detalhes_valor' | 'detalhes_dos_NA' | 'N/A';
}

export interface RouteGroup {
  rota: string;
  totalPackages: number;
  totalValue: number;
  naCount: number;
  packages: ProcessedPackage[];
}

export interface ProcessingSummary {
  hasStatusFile: boolean;
  totalFaltantesBruto: number;
  totalFaltantesFiltrados: number;
  totalSorting: number;
  totalOutrosStatus: number;
  totalNA: number;
  totalValorSorting: number;
  totalRotasAtivas: number;
}

export interface ProcessingResult {
  hasStatusFile: boolean;
  allFilteredPackages: ProcessedPackage[];
  sortingPackages: ProcessedPackage[];
  otherStatusPackages: ProcessedPackage[];
  resumoGroups: RouteGroup[];
  routeGroups: RouteGroup[];
  statusIdList: string[];
  statusIdString: string;
  naIdList: string[];
  naIdString: string;
  summary: ProcessingSummary;
}

export type ActiveTab = 'principal' | 'resumo' | 'rotas' | 'outros';

export type PrintMode = 'none' | 'current-route' | 'all-routes-principal' | 'all-routes-resumo';
