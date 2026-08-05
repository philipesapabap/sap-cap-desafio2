# F005 — Status de lote diverge do contrato

**Severidade:** 🟧 Média

## Base

- Arquivo: `srv/planejamento-service.js:641`.
- Arquivo: `db/data/desafio.ordens-StatusLote.csv:1`.
- O handler e o CSV usam `ERRO`; a especificação exige `PROCESSADO_COM_ERRO`.
- Reprodução: lote com falhas respondeu HTTP 200 com `status_code=ERRO`.
- Teste automatizado: `PlanejamentoService.integration.test.js`, cenário `usa o status contratual para lote com erro`. Esperava `PROCESSADO_COM_ERRO`, mas recebeu `ERRO`; a suíte falhou como previsto.
- Confirmação no HANA/HDI: `PlanejamentoServiceHdi.integration.test.js`, cenário `usa o status contratual quando o lote termina com erro`. O serviço também devolveu `ERRO` no banco-alvo.
- Confirmação no Fiori elements: `LotesDidacticJourney.js`, cenário `apresenta o estado contratual do lote`. Após reler o serviço, a linha não apresentou `PROCESSADO_COM_ERRO`; a asserção OPA5 falhou como previsto.

```javascript
status_code: erros > 0 ? "ERRO" : "PROCESSADO"
```

## Descrição

O contrato de estado definido para o ponto 13 não foi seguido. A melhoria obrigatória `reabrirItensComErro` também depende explicitamente de `PROCESSADO_COM_ERRO`, portanto a implementação atual não oferece a pré-condição esperada.

## Sugestão

Uniformizar modelo, dados, handler, anotações e testes no código definido pela especificação.

```javascript
await UPDATE(LotesLiberacao, ID).with({
  status_code: erros > 0 ? "PROCESSADO_COM_ERRO" : "PROCESSADO",
});
```

```csv
PROCESSADO_COM_ERRO;Processado com erro
```

## Impacto

Integrações e a futura action de reprocessamento não reconhecem o estado produzido pelo lote.
