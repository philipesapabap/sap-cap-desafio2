# Pontos ainda pendentes

## Correções bloqueantes

1. Garantir atomicidade por item no lote.
2. Validar acesso dentro das actions.
3. Preservar a semântica do filtro virtual.
4. Corrigir os códigos de status.
5. Bloquear valor estimado negativo.
6. Validar o período no patch do draft.
7. Permitir que o criador ative um draft novo.
8. Corrigir a URL dos testes HTTP.
9. Atualizar status e itens após processar um lote no Fiori elements.

## Especificação ainda não implementada

- Melhoria 1 do ponto 19: entidade `Delegacoes`, acesso efetivo e validade da delegação.
- Melhoria 2 do ponto 19: action `reabrirOrdem(motivo)`.
- Melhoria 3 do ponto 19: action `reabrirItensComErro()` e reprocessamento do lote.
- Internacionalização dos textos do domínio com `localized` e arquivos `_texts`.
- Externalização dos textos CDS/UI para bundles i18n.
- Fixed values: o EDMX possui `Common.ValueList`, mas não possui `Common.ValueListWithFixedValues`.
- Dimensões percentuais das colunas/tabelas. `GridTable` foi configurada somente nos List Reports.
- `.vscode/launch.json` para o fluxo de debug solicitado.
- Respostas conceituais da seção 18.
- Evidências e artefatos da seção 20.
- Documentação real do projeto. O `readme.md` ainda é o modelo inicial.
- `mta.yaml` e documentação de build/deploy integrada ao repositório.
- Cenários negativos no arquivo `.http`.

## Status consolidado

- Pontos 1 a 6: estrutura principal presente.
- Pontos 7 a 10: handlers presentes, com defeito no filtro composto, validação incompleta e bloqueio na ativação de draft novo.
- Ponto 11: implementado, porém sem autorização dentro da action.
- Ponto 12: implementado, porém com catálogo de status inconsistente.
- Ponto 13: não deve ser considerado concluído enquanto F001, F005 e F011 permanecerem abertos.
- Pontos 14 a 18: parciais; debug, cenários negativos no `.http` e respostas conceituais faltam. Os testes automatizados de backend foram adicionados.
- Ponto 19: as três melhorias obrigatórias faltam.
- Pontos 20 e 21: entrega e checklist final incompletos.
