# F006 — Ordem aceita valor estimado negativo

**Severidade:** 🟧 Média

## Base

- Arquivo: `db/schema.cds:88`.
- Arquivo: `srv/planejamento-service.js:260`.
- O modelo não possui `@assert.range` para `valorEstimado`, e o handler valida apenas datas.
- Reprodução: foi criado um draft com `valorEstimado=-10`; a criação respondeu HTTP 201 e `draftActivate` também respondeu HTTP 201, persistindo a ordem ativa.
- Testes automatizados: `PlanejamentoService.integration.test.js`, cenários `rejeita valor estimado negativo` e `rejeita valor estimado negativo na ativação do draft`. A criação respondeu HTTP 204 e a ativação respondeu HTTP 201, embora ambas devessem retornar HTTP 400.

```text
POST /planejamento/Ordens                         -> 201
POST .../draftActivate                           -> 201
valorEstimado                                    -> -10
```

## Descrição

A regra obrigatória do ponto 8 não foi implementada. Tanto a edição quanto a ativação aceitam um valor negativo.

## Sugestão

Preferir restrição declarativa e manter teste de ativação do draft.

```cds
valorEstimado : Decimal(13, 2) default 0 @assert.range: [0, 99999999999.99];
```

## Impacto

Ordens podem ser salvas com estimativa financeira inválida, afetando relatórios e decisões operacionais.
