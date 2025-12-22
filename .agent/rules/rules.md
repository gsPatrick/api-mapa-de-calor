---
trigger: always_on
---

# Regras de Desenvolvimento - Mapa Eleitoral RJ

## 1. Processamento de Dados (CRÍTICO)
- NUNCA use `fs.readFileSync` em arquivos CSV. Use sempre `fs.createReadStream` com `csv-parser`.
- O encoding dos arquivos do TSE é `ISO-8859-1`. Use a lib `iconv-lite` para converter para `utf-8` durante o stream.
- Agregação: Os votos devem ser somados por escola (local de votação) antes da inserção final. O objetivo é reduzir milhões de linhas de seções em milhares de linhas de locais.

## 2. Arquitetura Backend (Node.js)
- Padrão de pastas: `src/config`, `src/models`, `src/features`, `src/routes`.
- Dentro de `src/features/[nome]`, use os sufixos: `.service.js` (lógica de banco), `.controller.js` (req/res), `.routes.js` (definição de rotas).
- Use `express` para o servidor.
- Use `pg` (node-postgres) para conexão com o banco.

## 3. Banco de Dados (PostgreSQL)
- Use tipos de dados apropriados: `INTEGER` para votos, `DECIMAL(9,6)` para latitude/longitude.
- Crie índices B-TREE nas colunas de busca frequente: `candidato_numero`, `cargo`, `partido`.
- Desnormalize o necessário: Salve o nome do candidato e partido junto com a soma de votos para evitar JOINs pesados no carregamento do mapa.

## 4. Cache
- Não utilize Redis.
- Implemente um Cache Singleton em memória para os endpoints de `/filtros` (lista de candidatos e cargos).
- O cache deve ser invalidado apenas se houver nova importação de dados.

## 5. Qualidade de Código
- Use JavaScript moderno (ES6+).
- Tratamento de erro global em todas as rotas.
- Logs informativos no console durante o processo de importação de dados para acompanhar o progresso (ex: "Processadas 100.000 linhas...").