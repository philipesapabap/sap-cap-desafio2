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
- 2026-08-10: Atualizado somente o inventário comentado de `PlanejamentoService.integration.test.js`: incluído o cenário F002 de cancelamento sem acesso como teste 15 e renumerados os posteriores até 28. Nenhuma lógica de teste foi alterada e nenhum commit foi criado.

- 2026-08-10: Diagnóstico OPA5 de Ordens confirmou que o erro 409 de estoque abre `sap.m.Dialog`/`sap.m.MessageBox` (`__error0`, classe `sapMMessageBoxError`, título `Erro`, botão `Fechar`), mas o controle expõe `state: None`; por isso `onErrorDialog().iCheckState({ visible: true })` não o reconhece como tipo `Error`. Script temporário: `temp/inspect-fiori-dialog.js`; captura: `/tmp/fiori-ordens-after-409.png`.
- 2026-08-10: Criadas no page object de Ordens as operações OPA5 `iCheckErrorMessageDialog` e `iCloseErrorMessageDialog`, usando `searchOpenDialogs` para alcançar o MessageBox na área estática. A jornada passou a usá-las; `node --check` e ESLint passaram. A suíte Fiori melhorou para 45/46, restando apenas a navegação da GridTable de reservas.
- 2026-08-10: Removido da jornada didática de Ordens o cenário obsoleto que tentava navegar da GridTable de reservas para uma Object Page. A navegação já havia sido retirada funcionalmente, e o helper `iPressRow()` falhava ao chamar `getItems()` sobre a estrutura de GridTable. Também foi removida a action experimental de navegação. Manifest, sintaxe, ESLint e `git diff --check` passaram; `npm run test:fiori:ordens` concluiu com 45/45 asserções e código de saída 0.
- 2026-08-10: A jornada OPA5 de Lotes recebeu helpers próprios para consultar as GridTables pelos contextos OData, eliminando a dependência de `iCheckRows()`/`iPressRow()` incompatíveis com `sap.ui.table.Table`. A navegação de lote e ordem passou a usar os caminhos internos declarados no manifest, e o page object filho foi alinhado a `OrdensObjectPageFromLote`. A execução avançou até as verificações funcionais de F011 e F005 sem repetir os erros `getItems()` ou `isA`; a leitura de status foi alinhada à associação selecionada `status/code`. Sintaxe, ESLint e `git diff --check` passaram. A última execução completa foi interrompida após os timeouts intencionais dos findings pendentes.
- 2026-08-10: Preparado o fechamento do merge da branch remota `peer_review` em `correcao_peer_review_002`. O controle e o relatório do F002 foram atualizados para resolvido com evidência dos testes de liberação e cancelamento sem acesso. F004 permaneceu pendente até nova confirmação automatizada.
- 2026-08-10: O controle do peer review foi atualizado para registrar o F007 como resolvido após a validação HTTP 200 de `/planejamento/$metadata` e `/planejamento/Ordens`.
- 2026-08-10: O F004 foi confirmado como resolvido. O teste de integração `cancela ordem e resolve o texto do status` passou em SQLite, comprovando o código `CANCELADA` e a resolução da associação localizada; controle e relatório foram atualizados.
- 2026-08-10: A tentativa de validar o F006 após adicionar `@assert.range` compilou, mas os dois testes ainda não passaram. A criação do draft com `valorEstimado=-10` respondeu HTTP 204 em vez de 400; a ativação respondeu 400, porém com mensagem genérica de intervalo sem “Valor estimado”. O finding permaneceu pendente e seus documentos não foram alterados.
- 2026-08-10: Ajustada a preparação do teste de ativação do F006. O cenário agora cria um draft válido, altera diretamente sua linha de teste para `valorEstimado=-10` e então chama `draftActivate`, evitando que a validação antecipada de CREATE interrompa o cenário. O helper de erros passou a considerar também `error.details`, onde o CAP envia a mensagem específica quando a resposta principal representa múltiplos erros.
- 2026-08-10: F006 confirmado como resolvido. Compilação CDS, verificação de sintaxe, `git diff --check` e os dois testes focados passaram; o controle e o relatório do peer review foram atualizados com a resolução e as evidências.
- 2026-08-10: Corrigida a infraestrutura OPA5 de Lotes para localizar `processarLote` pelo ID técnico, sem depender do idioma, e para navegar à ordem usando a associação expandida `ordem/ID` no page object e no manifest. Sintaxe, JSON e ESLint passaram. A jornada avançou para 44/45 asserções; o cenário visual do F005 passou e restou somente a falha intencional do F011, referente à GridTable de itens não atualizada após o processamento.
- 2026-08-10: F005 confirmado como resolvido em SQLite, HANA/HDI e na jornada Fiori. O controle e o relatório foram atualizados; o F011 permaneceu pendente e separado do fechamento do status contratual do lote.
- 2026-08-10: Validada a anotação `Common.SideEffects` adicionada à action `processarLote` para o F011. A compilação CDS completa e a geração do EDMX passaram; o metadado contém `in/status_code`, `in/status` e `in/itens`. A jornada Fiori de Lotes passou com 45/45 asserções, e três cenários focados de integração SQLite passaram. Nenhum commit foi criado.
- 2026-08-10: F011 confirmado como resolvido. O controle e o relatório foram atualizados, `git diff --check` e a compilação CDS passaram, o EDMX confirmou os três SideEffects, os testes SQLite passaram com 3/3 e a jornada Fiori de Lotes com 45/45 asserções.
- 2026-08-10: F008 confirmado como resolvido. Os manifests de Ordens e Lotes foram migrados de `_version` 1.85.0 para 2.0.0; ambos os JSONs permaneceram válidos e o `@ui5/linter` terminou sem findings. As jornadas Fiori de Ordens e Lotes passaram com 45/45 asserções cada. O controle e o relatório foram atualizados; nenhum commit foi criado.
