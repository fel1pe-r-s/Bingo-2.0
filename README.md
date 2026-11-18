# SortFlow — Controle Logístico de Pacotes em Sorting

Aplicação web offline (React + TypeScript + Vite) para substituir planilhas manuais no controle de pacotes em **sorting**, integrando exportações do BigQuery diretamente no navegador sem depender de APIs externas.

## Como rodar localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse `http://localhost:3000`.
3. Para gerar o build de produção:
   ```bash
   npm run build
   ```
4. Para rodar os testes unitários da lógica de processamento:
   ```bash
   npx --yes tsx --test src/utils/processor.test.ts
   ```

## Fluxo de uso

1. **Upload de `faltantes.csv`**: Detecta automaticamente colunas por nome aproximado (`ID do pacote`, `N.º Rota`, `Data de Inbound`, `Localização do pacote`) e filtra apenas registros com Data preenchida e Localização `"Na estação"` (ignorando acentos e maiúsculas/minúsculas). Se o arquivo `status` não for carregado, os pacotes elegíveis são exibidos com o status padrão **`pendente`**.
2. **Listas de IDs para BigQuery**: Copie a lista de IDs filtrados para consultar `status` e `Detalhes_valor` no BigQuery (`IN (...)`) e faça upload de `Detalhes_valor.json/.csv` e `status.json/.csv`.
3. **Complemento N/A**: Copie a lista de IDs sem descrição/valor para consultar o complemento e suba `detalhes_dos_NA.json/.csv`.
4. **Abas e Regras**:
   - **Principal**: Quando `status` está carregado, mostra apenas pacotes com status final `sorting`; sem o arquivo `status`, mostra pacotes elegíveis com status padrão `pendente`, ordenados por Data (mais antiga primeiro) e Rota.
   - **Resumo (Top 7)**: Primeiros 7 pacotes por Rota, agrupados visualmente.
   - **Por Rota**: Lista todas as rotas e exibe todos os pacotes da rota selecionada com impressão individual ou em páginas separadas.
   - **Outros Status**: Separa pacotes com status diferente da fila principal (`problem_solving`, `delivered`, `on_route`, `returned`, etc.).
   - **Status Manual**: Overrides manuais sempre vencem o status dos arquivos e ficam salvos na sessão local.
   - **Tela Compartilhável**: Abre uma visualização limpa somente-leitura da tela Principal (`?mode=shared`).
