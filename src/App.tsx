import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActiveTab,
  ALL_COLUMNS,
  ColumnKey,
  FileParseStats,
  ManualOverrideMap,
  PrintMode,
  RawDetalheRecord,
  RawFaltanteRecord,
  RawStatusRecord,
} from './types/logistics';
import {
  parseDetalhesFile,
  parseFaltantesFile,
  parseStatusFile,
} from './utils/fileParsers';
import { processLogisticsData } from './utils/processor';
import { formatDateBR, normalizeId } from './utils/normalizers';
import {
  exportPackagesToCSV,
  exportPackagesToExcel,
  exportResumoToCSV,
  exportResumoToExcel,
} from './utils/exporters';
import { formatIdsForClipboard, parseBatchIdsInput } from './utils/batches';
import { copyTextToClipboard } from './utils/idChunker';
import { getDemoDatasetStrings } from './data/demoData';
import { Header } from './components/Header';
import { FileSlotKey, IngestionSidebar } from './components/IngestionSidebar';
import { KpiStrip } from './components/KpiStrip';
import { TableToolbar } from './components/TableToolbar';
import { BatchIdCopier } from './components/BatchIdCopier';
import { PackagesTable } from './components/PackagesTable';
import { ResumoView } from './components/ResumoView';
import { RoutesView } from './components/RoutesView';
import { OtherStatusView } from './components/OtherStatusView';
import { PrintSheet } from './components/PrintSheet';
import { UsageGuideModal } from './components/UsageGuideModal';
import { RouteValueReport } from './components/RouteValueReport';
import { Check, Copy, Database, Link2, Upload } from 'lucide-react';

const STORAGE_OVERRIDES_KEY = 'sortflow_manual_overrides_v1';
const STORAGE_COLUMNS_KEY = 'sortflow_visible_columns_v1';
const STORAGE_DATASET_KEY = 'sortflow_dataset_v1';

const DEFAULT_COLUMNS: ColumnKey[] = ALL_COLUMNS.map((c) => c.key);

const INITIAL_STATS: Record<FileSlotKey, FileParseStats> = {
  faltantes: { loaded: false, fileName: '', totalRows: 0, validRows: 0 },
  detalhesValor: { loaded: false, fileName: '', totalRows: 0, validRows: 0 },
  status: { loaded: false, fileName: '', totalRows: 0, validRows: 0 },
  detalhesNA: { loaded: false, fileName: '', totalRows: 0, validRows: 0 },
};

interface PersistedDataset {
  faltantes: RawFaltanteRecord[];
  detalhesValor: RawDetalheRecord[];
  statusRecords: RawStatusRecord[];
  detalhesNA: RawDetalheRecord[];
  fileStats: Record<FileSlotKey, FileParseStats>;
}

async function readFileTextSmart(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder('utf-8').decode(buffer);
  if (utf8Text.includes('\uFFFD')) {
    return new TextDecoder('windows-1252').decode(buffer);
  }
  return utf8Text;
}

function loadInitialOverrides(): ManualOverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_OVERRIDES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return {};
}

function loadInitialColumns(): ColumnKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_COLUMNS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((k): k is ColumnKey =>
          ALL_COLUMNS.some((c) => c.key === k)
        );
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_COLUMNS;
}

function loadInitialDataset(): PersistedDataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_DATASET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.faltantes)) {
        return parsed as PersistedDataset;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialShared = urlParams.get('mode') === 'shared';
  const shouldAutostart = urlParams.get('autostart') === '1';

  const savedDataset = useMemo(() => loadInitialDataset(), []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('principal');
  const [isSharedMode, setIsSharedMode] = useState<boolean>(initialShared);
  const [linkCopied, setLinkCopied] = useState(false);

  const [faltantes, setFaltantes] = useState<RawFaltanteRecord[]>(
    () => savedDataset?.faltantes ?? []
  );
  const [detalhesValor, setDetalhesValor] = useState<RawDetalheRecord[]>(
    () => savedDataset?.detalhesValor ?? []
  );
  const [statusRecords, setStatusRecords] = useState<RawStatusRecord[]>(
    () => savedDataset?.statusRecords ?? []
  );
  const [detalhesNA, setDetalhesNA] = useState<RawDetalheRecord[]>(
    () => savedDataset?.detalhesNA ?? []
  );
  const [fileStats, setFileStats] = useState<Record<FileSlotKey, FileParseStats>>(
    () => savedDataset?.fileStats ?? INITIAL_STATS
  );

  const [manualOverrides, setManualOverrides] = useState<ManualOverrideMap>(
    () => loadInitialOverrides()
  );
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(
    () => loadInitialColumns()
  );

  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRouteTabName, setSelectedRouteTabName] = useState<string | null>(null);

  const [manualIdInput, setManualIdInput] = useState<string>('');
  const [manualStatusInput, setManualStatusInput] = useState<string>('sorting');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'info' | 'error';
    text: string;
  } | null>(null);

  const [guideOpen, setGuideOpen] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('none');
  const [printRouteTarget, setPrintRouteTarget] = useState<string | null>(null);
  const [printGeneratedAt, setPrintGeneratedAt] = useState<string>('');
  const [processTick, setProcessTick] = useState(0);

  const [copiedBatchKeys, setCopiedBatchKeys] = useState<string[]>([]);
  const [activeBatchSessionKey, setActiveBatchSessionKey] = useState<string | null>(null);
  const [activeBatchLabel, setActiveBatchLabel] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [showOnlySelected, setShowOnlySelected] = useState<boolean>(false);
  const [selectionScopeIds, setSelectionScopeIds] = useState<string[]>([]);
  const [selectionTargetStatus, setSelectionTargetStatus] = useState<string>('problem_solving');

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [idSectionPulseKey, setIdSectionPulseKey] = useState<number>(0);
  const refreshTimerRef = useRef<number | null>(null);

  const triggerSmoothRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    setIsRefreshing(true);
    refreshTimerRef.current = window.setTimeout(() => {
      setIsRefreshing(false);
      refreshTimerRef.current = null;
    }, 260);
  }, []);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_OVERRIDES_KEY, JSON.stringify(manualOverrides));
    } catch {
      // Ignore quota issues
    }
  }, [manualOverrides]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COLUMNS_KEY, JSON.stringify(visibleColumns));
    } catch {
      // Ignore quota issues
    }
  }, [visibleColumns]);

  useEffect(() => {
    try {
      const payload: PersistedDataset = {
        faltantes,
        detalhesValor,
        statusRecords,
        detalhesNA,
        fileStats,
      };
      localStorage.setItem(STORAGE_DATASET_KEY, JSON.stringify(payload));
    } catch {
      // Keep working in memory
    }
  }, [faltantes, detalhesValor, statusRecords, detalhesNA, fileStats]);

  const handleLoadDemo = useCallback(() => {
    const demo = getDemoDatasetStrings();
    const f = parseFaltantesFile(demo.faltantesCsv, 'faltantes.csv');
    const dv = parseDetalhesFile(demo.detalhesValorJson, 'Detalhes_valor.json');
    const st = parseStatusFile(demo.statusJson, 'status.json');
    const na = parseDetalhesFile(demo.detalhesNaJson, 'detalhes_dos_NA.json');

    setFaltantes(f.records);
    setDetalhesValor(dv.records);
    setStatusRecords(st.records);
    setDetalhesNA(na.records);
    setFileStats({
      faltantes: f.stats,
      detalhesValor: dv.stats,
      status: st.stats,
      detalhesNA: na.stats,
    });
    setSelectedRouteFilter('ALL');
    setSearchQuery('');
    setSelectedRouteTabName(null);
    setCopiedBatchKeys([]);
    setActiveBatchSessionKey(null);
    setActiveBatchLabel(null);
    setSelectedRowIds([]);
    setManualIdInput('');
    setShowOnlySelected(false);
    setSelectionScopeIds([]);
    setIdSectionPulseKey((k) => k + 1);
    triggerSmoothRefresh();
    setFeedbackBanner({
      type: 'info',
      text: `Dados de exemplo processados: ${f.stats.validRows} pacotes válidos na estação.`,
    });
  }, [triggerSmoothRefresh]);

  useEffect(() => {
    if (shouldAutostart && !savedDataset?.faltantes?.length) {
      handleLoadDemo();
    }
  }, [shouldAutostart, savedDataset, handleLoadDemo]);

  const result = useMemo(() => {
    void processTick;
    return processLogisticsData({
      faltantes,
      faltantesTotalBruto: fileStats.faltantes.totalRows,
      detalhesValor,
      statusRecords,
      hasStatusFile: fileStats.status.loaded && !fileStats.status.error,
      detalhesNA,
      manualOverrides,
    });
  }, [
    faltantes,
    fileStats.faltantes.totalRows,
    fileStats.status.loaded,
    fileStats.status.error,
    detalhesValor,
    statusRecords,
    detalhesNA,
    manualOverrides,
    processTick,
  ]);

  const handleUploadFile = async (slot: FileSlotKey, file: File) => {
    try {
      const content = await readFileTextSmart(file);

      if (slot === 'faltantes') {
        const parsed = parseFaltantesFile(content, file.name);
        setFileStats((prev) => ({ ...prev, faltantes: parsed.stats }));
        if (parsed.stats.error) {
          setFeedbackBanner({ type: 'error', text: parsed.stats.error });
          return;
        }
        setFaltantes(parsed.records);
        setSelectedRouteFilter('ALL');
        setCopiedBatchKeys([]);
        setActiveBatchSessionKey(null);
        setActiveBatchLabel(null);
        setSelectedRowIds([]);
        setManualIdInput('');
        setShowOnlySelected(false);
        setSelectionScopeIds([]);
        setIdSectionPulseKey((k) => k + 1);
        triggerSmoothRefresh();
        setFeedbackBanner({
          type: 'info',
          text: `${file.name} carregado: ${parsed.stats.validRows} de ${parsed.stats.totalRows} linhas passaram no filtro (Inbound + Na estação).`,
        });
      } else if (slot === 'detalhesValor') {
        const parsed = parseDetalhesFile(content, file.name);
        setFileStats((prev) => ({ ...prev, detalhesValor: parsed.stats }));
        if (parsed.stats.error) {
          setFeedbackBanner({ type: 'error', text: parsed.stats.error });
          return;
        }
        setDetalhesValor(parsed.records);
        triggerSmoothRefresh();
        setFeedbackBanner({
          type: 'info',
          text: `${file.name} carregado com ${parsed.stats.validRows} registros de detalhes.`,
        });
      } else if (slot === 'status') {
        const parsed = parseStatusFile(content, file.name);
        setFileStats((prev) => ({ ...prev, status: parsed.stats }));
        if (parsed.stats.error) {
          setFeedbackBanner({ type: 'error', text: parsed.stats.error });
          return;
        }
        setStatusRecords(parsed.records);
        triggerSmoothRefresh();
        setFeedbackBanner({
          type: 'info',
          text: `${file.name} carregado com ${parsed.stats.validRows} registros de status.`,
        });
      } else if (slot === 'detalhesNA') {
        const parsed = parseDetalhesFile(content, file.name);
        setFileStats((prev) => ({ ...prev, detalhesNA: parsed.stats }));
        if (parsed.stats.error) {
          setFeedbackBanner({ type: 'error', text: parsed.stats.error });
          return;
        }
        setDetalhesNA(parsed.records);
        triggerSmoothRefresh();
        setFeedbackBanner({
          type: 'info',
          text: `${file.name} carregado com ${parsed.stats.validRows} detalhes complementares N/A.`,
        });
      }
    } catch {
      setFeedbackBanner({
        type: 'error',
        text: `Não foi possível ler o arquivo "${file.name}". Verifique se é um CSV ou JSON válido.`,
      });
    }
  };

  const handleClearFile = (slot: FileSlotKey) => {
    setFileStats((prev) => ({ ...prev, [slot]: { ...INITIAL_STATS[slot] } }));
    if (slot === 'faltantes') setFaltantes([]);
    if (slot === 'detalhesValor') setDetalhesValor([]);
    if (slot === 'status') setStatusRecords([]);
    if (slot === 'detalhesNA') setDetalhesNA([]);
    triggerSmoothRefresh();
  };

  const handleResetAll = () => {
    setFaltantes([]);
    setDetalhesValor([]);
    setStatusRecords([]);
    setDetalhesNA([]);
    setFileStats(INITIAL_STATS);
    setSelectedRouteFilter('ALL');
    setSearchQuery('');
    setSelectedRouteTabName(null);
    setCopiedBatchKeys([]);
    setActiveBatchSessionKey(null);
    setActiveBatchLabel(null);
    setSelectedRowIds([]);
    setManualIdInput('');
    setShowOnlySelected(false);
    setSelectionScopeIds([]);
    setIdSectionPulseKey((k) => k + 1);
    triggerSmoothRefresh();
    setFeedbackBanner({ type: 'info', text: 'Arquivos limpos. Pronto para novo upload.' });
  };

  const handleToggleColumn = (col: ColumnKey) => {
    triggerSmoothRefresh();
    setVisibleColumns((prev) => {
      if (prev.includes(col)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== col);
      }
      return ALL_COLUMNS.filter((c) => prev.includes(c.key) || c.key === col).map((c) => c.key);
    });
  };

  const normalizeStatusInput = (rawStatus: string) => {
    const cleanStatus = rawStatus.trim();
    const lower = cleanStatus.toLowerCase();
    return lower === 'sorting' || lower === 'problem_solving' || lower === 'pendente'
      ? lower
      : cleanStatus;
  };

  const handleSaveBatchManualOverride = (rawIds: string[], rawStatus: string) => {
    const cleanIds = Array.from(
      new Set(rawIds.map((id) => normalizeId(id)).filter(Boolean))
    );
    const normalizedStatus = normalizeStatusInput(rawStatus);
    if (cleanIds.length === 0 || !normalizedStatus) return;

    const timestamp = formatDateBR(new Date());
    setManualOverrides((prev) => {
      const next = { ...prev };
      for (const id of cleanIds) {
        next[id] = {
          status: normalizedStatus,
          updatedAt: timestamp,
        };
      }
      return next;
    });

    const updatedSet = new Set(cleanIds);
    const remainingIds = selectedRowIds.filter((id) => !updatedSet.has(id));
    setSelectedRowIds(remainingIds);
    setManualIdInput(remainingIds.join(','));
    setSelectionScopeIds((prev) => prev.filter((id) => !updatedSet.has(id)));
    setShowOnlySelected(false);
    setActiveBatchSessionKey(null);
    setActiveBatchLabel(null);
    setIdSectionPulseKey((k) => k + 1);
    triggerSmoothRefresh();
    setFeedbackBanner({
      type: 'info',
      text:
        cleanIds.length === 1
          ? `Status do pacote ${cleanIds[0]} atualizado manualmente para "${normalizedStatus}".`
          : `Status de ${cleanIds.length} pacotes atualizado manualmente para "${normalizedStatus}".`,
    });
  };

  const handleSaveManualOverride = (rawIdsInput: string, rawStatus: string) => {
    const parsedIds = parseBatchIdsInput(rawIdsInput);
    const normalizedStatus = normalizeStatusInput(rawStatus);
    if (parsedIds.length === 0 || !normalizedStatus) return;

    handleSaveBatchManualOverride(parsedIds, normalizedStatus);
    setManualIdInput('');
  };

  const handleRemoveManualOverride = (id: string) => {
    setManualOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    triggerSmoothRefresh();
    setFeedbackBanner({
      type: 'info',
      text: `Override manual removido para ${id}.`,
    });
  };

  const handleCopyBatch = async (
    batchKey: string,
    label: string,
    ids: string[],
    formattedText: string
  ) => {
    await copyTextToClipboard(formattedText);
    setCopiedBatchKeys((prev) => (prev.includes(batchKey) ? prev : [...prev, batchKey]));
    setActiveBatchSessionKey(batchKey);
    setActiveBatchLabel(label);
    setSelectedRowIds(ids);
    setManualIdInput(ids.join(','));
    setIdSectionPulseKey((k) => k + 1);
    if (showOnlySelected) {
      setSelectionScopeIds(ids);
    }
    triggerSmoothRefresh();
    setFeedbackBanner({
      type: 'info',
      text: `${ids.length} IDs copiados (${label}) e atualizados na seção de IDs. Desmarque os que não deseja alterar antes de atualizar.`,
    });
  };

  const handleToggleSelectId = (id: string) => {
    const nextIds = selectedRowIds.includes(id)
      ? selectedRowIds.filter((item) => item !== id)
      : [...selectedRowIds, id];
    setSelectedRowIds(nextIds);
    setManualIdInput(nextIds.join(','));
    setIdSectionPulseKey((k) => k + 1);
  };

  const handleToggleSelectAll = (tableIds: string[]) => {
    if (tableIds.length === 0) return;
    const prevSet = new Set(selectedRowIds);
    const allSelected = tableIds.every((id) => prevSet.has(id));
    let nextIds: string[];
    if (allSelected) {
      const removeSet = new Set(tableIds);
      nextIds = selectedRowIds.filter((id) => !removeSet.has(id));
    } else {
      nextIds = [...selectedRowIds];
      for (const id of tableIds) {
        if (!prevSet.has(id)) nextIds.push(id);
      }
    }
    setSelectedRowIds(nextIds);
    setManualIdInput(nextIds.join(','));
    setIdSectionPulseKey((k) => k + 1);
  };

  const handleClearSelection = () => {
    setSelectedRowIds([]);
    setManualIdInput('');
    setSelectionScopeIds([]);
    setShowOnlySelected(false);
    setActiveBatchSessionKey(null);
    setActiveBatchLabel(null);
    setIdSectionPulseKey((k) => k + 1);
  };

  const handleToggleShowOnlySelected = () => {
    triggerSmoothRefresh();
    setShowOnlySelected((prev) => {
      const next = !prev;
      if (next) {
        setSelectionScopeIds([...selectedRowIds]);
      } else {
        setSelectionScopeIds([]);
      }
      return next;
    });
  };

  const handleCopySelectedIds = async () => {
    if (selectedRowIds.length === 0) return;
    const text = formatIdsForClipboard(selectedRowIds, false);
    await copyTextToClipboard(text);
    setIdSectionPulseKey((k) => k + 1);
    setFeedbackBanner({
      type: 'info',
      text: `${selectedRowIds.length} IDs marcados copiados para a área de transferência.`,
    });
  };

  const handleQuickOverride = (id: string, currentStatus: string) => {
    setManualIdInput(id);
    setManualStatusInput(currentStatus === 'sorting' ? 'problem_solving' : 'sorting');
    const el = document.getElementById('manual-override-status');
    el?.focus();
  };

  const handleToggleSharedMode = () => {
    const next = !isSharedMode;
    setIsSharedMode(next);
    if (next) setActiveTab('principal');
    const url = new URL(window.location.href);
    if (next) {
      url.searchParams.set('mode', 'shared');
    } else {
      url.searchParams.delete('mode');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const handleCopyShareLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'shared');
    try {
      await navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setLinkCopied(false);
    }
  };

  const triggerPrint = (mode: PrintMode, routeName: string | null = null) => {
    setPrintGeneratedAt(formatDateBR(new Date()));
    setPrintRouteTarget(routeName);
    setPrintMode(mode);
  };

  useEffect(() => {
    if (printMode === 'none') return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 80);

    const onAfterPrint = () => {
      setPrintMode('none');
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printMode]);

  const routeNames = useMemo(
    () => result.routeGroups.map((g) => g.rota),
    [result.routeGroups]
  );

  const filteredPrincipalPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return result.sortingPackages.filter((pkg) => {
      if (
        selectedRouteFilter !== 'ALL' &&
        pkg.rotaGrupo !== selectedRouteFilter &&
        pkg.rota !== selectedRouteFilter
      ) {
        return false;
      }
      if (q) {
        const matchId = pkg.id.toLowerCase().includes(q);
        const matchDesc = (pkg.descricao ?? '').toLowerCase().includes(q);
        const matchRota = pkg.rota.toLowerCase().includes(q);
        const matchGrupo = pkg.rotaGrupo.toLowerCase().includes(q);
        if (!matchId && !matchDesc && !matchRota && !matchGrupo) return false;
      }
      return true;
    });
  }, [result.sortingPackages, selectedRouteFilter, searchQuery]);

  const displayedPrincipalPackages = useMemo(() => {
    if (!isSharedMode && showOnlySelected && selectionScopeIds.length > 0) {
      const scopeSet = new Set(selectionScopeIds);
      return filteredPrincipalPackages.filter((pkg) => scopeSet.has(pkg.id));
    }
    return filteredPrincipalPackages;
  }, [isSharedMode, showOnlySelected, selectionScopeIds, filteredPrincipalPackages]);

  const filteredPrincipalValue = useMemo(
    () => filteredPrincipalPackages.reduce((acc, p) => acc + (p.valor ?? 0), 0),
    [filteredPrincipalPackages]
  );

  const hasData = faltantes.length > 0;
  const activePrintRouteGroup = useMemo(() => {
    if (!printRouteTarget) return result.routeGroups[0] ?? null;
    return result.routeGroups.find((g) => g.rota === printRouteTarget) ?? null;
  }, [printRouteTarget, result.routeGroups]);

  const handleChangeTab = (tab: ActiveTab) => {
    if (tab !== activeTab) {
      triggerSmoothRefresh();
    }
    setActiveTab(tab);
  };

  const handleChangeRouteFilter = (route: string) => {
    if (route !== selectedRouteFilter) {
      triggerSmoothRefresh();
    }
    setSelectedRouteFilter(route);
  };

  const handleSelectRouteTab = (route: string) => {
    if (route !== selectedRouteTabName) {
      triggerSmoothRefresh();
    }
    setSelectedRouteTabName(route);
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {isRefreshing && (
        <div
          data-testid="refresh-progress-bar"
          aria-hidden="true"
          className="no-print fixed top-0 left-0 right-0 z-50 h-0.5 bg-indigo-100 overflow-hidden pointer-events-none"
        >
          <div className="h-full w-1/3 bg-indigo-600 animate-sortflow-progress" />
        </div>
      )}

      <Header
        activeTab={activeTab}
        onChangeTab={handleChangeTab}
        isSharedMode={isSharedMode}
        onToggleSharedMode={handleToggleSharedMode}
        counts={{
          sorting: result.summary.totalSorting,
          rotas: result.summary.totalRotasAtivas,
          outros: result.summary.totalOutrosStatus,
        }}
      />

      <main className="no-print flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {isSharedMode && (
          <div className="mb-4 bg-white border border-slate-200 rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-base font-bold text-slate-900">
                Painel Principal de Pacotes
              </h1>
              <p className="text-xs text-slate-500">
                Visualização compartilhável somente leitura · Ordenado por Data (mais antiga) e Rota
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100"
            >
              {linkCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Link copiado</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copiar link desta tela</span>
                </>
              )}
            </button>
          </div>
        )}

        {feedbackBanner && !isSharedMode && (
          <div
            role={feedbackBanner.type === 'error' ? 'alert' : 'status'}
            className={`mb-4 px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-4 ${
              feedbackBanner.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <span>{feedbackBanner.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
            >
              Fechar
            </button>
          </div>
        )}

        <div className="flex flex-col xl:flex-row gap-6 items-start">
          {!isSharedMode && (
            <IngestionSidebar
              fileStats={fileStats}
              summary={result.summary}
              onUploadFile={handleUploadFile}
              onClearFile={handleClearFile}
              onReprocess={() => {
                setProcessTick((t) => t + 1);
                triggerSmoothRefresh();
                setFeedbackBanner({
                  type: 'info',
                  text: `Reprocessamento concluído: ${result.summary.totalSorting} pacotes exibidos na tela Principal.`,
                });
              }}
              onLoadDemo={handleLoadDemo}
              onResetAll={handleResetAll}
              onOpenGuide={() => setGuideOpen(true)}
              statusIdList={result.statusIdList}
              statusIdString={result.statusIdString}
              naIdList={result.naIdList}
              naIdString={result.naIdString}
              manualOverrides={manualOverrides}
              knownIds={result.statusIdList}
              manualIdInput={manualIdInput}
              onChangeManualIdInput={setManualIdInput}
              manualStatusInput={manualStatusInput}
              onChangeManualStatusInput={setManualStatusInput}
              onSaveManualOverride={handleSaveManualOverride}
              onRemoveManualOverride={handleRemoveManualOverride}
              onClearAllOverrides={() => {
                setManualOverrides({});
                triggerSmoothRefresh();
                setFeedbackBanner({ type: 'info', text: 'Todos os overrides manuais foram removidos.' });
              }}
              selectedIds={selectedRowIds}
              activeBatchLabel={activeBatchLabel}
              idSectionPulseKey={idSectionPulseKey}
              isRefreshing={isRefreshing}
            />
          )}

          <div
            className={`flex-1 min-w-0 w-full space-y-5 transition-all duration-200 ease-out ${
              isRefreshing ? 'opacity-75 translate-y-[2px]' : 'opacity-100 translate-y-0'
            }`}
          >
            {!hasData ? (
              <section className="bg-white border border-slate-200 rounded-lg px-8 py-14 text-center max-w-2xl mx-auto">
                <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-5 h-5" aria-hidden="true" />
                </div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  Controle Logístico de Pacotes em Sorting
                </h1>
                <p className="mt-2 text-sm text-slate-600 max-w-lg mx-auto">
                  Envie o arquivo <strong className="text-slate-900">faltantes.csv</strong> na barra lateral (e opcionalmente <strong className="text-slate-900">Detalhes_valor</strong>, <strong className="text-slate-900">status</strong> e <strong className="text-slate-900">detalhes_dos_NA</strong>) para filtrar automaticamente pacotes na estação, gerar listas para BigQuery e imprimir rotas.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleLoadDemo}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    <Database className="w-4 h-4" aria-hidden="true" />
                    <span>Carregar Dados de Exemplo</span>
                  </button>
                  {!isSharedMode && (
                    <button
                      type="button"
                      onClick={() => setGuideOpen(true)}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Ver Regras e Colunas Aceitas
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <>
                <KpiStrip
                  summary={result.summary}
                  filteredCount={filteredPrincipalPackages.length}
                  filteredValue={filteredPrincipalValue}
                  hasActiveRouteOrSearchFilter={
                    (activeTab === 'principal' || isSharedMode) &&
                    (selectedRouteFilter !== 'ALL' || searchQuery.trim() !== '')
                  }
                />

                <RouteValueReport
                  routeGroups={result.routeGroups}
                  summary={result.summary}
                  selectedRouteFilter={
                    activeTab === 'principal' || isSharedMode ? selectedRouteFilter : 'ALL'
                  }
                  onSelectRoute={
                    activeTab === 'principal' || isSharedMode
                      ? handleChangeRouteFilter
                      : undefined
                  }
                  onCopiedReport={(message) =>
                    setFeedbackBanner({ type: 'info', text: message })
                  }
                />

                {(isSharedMode || activeTab === 'principal') && (
                  <div className="space-y-3">
                    <TableToolbar
                      visibleColumns={visibleColumns}
                      onToggleColumn={handleToggleColumn}
                      routeOptions={routeNames}
                      selectedRoute={selectedRouteFilter}
                      onChangeRoute={handleChangeRouteFilter}
                      searchQuery={searchQuery}
                      onChangeSearch={setSearchQuery}
                      onExportCsv={() =>
                        exportPackagesToCSV(
                          filteredPrincipalPackages,
                          visibleColumns,
                          'sorting_principal.csv'
                        )
                      }
                      onExportExcel={() =>
                        exportPackagesToExcel(
                          filteredPrincipalPackages,
                          visibleColumns,
                          'Sorting_Principal',
                          'sorting_principal.xlsx'
                        )
                      }
                      onPrintCurrentRoute={() =>
                        triggerPrint('current-route', selectedRouteFilter)
                      }
                      disableRoutePrint={selectedRouteFilter === 'ALL'}
                      onPrintAllRoutes={
                        result.routeGroups.length > 0
                          ? () => triggerPrint('all-routes-principal')
                          : undefined
                      }
                      printAllLabel="Imprimir todas as rotas"
                    />

                    {!isSharedMode && (
                      <BatchIdCopier
                        packages={filteredPrincipalPackages}
                        defaultBatchSize={5}
                        title="Lotes de IDs"
                        selectedRouteFilter={selectedRouteFilter}
                        copiedBatchKeys={copiedBatchKeys}
                        activeBatchSessionKey={activeBatchSessionKey}
                        onCopyBatch={handleCopyBatch}
                      />
                    )}

                    {!isSharedMode && (selectedRowIds.length > 0 || showOnlySelected) && (
                      <div
                        data-testid="selection-action-bar"
                        className="no-print bg-indigo-50/70 border border-indigo-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div
                          key={`sel-badge-${idSectionPulseKey}`}
                          className="flex flex-wrap items-center gap-2 min-w-0 rounded px-1 -mx-1 animate-sortflow-flash"
                        >
                          <span className="text-xs font-semibold text-indigo-950 tabular-nums shrink-0">
                            {selectedRowIds.length}{' '}
                            {selectedRowIds.length === 1 ? 'selecionado' : 'selecionados'}
                          </span>
                          {activeBatchLabel && (
                            <span className="text-xs text-indigo-800 truncate">
                              · {activeBatchLabel}
                            </span>
                          )}
                          {selectedRowIds.length > 0 && (
                            <span className="font-mono text-[11px] text-indigo-700 bg-white/80 border border-indigo-200/80 rounded px-1.5 py-0.5 truncate max-w-[260px]">
                              {selectedRowIds.join(',')}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleToggleShowOnlySelected}
                            aria-pressed={showOnlySelected}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors whitespace-nowrap ${
                              showOnlySelected
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {showOnlySelected ? 'Mostrando só lote' : 'Ver só selecionados'}
                          </button>

                          <button
                            type="button"
                            disabled={selectedRowIds.length === 0}
                            onClick={handleCopySelectedIds}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 rounded hover:bg-indigo-100/70 disabled:opacity-45"
                          >
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Copiar {selectedRowIds.length} IDs</span>
                          </button>

                          <label htmlFor="selection-target-status" className="text-xs font-medium text-slate-700">
                            Alterar para:
                          </label>
                          <input
                            id="selection-target-status"
                            list="common-status-options"
                            type="text"
                            value={selectionTargetStatus}
                            onChange={(e) => setSelectionTargetStatus(e.target.value)}
                            className="w-36 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                          <button
                            type="button"
                            disabled={selectedRowIds.length === 0 || !selectionTargetStatus.trim()}
                            onClick={() => {
                              if (selectionTargetStatus.trim() && selectedRowIds.length > 0) {
                                handleSaveBatchManualOverride(selectedRowIds, selectionTargetStatus);
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-45 whitespace-nowrap"
                          >
                            Atualizar {selectedRowIds.length}{' '}
                            {selectedRowIds.length === 1 ? 'pacote' : 'pacotes'}
                          </button>
                          <button
                            type="button"
                            onClick={handleClearSelection}
                            className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>
                    )}

                    <PackagesTable
                      packages={displayedPrincipalPackages}
                      visibleColumns={visibleColumns}
                      emptyTitle="Nenhum pacote encontrado para os filtros atuais"
                      emptyDescription="Verifique a aba 'Outros Status' ou ajuste a busca/filtro de rota."
                      allowInlineActions={!isSharedMode}
                      onQuickOverride={handleQuickOverride}
                      onRemoveOverride={handleRemoveManualOverride}
                      selectedIds={isSharedMode ? undefined : selectedRowIds}
                      onToggleSelectId={isSharedMode ? undefined : handleToggleSelectId}
                      onToggleSelectAll={isSharedMode ? undefined : handleToggleSelectAll}
                    />
                  </div>
                )}

                {!isSharedMode && activeTab === 'resumo' && (
                  <div className="space-y-4">
                    {selectedRowIds.length > 0 && (
                      <div
                        data-testid="selection-action-bar"
                        className="no-print bg-indigo-50/70 border border-indigo-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div
                          key={`sel-resumo-badge-${idSectionPulseKey}`}
                          className="flex flex-wrap items-center gap-2 min-w-0 rounded px-1 -mx-1 animate-sortflow-flash"
                        >
                          <span className="text-xs font-semibold text-indigo-950 tabular-nums shrink-0">
                            {selectedRowIds.length}{' '}
                            {selectedRowIds.length === 1 ? 'selecionado' : 'selecionados'}
                          </span>
                          {activeBatchLabel && (
                            <span className="text-xs text-indigo-800 truncate">
                              · {activeBatchLabel}
                            </span>
                          )}
                          {selectedRowIds.length > 0 && (
                            <span className="font-mono text-[11px] text-indigo-700 bg-white/80 border border-indigo-200/80 rounded px-1.5 py-0.5 truncate max-w-[260px]">
                              {selectedRowIds.join(',')}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopySelectedIds}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 rounded hover:bg-indigo-100/70"
                          >
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Copiar {selectedRowIds.length} IDs</span>
                          </button>

                          <label htmlFor="selection-target-status-resumo" className="text-xs font-medium text-slate-700">
                            Alterar para:
                          </label>
                          <input
                            id="selection-target-status-resumo"
                            list="common-status-options"
                            type="text"
                            value={selectionTargetStatus}
                            onChange={(e) => setSelectionTargetStatus(e.target.value)}
                            className="w-36 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                          <button
                            type="button"
                            disabled={!selectionTargetStatus.trim()}
                            onClick={() => {
                              if (selectionTargetStatus.trim()) {
                                handleSaveBatchManualOverride(selectedRowIds, selectionTargetStatus);
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 whitespace-nowrap"
                          >
                            Atualizar {selectedRowIds.length}{' '}
                            {selectedRowIds.length === 1 ? 'pacote' : 'pacotes'}
                          </button>
                          <button
                            type="button"
                            onClick={handleClearSelection}
                            className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>
                    )}

                    <ResumoView
                      resumoGroups={result.resumoGroups}
                      visibleColumns={visibleColumns}
                      onToggleColumn={handleToggleColumn}
                      onExportCsv={() =>
                        exportResumoToCSV(
                          result.resumoGroups,
                          visibleColumns,
                          'sorting_resumo_top7.csv'
                        )
                      }
                      onExportExcel={() =>
                        exportResumoToExcel(
                          result.resumoGroups,
                          visibleColumns,
                          'sorting_resumo_top7.xlsx'
                        )
                      }
                      onPrintAllResumo={() => triggerPrint('all-routes-resumo')}
                      onQuickOverride={handleQuickOverride}
                      onRemoveOverride={handleRemoveManualOverride}
                      copiedBatchKeys={copiedBatchKeys}
                      activeBatchSessionKey={activeBatchSessionKey}
                      onCopyBatch={handleCopyBatch}
                      selectedIds={selectedRowIds}
                      onToggleSelectId={handleToggleSelectId}
                      onToggleSelectAll={handleToggleSelectAll}
                    />
                  </div>
                )}

                {!isSharedMode && activeTab === 'rotas' && (
                  <RoutesView
                    routeGroups={result.routeGroups}
                    selectedRouteName={selectedRouteTabName}
                    onSelectRoute={handleSelectRouteTab}
                    visibleColumns={visibleColumns}
                    onToggleColumn={handleToggleColumn}
                    onPrintCurrentRoute={(rota) => triggerPrint('current-route', rota)}
                    onPrintAllRoutes={() => triggerPrint('all-routes-principal')}
                    onQuickOverride={handleQuickOverride}
                    onRemoveOverride={handleRemoveManualOverride}
                  />
                )}

                {!isSharedMode && activeTab === 'outros' && (
                  <OtherStatusView
                    packages={result.otherStatusPackages}
                    visibleColumns={visibleColumns}
                    onToggleColumn={handleToggleColumn}
                    onQuickOverride={handleQuickOverride}
                    onRemoveOverride={handleRemoveManualOverride}
                    onMoveToSorting={(id) => handleSaveManualOverride(id, 'sorting')}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <PrintSheet
        printMode={printMode}
        generatedAt={printGeneratedAt}
        visibleColumns={visibleColumns}
        currentRouteGroup={activePrintRouteGroup}
        allRouteGroups={result.routeGroups}
        resumoGroups={result.resumoGroups}
      />

      <UsageGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
