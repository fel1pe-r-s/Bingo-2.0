import { X } from 'lucide-react';

interface UsageGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function UsageGuideModal({ open, onClose }: UsageGuideModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 id="guide-modal-title" className="font-display text-lg font-bold text-slate-900">
              Guia Rápido do Fluxo BigQuery Offline
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Todo o processamento acontece localmente no navegador após o upload dos arquivos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar guia"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <ol className="space-y-4 text-sm text-slate-700 list-decimal list-inside">
          <li>
            <span className="font-semibold text-slate-900">faltantes.csv</span>: Colunas detectadas automaticamente por nome aproximado (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">ID do pacote</code>, <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">N.º Rota</code>, <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">Data de Inbound</code>, <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">Localização do pacote</code>). Mantém apenas linhas com Data preenchida e Localização igual a &ldquo;Na estação&rdquo;.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Listas BigQuery</span>: Após carregar faltantes, copie a <strong>Lista de IDs para Status</strong> para colar no filtro <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">IN (...)</code> do BigQuery e exportar <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">status.json</code> e <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">Detalhes_valor.json</code>. Caso o arquivo <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">status</code> ainda não seja carregado, os pacotes elegíveis aparecem com status padrão <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">pendente</code>.
          </li>
          <li>
            <span className="font-semibold text-slate-900">detalhes_dos_NA.json</span>: Use a <strong>Lista de IDs N/A</strong> para buscar no BigQuery apenas os pacotes sem descrição ou valor e faça o upload complementar.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Regra de Status e Override Manual</span>: Quando o arquivo <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">status</code> está carregado, se <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">SUB_STATUS</code> for <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">sorting</code> ou <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">problem_solving</code>, ele prevalece; caso contrário usa <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">STATUS_SHP</code>. Overrides manuais sempre vencem os arquivos e ficam salvos na sessão local.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Agrupamento Inteligente por Rota</span>: Códigos como <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">A5_am1</code>, <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">&gt;A5_am1</code>, <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">A3</code>, <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">&gt;A3</code> e <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">&gt;A</code> são agrupados sob a mesma rota base (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">Rota A</code>), mantendo o código específico em cada linha. Na aba Resumo são exibidos os primeiros 7 pacotes de cada rota base (ordenados por data de inbound mais antiga).
          </li>
        </ol>

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
