# Pontos ainda pendentes

## Correções bloqueantes

- F001 a F009 e F011 foram resolvidos e validados.
- F010 foi concluído pela CR-001, que cria as responsabilidades iniciais durante a ativação do draft novo.

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
- Ponto 11: concluído; as actions validam no backend o papel funcional exigido pela CR-001.
- Ponto 12: implementado, porém com catálogo de status inconsistente.
- Ponto 13: concluído após a resolução de F001, F005 e F011, com validações em SQLite, HANA/HDI e Fiori elements.
- Pontos 14 a 18: parciais; debug, cenários negativos no `.http` e respostas conceituais faltam. Os testes automatizados de backend foram adicionados.
- Ponto 19: as três melhorias obrigatórias faltam.
- Pontos 20 e 21: entrega e checklist final incompletos.
