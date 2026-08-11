# F003 — Filtro virtual altera a semântica de `or`

**Severidade:** 🟧 Média

**Status:** 🟢 Resolvido

## Base

- Arquivo original: `srv/planejamento-service.js:96` e `srv/planejamento-service.js:175`.
- Correção atual: `srv/planejamento-service.js:190` e `srv/planejamento-service.js:289`.
- O handler remove a comparação virtual e acrescenta o `exists` com `and`, independentemente do conector original.
- Reprodução com administrador: `comRiscoEstoque eq false or codigo eq 'OM-0002'` deveria retornar `OM-0002`, mas retornou uma coleção vazia. O filtro simples `comRiscoEstoque eq true` respondeu normalmente.
- Teste automatizado: `PlanejamentoService.integration.test.js`, cenário `preserva a semântica de or no filtro virtual`. A ordem atendida pelo segundo operando não foi retornada; a suíte falhou como previsto.
- Confirmação no HANA/HDI: `PlanejamentoServiceHdi.integration.test.js`, cenário `preserva a semântica de or no filtro virtual no HANA`. A consulta retornou `[]` e omitiu a ordem atendida pelo segundo operando.

```http
GET /planejamento/Ordens?$filter=comRiscoEstoque eq false or codigo eq 'OM-0002'

HTTP 200
{"value":[]}
```

## Descrição

A transformação converte uma união lógica em uma interseção. Isso muda o contrato OData e produz resultados incorretos quando o filtro virtual participa de expressões compostas com `or` ou agrupamentos equivalentes.

## Sugestão

Substituir recursivamente o nó da comparação virtual pelo `exists` ou `not exists` no mesmo ponto da árvore CQN. Não remover a comparação para depois anexá-la ao fim do `where`.

```javascript
// Ideia: preservar a posição e os conectores do nó original.
const substituirFiltroVirtual = (xpr) => xpr.map((token, index) => {
  if (ehComparacaoComRisco(xpr, index)) {
    return filtroBooleano(xpr, index) ? existsRisco : { xpr: ["not", existsRisco] };
  }
  return Array.isArray(token?.xpr)
    ? { xpr: substituirFiltroVirtual(token.xpr) }
    : token;
});
```

## Impacto

O usuário pode deixar de encontrar ordens que atendem a um dos critérios selecionados e tomar decisões com uma lista incompleta.

## Resolução

O handler passou a substituir recursivamente a comparação de
`comRiscoEstoque` pelo `exists` ou `not exists` na posição original da CQN.
Assim, os conectores `and` e `or` e os agrupamentos `xpr` permanecem com a
mesma precedência da consulta recebida. Os helpers antigos, que removiam o
campo virtual e reconstruíam o filtro, foram eliminados.

## Validações

- Sintaxe JavaScript, compilação CDS e `git diff --check`: concluídos com sucesso.
- Testes unitários dos handlers: 8 de 8 passaram, incluindo `or` e `xpr` aninhada.
- Testes HTTP/SQLite do campo virtual: 3 de 3 passaram para `true`, `false` e `or`.
- Suíte HTTP/SQLite completa: 25 testes passaram; as três falhas restantes já correspondem ao F001, à parcela transferida do F010 e a uma expectativa de idioma do teste.
- Teste HANA/HDI `preserva a semântica de or no filtro virtual no HANA`: 1 de 1 passou após a instância voltar a aceitar conexões.
