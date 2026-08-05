# F004 — Status `CANCELADA` está ausente

**Severidade:** 🟧 Média

## Base

- Arquivo: `srv/planejamento-service.js:550`.
- Arquivo: `db/data/desafio.ordens-StatusOrdem.csv:1`.
- A action grava `CANCELADA`, mas o CSV possui somente `ABERTA`, `LIBERADA` e `BLOQUEADA`.
- Reprodução: `cancelarOrdem` respondeu HTTP 200 e gravou `status_code=CANCELADA`; ao consultar com `$expand=status`, a associação retornou `status:null`.
- Teste automatizado: `PlanejamentoService.integration.test.js`, cenário `cancela ordem e resolve o texto do status`. A associação retornou `null`; a suíte falhou como previsto.
- Confirmação no HANA/HDI: `PlanejamentoServiceHdi.integration.test.js`, cenário `resolve o domínio do status após cancelar uma ordem`. A action gravou `CANCELADA`, mas a expansão continuou retornando `status:null`.

```json
{
  "status_code": "CANCELADA",
  "status": null
}
```

## Descrição

O código persistido não existe na lista de domínio. O texto e a ajuda de pesquisa ficam sem correspondência, e bancos com integridade referencial ativa podem rejeitar a atualização.

## Sugestão

Adicionar o código esperado e cobrir a expansão após o cancelamento.

```csv
code;texto
ABERTA;Aberta
LIBERADA;Liberada
CANCELADA;Cancelada
BLOQUEADA;Bloqueada
```

## Impacto

Após cancelar, a UI pode exibir status vazio. Em HANA, a operação pode falhar caso a restrição referencial seja aplicada.
