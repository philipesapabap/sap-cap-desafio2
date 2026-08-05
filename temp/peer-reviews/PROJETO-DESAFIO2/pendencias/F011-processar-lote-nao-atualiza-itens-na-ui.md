# F011 — Processar lote não atualiza os itens na interface

**Severidade:** 🟧 Média

## Base

- Arquivo: `srv/planejamento-service.cds:44`.
- Arquivo: `app/lotes/webapp/test/integration/LotesDidacticJourney.js`.
- A action `processarLote` não declara `@Common.SideEffects`.
- OPA5: cenário `atualiza os resultados visuais dos itens`.
- Resultado: depois da resposta bem-sucedida, a tabela continuou sem apresentar o item `SUCESSO`.
- Confirmação da persistência: a tentativa seguinte recebeu HTTP 409 com `Lote já foi processado`.

## Descrição

O processamento ocorre no backend, mas a Object Page mantém o snapshot anterior da composição `itens`. O usuário precisa sair da página ou recarregá-la para enxergar os resultados.

O problema não é a regra de processamento. A segunda execução foi rejeitada porque o lote já estava processado. A divergência está entre os dados persistidos e os dados ainda exibidos.

## Sugestão

Declarar SideEffects na action para solicitar uma nova leitura do estado agregado e da composição `itens`. Validar no EDMX gerado se os caminhos aparecem corretamente.

```cds
@Common.SideEffects: {
    TargetProperties: ['in/status_code'],
    TargetEntities  : [in.itens]
}
action processarLote() returns LotesLiberacao;
```

Manter o teste OPA5. Ele garante que a correção atualize a tela sem depender de recarga manual.

## Impacto

O usuário pode interpretar que o processamento não ocorreu e tentar executá-lo novamente. A nova tentativa falha com conflito, embora o resultado já exista no banco.
