# Contexto do peer review

## Demanda

Revisar o projeto SAP CAP/Fiori Elements e confrontar o estado atual com a especificação e os históricos fornecidos em `pasted-text.txt`.

## Objetivo funcional

O sistema deve permitir consultar ordens conforme o acesso do usuário, filtrar risco de estoque, liberar e cancelar ordens, processar lotes com resultado parcial por item e suportar as melhorias obrigatórias do ponto 19.

## Base, head e escopo

- Base do último incremento analisado: `0dc00f5` — `feat(ordens): implementar cancelamento com motivo e atualização da interface`.
- Head: `7ed71eb` — `feat(lotes): implementar processamento e navegação de ordens em lote`.
- Branch: `peer_review`, alinhada a `main` e `origin/main` no início da revisão.
- Além do diff do último incremento, foi verificada a conformidade do projeto completo com a especificação anexada.
- Áreas: `db/**`, `srv/**`, `app/ordens/**`, `app/lotes/**`, `test/**`, dependências e documentação.

## Fluxos analisados

- Listagem de ordens e escopo por usuário.
- Conversão do filtro virtual `comRiscoEstoque`.
- Liberação individual e movimentação de estoque.
- Cancelamento de ordem.
- Processamento parcial de lote.
- Metadados OData V4 e anotações Fiori Elements.
- Apps de ordens e lotes.

## Evidências e validações

- `npm ci`: concluído com sucesso.
- `npx cds compile db srv app --to csn`: concluído com sucesso.
- `npx cds compile db srv app --to edmx`: concluído com sucesso; as actions atuais e `comRiscoEstoque` aparecem no EDMX.
- `npx cds deploy --to sqlite:<arquivo-temporário>`: concluído com carga dos CSVs.
- `npx cds lint`: sem saída de erro.
- Servidor CAP 9.9.2 iniciado com SQLite temporário; os dois apps responderam HTTP 200.
- Jornadas OPA5 executadas em Chrome headless com o Fiori elements Test Starter.
- Ordens: 50 de 50 asserções QUnit passaram.
- Lotes: 47 de 49 asserções passaram; as duas falhas reproduzem F005 e F011.
- Validação de ambos os `manifest.json`: válida.
- UI5 linter: erro `no-outdated-manifest-version` nos dois manifests.
- `npm audit --omit=dev`: duas vulnerabilidades transitivas de produção, uma alta e uma moderada; alcance na aplicação não foi comprovado.
- Reproduções HTTP e inspeção direta do SQLite foram usadas nos findings F001 a F007.

## Comparação entre comportamento esperado e atual

- O processamento de lote continua após erro, como solicitado, mas não garante atomicidade por item.
- O filtro simples de risco funciona, porém combinações com `or` mudam de significado.
- O escopo de leitura funciona na lista, porém a action direta de liberação não valida o mesmo acesso.
- O cancelamento funciona, mas grava um código ausente da lista de status.
- O lote grava `ERRO`, enquanto a especificação exige `PROCESSADO_COM_ERRO`.
- O processamento do lote não atualiza a composição de itens já exibida na Object Page.
- O projeto aceita e ativa ordem com valor estimado negativo.
- O arquivo HTTP usa uma rota diferente da rota real do serviço.

## Premissas e limitações

- Houve execução funcional em Chrome headless; não houve validação visual responsiva ou comparação de imagens.
- A revisão inicial não incluiu concorrência em SAP HANA; testes posteriores no HDI passaram a cobrir a mesma ordem, estoque compartilhado e estoques solicitados em ordem inversa.
- Foram adicionados testes automatizados de backend, HDI e jornadas OPA5. Ainda não há teste visual responsivo ou de regressão por imagem.
- As vulnerabilidades do `npm audit` foram registradas como risco residual, sem classificação como finding funcional por falta de evidência de alcançabilidade.

## Problemas preexistentes relevantes

- Ausência de validação de acesso na action individual já existia antes do commit `7ed71eb`; permanece obrigatória pela especificação.
- O código `CANCELADA` já estava ausente no CSV antes do último incremento.
- A validação de `valorEstimado` negativo já estava ausente.

## Validação posterior — F003

- A comparação de `comRiscoEstoque` passou a ser substituída no mesmo ponto da expressão CQN, inclusive dentro de `xpr` aninhadas.
- Sintaxe JavaScript, compilação CDS e `git diff --check` passaram.
- A suíte unitária passou com 8/8 testes; os três cenários HTTP/SQLite do filtro virtual passaram para `true`, `false` e combinação com `or`.
- A suíte HTTP/SQLite completa passou em 25 cenários. As três falhas restantes são preexistentes e correspondem a F001, à parcela transferida do F010 e à expectativa de idioma do teste de motivo obrigatório.
- Após indisponibilidade temporária da conexão, o teste HANA/HDI `preserva a semântica de or no filtro virtual no HANA` foi repetido e passou com 1/1.

## Validação posterior — F001

- A liberação passou a bloquear estoques distintos em ordem determinística, simular todas as reservas e persistir somente depois da validação completa.
- A entidade `Estoques` recebeu uma restrição funcional única para material e depósito; CSV, SQLite e HDI foram previamente verificados sem duplicidades.
- A compilação SQL/HANA gerou `UNIQUE (material_ID, deposito_ID)`.
- Os testes focados SQLite passaram com 5/5; a suíte completa passou em 28 cenários e manteve somente duas falhas preexistentes sem relação com F001.
- No HANA, passaram os cenários de atomicidade do lote, rollback individual, saldo acumulado e três formas de concorrência.
- A jornada Fiori de Lotes passou com 45/45 asserções.
- Ainda é necessário implantar o novo modelo no HDI antes de executar o teste HANA específico da restrição única.
