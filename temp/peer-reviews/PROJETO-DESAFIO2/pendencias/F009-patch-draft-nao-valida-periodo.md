# F009 — Patch do draft não valida o período

**Severidade:** 🟧 Média

**Status:** 🟢 Resolvido

## Base

- Arquivo: `srv/planejamento-service.js:64`.
- Arquivo: `srv/planejamento-service.js:357`.
- No CAP, `PATCH` é o evento específico de alteração do draft e funciona como alias de `UPDATE`.
- O uso anterior de `req.error` com um campo de destino permitia que o runtime tratasse a inconsistência como mensagem persistida do draft e concluísse o PATCH com sucesso.
- A validação agora usa `req.reject`, interrompe a alteração e devolve HTTP 400.
- O teste automatizado `rejeita período inválido no patch do draft` passou após a correção.

```text
POST /planejamento/Ordens                                      -> draft criado
PATCH /planejamento/Ordens(...,IsActiveEntity=false)           -> 400
dataFimPlanejada < dataInicioPlanejada                         -> rejeitada
```

## Descrição

A alteração parcial do Fiori envia somente o campo modificado. A rotina recupera o draft persistido, combina seus valores com o delta recebido e valida o período completo antes de permitir a gravação.

## Correção aplicada

O handler passou a declarar o evento de draft `PATCH`, sem registrá-lo simultaneamente com seu alias `UPDATE`.

```javascript
this.before(["CREATE", "PATCH"], Ordens.drafts, this.validarPeriodoDaOrdem);
```

A falha cronológica passou a rejeitar imediatamente a requisição:

```javascript
return req.reject(400, "INVALID_PLANNED_PERIOD", campoAlterado);
```

## Evidências de validação

- Verificação de sintaxe JavaScript: aprovada.
- Compilação CDS: aprovada.
- Suíte unitária dos handlers: 7 testes aprovados.
- Testes HTTP de período na criação e no PATCH: 2 testes aprovados.
- `git diff --check`: aprovado.

## Impacto

O risco foi mitigado. Uma data final anterior ou igual à inicial é rejeitada antes de ser persistida pelo PATCH do draft.
