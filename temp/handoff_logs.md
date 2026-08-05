# Handoff logs

## 2026-08-05 — Peer review do Desafio 2

- Revisados CAP, Fiori Elements, dados, metadados, dependências e especificação anexada.
- Executados compile CSN/EDMX, deploy SQLite, runtime HTTP, manifest validation e UI5 linter.
- Confirmados oito findings e mapeados os pontos ainda pendentes.
- Artefatos salvos em `temp/peer-reviews/PROJETO-DESAFIO2/`.

## 2026-08-05 — Testes automatizados dos fluxos CAP

- Adicionadas dependências e scripts de teste seguindo a abordagem do projeto `onlinelinux003`.
- Criados sete testes unitários dos helpers e 27 testes HTTP dos fluxos do `PlanejamentoService`.
- A suíte unitária passou integralmente.
- A suíte HTTP confirmou 18 cenários e falhou em nove testes ligados a oito regressões conhecidas.
- As falhas foram registradas em F001 a F006, F009 e F010.
- F009 registra a ausência de validação no patch do draft.
- F010 registra o bloqueio da ativação de draft novo pelo escopo de leitura.
- Testes usam SQLite em memória; nenhum commit foi criado.

## 2026-08-05 — Formatação da especificação

- Organizado `docs/especificacao` como Markdown estruturado.
- Adicionados títulos, listas, checklists, links e blocos de código tipados.
- Preservadas todas as informações do documento original.
- Ajustada apenas a apresentação dos exemplos JSON e HTTP.

## 2026-08-05 — Integração com HANA Cloud/HDI

- Criado o serviço HDI `pedro-ordens-001` no espaço Cloud Foundry atual.
- Configurado o profile `hybrid` por `cds bind`; o binding local ficou em `.cdsrc-private.json`, ignorado pelo Git.
- Implantados modelo, views e 43 registros iniciais no HDI com sucesso.
- Adicionado o comando opt-in `npm run test:integration:hdi` e uma suíte com oito cenários HANA.
- A execução confirmou quatro cenários: conexão/carga, concorrência da mesma ordem, concorrência por estoque compartilhado e rollback individual.
- Quatro testes falharam, reproduzindo F001, F003, F004 e F005 diretamente no HANA/HDI.
- As fixtures sintéticas foram removidas pela própria suíte; nenhum commit foi criado.

## 2026-08-05 — Comentários didáticos nos testes

- Documentados os 42 blocos `it` das suítes unitária, HTTP/SQLite e HANA/HDI.
- Cada cenário agora explica contexto, ação, resultado esperado e regra protegida.
- Nenhuma lógica ou asserção foi alterada.
- Os testes não foram executados, conforme solicitado.

## 2026-08-05 — Testes Fiori elements com OPA5

- Adotado o Fiori elements Test Starter para os aplicativos de Ordens e Lotes.
- Criadas jornadas didáticas com 10 cenários de Ordens e 11 cenários de Lotes.
- Cobertos List Report, filtros, Object Pages, composições, actions, erros funcionais, navegação e criação em draft.
- Adicionado runner headless com Chrome, CAP em memória e `puppeteer-core`.
- Ordens passou com 50 de 50 asserções QUnit.
- Lotes passou com 47 de 49 asserções QUnit.
- As duas falhas de Lotes reproduzem F005 e o novo F011.
- F011 registra que `processarLote` persiste o resultado, mas não atualiza os itens já exibidos.
- UI5 linter não apontou erros novos; F008 continua sendo o único erro nos dois aplicativos.
- Nenhum commit foi criado.
