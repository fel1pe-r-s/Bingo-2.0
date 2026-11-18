import { ActiveTab } from '../types/logistics';
import { Eye, EyeOff } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  isSharedMode: boolean;
  onToggleSharedMode: () => void;
  counts: {
    sorting: number;
    rotas: number;
    outros: number;
  };
}

export function Header({
  activeTab,
  onChangeTab,
  isSharedMode,
  onToggleSharedMode,
  counts,
}: HeaderProps) {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'principal', label: `Principal (${counts.sorting})` },
    { id: 'resumo', label: 'Resumo (Top 7)' },
    { id: 'rotas', label: `Por Rota (${counts.rotas})` },
    { id: 'outros', label: `Outros Status (${counts.outros})` },
  ];

  return (
    <header className="no-print md:sticky md:top-0 z-30 bg-white border-b border-slate-200">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onChangeTab('principal');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
        >
          SortFlow
        </a>

        {!isSharedMode ? (
          <nav aria-label="Telas da aplicação" className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-sm ${
                    isActive
                      ? 'text-indigo-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <nav aria-label="Modo compartilhável" className="hidden sm:flex items-center gap-4 text-sm text-slate-600">
            <span className="font-medium text-slate-900 whitespace-nowrap shrink-0">
              Visualização Compartilhável · Pacotes em Sorting
            </span>
          </nav>
        )}

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleSharedMode}
            className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              isSharedMode
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isSharedMode ? (
              <>
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Voltar ao Workspace</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tela Compartilhável</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!isSharedMode && (
        <nav
          aria-label="Navegação mobile"
          className="md:hidden flex items-center gap-5 px-4 border-t border-slate-100 overflow-x-auto"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                  isActive ? 'text-indigo-600' : 'text-slate-600'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                  />
                )}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
