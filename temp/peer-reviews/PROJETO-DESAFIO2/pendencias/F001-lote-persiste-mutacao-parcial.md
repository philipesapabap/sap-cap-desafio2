# F001 — Lote persiste mutação parcial de item com erro

**Severidade:** 🟥 Alta

## Base

- Arquivo: `srv/planejamento-service.js:459` e `srv/planejamento-service.js:610`.
- O commit `7ed71eb` passou a lançar `ErroDeNegocio` e a capturá-lo dentro do loop do lote.
- Reprodução: o segundo estoque da ordem `OM-0001` foi ajustado para zero em um SQLite temporário. `processarLote` respondeu HTTP 200 e marcou o item como `ERRO`, mas o primeiro estoque caiu de 10 para 8 e um movimento foi gravado. A ordem permaneceu `ABERTA`.
- A validação foi executada com CAP 9.9.2. Falhas técnicas não foram absorvidas; a inconsistência ocorre especificamente na falha funcional capturada.
- Teste automatizado: `PlanejamentoService.integration.test.js`, cenário `mantém atomicidade do item que falha no lote`. Esperava estoque 10, mas recebeu 8; a suíte falhou como previsto.
- Confirmação no HANA/HDI: `PlanejamentoServiceHdi.integration.test.js`, cenário `mantém atomicidade da ordem que falha dentro do lote`. O estoque também caiu de 10 para 8, confirmando a mutação parcial no banco-alvo.

```text
item.status_code = ERRO
ordem.status_code = ABERTA
estoque.quantidadeDisponivel = 8
movimentosDaOrdem = 1
```

## Descrição

`liberarOrdemPorID` atualiza cada reserva antes de validar as reservas seguintes. Quando uma reserva posterior falha, `onProcessarLote` captura o erro e permite o commit da requisição. Assim, um item declarado como erro pode consumir estoque e gerar histórico parcial.

## Sugestão

Bloquear e validar todas as reservas antes de executar qualquer `UPDATE` ou `INSERT`. Somente após a validação completa, aplicar as mutações do item. Manter falhas técnicas propagadas para rollback global.

```javascript
const movimentos = [];
for (const reserva of reservas) {
  const estoque = await SELECT.one.from(Estoques).where({
    material_ID: reserva.material_ID,
    deposito_ID: reserva.deposito_ID,
  }).forUpdate();

  if (!estoque || Number(estoque.quantidadeDisponivel) < Number(reserva.quantidadeNecessaria)) {
    throw new ErroDeNegocio(409, `Estoque insuficiente para a ordem ${ordem.codigo}`);
  }

  movimentos.push({ estoque, reserva });
}

for (const { estoque, reserva } of movimentos) {
  // Atualizações somente após validar o item inteiro.
}
```

## Impacto

O saldo e o histórico ficam incompatíveis com o resultado exibido no lote. Um reprocessamento pode consumir novamente quantidades já movimentadas.
