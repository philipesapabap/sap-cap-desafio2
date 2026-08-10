# F009 — Patch do draft não valida o período

**Severidade:** 🟧 Média

## Base

- Arquivo: `srv/planejamento-service.js:32`.
- Arquivo: `srv/planejamento-service.js:260`.
- O handler está registrado para `UPDATE` em `Ordens.drafts`, mas o `PATCH` OData do draft não executou a validação nesta versão do runtime.
- Teste automatizado: `PlanejamentoService.integration.test.js`, cenário `rejeita período inválido no patch do draft`. Esperava HTTP 400, mas recebeu HTTP 204; a suíte falhou.

```text
POST /planejamento/Ordens                                      -> draft criado
PATCH /planejamento/Ordens(...,IsActiveEntity=false)           -> 204
dataFimPlanejada < dataInicioPlanejada                         -> aceita
```

## Descrição

A validação funciona quando as duas datas chegam na criação. Porém, uma alteração parcial posterior aceita um período inválido. O fluxo normal do Fiori usa `PATCH` para editar o draft.

## Sugestão

Registrar a validação no evento efetivamente emitido pelo runtime para o draft e manter a leitura do estado persistido para combinar o delta.

```javascript
this.before(["CREATE", "UPDATE", "PATCH"], Ordens.drafts, this.validarPeriodoDaOrdem);
```

Confirmar o conjunto mínimo de eventos após a correção, evitando executar a mesma validação duas vezes.

## Impacto

O usuário consegue salvar no draft uma data final anterior à inicial. A inconsistência pode chegar à ativação ou permanecer visível durante a edição.
