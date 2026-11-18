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
import {
  buildIdBatches,
  copyTextToClipboard,
  getAllTopNIdsFromGroups,
  getTopNIds,
} from './utils/idChunker';
import { getDemoDatasetStrings } from './data/demoData';
import { Header } from './components/Header';
import { FileSlotKey, IngestionSidebar } from './components/IngestionSidebar';
import { KpiStrip } from './components/KpiStrip';
import { TableToolbar } from './components/TableToolbar';
import { PackagesTable } from './components/PackagesTable';
import { ResumoView } from './components/ResumoView';
import { RoutesView } from './components/RoutesView';
import { OtherStatusView } from './components/OtherStatusView';
import { PrintSheet } from './components/PrintSheet';
import { UsageGuideModal } from './components/UsageGuideModal';
import { CopyIdsModal } from './components/CopyIdsModal';
import { Check, Database, Link2, Upload } from 'lucide-react';

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

  const [copyIdsModalOpen, setCopyIdsModalOpen] = useState(false);
  const [copyIdsModalInitialTab, setCopyIdsModalInitialTab] = useState<'batches' | 'top7' | 'current'>('batches');
  const [copiedBatchLabel, setCopiedBatchLabel] = useState<string | null>(null);

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
    setFeedbackBanner({
      type: 'info',
      text: `Dados de exemplo processados: ${f.stats.validRows} pacotes válidos na estação.`,
    });
  }, []);

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
    setFeedbackBanner({ type: 'info', text: 'Arquivos limpos. Pronto para novo upload.' });
  };

  const handleToggleColumn = (col: ColumnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(col)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== col);
      }
      return ALL_COLUMNS.filter((c) => prev.includes(c.key) || c.key === col).map((c) => c.key);
    });
  };

  const handleSaveManualOverride = (rawId: string, rawStatus: string) => {
    const cleanId = normalizeId(rawId);
    const cleanStatus = rawStatus.trim();
    if (!cleanId || !cleanStatus) return;

    const lower = cleanStatus.toLowerCase();
    const normalizedStatus =
      lower === 'sorting' || lower === 'problem_solving' || lower === 'pendente'
        ? lower
        : cleanStatus;

    setManualOverrides((prev) => ({
      ...prev,
      [cleanId]: {
        status: normalizedStatus,
        updatedAt: formatDateBR(new Date()),
      },
    }));
    setManualIdInput('');
    setFeedbackBanner({
      type: 'info',
      text: `Status do pacote ${cleanId} atualizado manualmente para "${normalizedStatus}".`,
    });
  };

  const handleRemoveManualOverride = (id: string) => {
    setManualOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setFeedbackBanner({
      type: 'info',
      text: `Override manual removido para ${id}.`,
    });
  };

  const handleCopyBatch = async (ids: string[], label: string) => {
    await copyTextToClipboard(ids.join(','));
    setCopiedBatchLabel(label);
    setTimeout(() => setCopiedBatchLabel(null), 2000);
  };

  const handleCopyTop7Route = async () => {
    if (!activeRouteTop7.ids.length) return;
    await copyTextToClipboard(activeRouteTop7.idString);
    setCopiedBatchLabel('top7');
    setTimeout(() => setCopiedBatchLabel(null), 2000);
  };

  const handleCopyAllFiltered = async () => {
    const ids = filteredPrincipalPackages.map((p) => p.id).join(',');
    await copyTextToClipboard(ids);
    setCopiedBatchLabel('all-filtered');
    setTimeout(() => setCopiedBatchLabel(null), 2000);
  };

  const handleCopyTop7All = async () => {
    const all = getAllTopNIdsFromGroups(result.routeGroups, 7);
    await copyTextToClipboard(all.idString);
  };

  const handleOpenCopyModal = (tab: 'batches' | 'top7' | 'current' = 'batches') => {
    setCopyIdsModalInitialTab(tab);
    setCopyIdsModalOpen(true);
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

  const filteredPrincipalValue = useMemo(
    () => filteredPrincipalPackages.reduce((acc, p) => acc + (p.valor ?? 0), 0),
    [filteredPrincipalPackages]
  );

  const activeRouteGroup = useMemo(() => {
    if (selectedRouteFilter === 'ALL') return null;
    return result.routeGroups.find((g) => g.rota === selectedRouteFilter) ?? null;
  }, [selectedRouteFilter, result.routeGroups]);

  const activeRouteBatches = useMemo(() => {
    if (!activeRouteGroup) return [];
    return buildIdBatches(activeRouteGroup.packages, 5);
  }, [activeRouteGroup]);

  const activeRouteTop7 = useMemo(() => {
    if (!activeRouteGroup) return { count: 0, ids: [], idString: '' };
    return getTopNIds(activeRouteGroup.packages, 7);
  }, [activeRouteGroup]);

  const hasData = faltantes.length > 0;
  const activePrintRouteGroup = useMemo(() => {
    if (!printRouteTarget) return result.routeGroups[0] ?? null;
    return result.routeGroups.find((g) => g.rota === printRouteTarget) ?? null;
  }, [printRouteTarget, result.routeGroups]);

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeTab={activeTab}
        onChangeTab={setActiveTab}
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
                setFeedbackBanner({ type: 'info', text: 'Todos os overrides manuais foram removidos.' });
              }}
            />
          )}

          <div className="flex-1 min-w-0 w-full space-y-5">
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

                {(isSharedMode || activeTab === 'principal') && (
                  <div className="space-y-4">
                    <TableToolbar
                      visibleColumns={visibleColumns}
                      onToggleColumn={handleToggleColumn}
                      routeOptions={routeNames}
                      selectedRoute={selectedRouteFilter}
                      onChangeRoute={setSelectedRouteFilter}
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
                      onPrintCurrentRoute={
                        selectedRouteFilter !== 'ALL'
                          ? () => triggerPrint('current-route', selectedRouteFilter)
                          : undefined
                      }
                      onPrintAllRoutes={
                        result.routeGroups.length > 0
                          ? () => triggerPrint('all-routes-principal')
                          : undefined
                      }
                      printAllLabel="Imprimir todas as rotas"
                      onOpenCopyModal={handleOpenCopyModal}
                      activeRouteBatches={activeRouteBatches}
                      activeRouteTop7Count={activeRouteTop7.count}
                      activeRouteTotalCount={activeRouteGroup?.packages.length}
                      onCopyBatch={handleCopyBatch}
                      onCopyTop7={handleCopyTop7Route}
                      onCopyAllFiltered={handleCopyAllFiltered}
                      copiedBatchLabel={copiedBatchLabel}
                      onCopyTop7All={handleCopyTop7All}
                    />

                    <PackagesTable
                      packages={filteredPrincipalPackages}
                      visibleColumns={visibleColumns}
                      emptyTitle="Nenhum pacote encontrado para os filtros atuais"
                      emptyDescription="Verifique a aba 'Outros Status' ou ajuste a busca/filtro de rota."
                      allowInlineActions={!isSharedMode}
                      onQuickOverride={handleQuickOverride}
                      onRemoveOverride={handleRemoveManualOverride}
                    />
                  </div>
                )}

                {!isSharedMode && activeTab === 'resumo' && (
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
                    onCopyTop7All={handleCopyTop7All}
                  />
                )}

                {!isSharedMode && activeTab === 'rotas' && (
                  <RoutesView
                    routeGroups={result.routeGroups}
                    selectedRouteName={selectedRouteTabName}
                    onSelectRoute={setSelectedRouteTabName}
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

      <CopyIdsModal
        open={copyIdsModalOpen}
        onClose={() => setCopyIdsModalOpen(false)}
        routeGroups={result.routeGroups}
        currentFilteredPackages={filteredPrincipalPackages}
        initialTab={copyIdsModalInitialTab}
        selectedRouteFilter={selectedRouteFilter}
      />

      <UsageGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
