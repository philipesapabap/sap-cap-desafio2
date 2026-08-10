# F010 — Escopo impede ativar um draft novo

**Severidade:** 🟥 Alta

## Base

- Arquivo: `srv/planejamento-service.js:30`.
- Arquivo: `srv/planejamento-service.js:46`.
- O escopo baseado em `V_AcessosOrdem` também é aplicado a `Ordens.drafts`.
- Um draft novo ainda não possui registro em `ResponsabilidadesOrdem`; portanto, o `EXISTS` de acesso elimina o próprio draft da leitura.
- Teste automatizado: `PlanejamentoService.integration.test.js`, cenário `ativa um draft válido`. O draft foi persistido para `TEST1001`, mas `draftActivate` respondeu HTTP 404 com `No draft for this entity exists`.

```text
POST /planejamento/Ordens                                      -> 204; draft persistido
POST .../PlanejamentoService.draftActivate                     -> 404
mensagem                                                       -> No draft for this entity exists
```

## Descrição

O criador consegue iniciar a edição, mas o filtro de leitura oculta o draft novo porque o acesso só existe para ordens ativas já relacionadas. A ativação do runtime precisa reler o draft e passa a tratá-lo como inexistente.

## Sugestão

Separar a regra de escopo das ordens ativas e dos drafts. Para draft novo, permitir a leitura ao próprio criador, preservando o filtro de acesso para drafts derivados de ordens existentes.

Validar a solução com usuário comum, outro usuário e administrador. Evitar remover integralmente a proteção dos drafts.

## Impacto

O fluxo principal de criação não termina. Usuários comuns não conseguem ativar novas ordens, mesmo sendo autores do draft.
