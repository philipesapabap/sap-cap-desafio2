# F008 — Manifests usam versão antiga

**Severidade:** 🟨 Baixa

**Status:** 🟢 Resolvido

## Base

- Arquivo: `app/ordens/webapp/manifest.json:2`.
- Arquivo: `app/lotes/webapp/manifest.json:2`.
- A validação de schema considerou os dois manifests válidos.
- O UI5 linter retornou `no-outdated-manifest-version` com severidade de erro nos dois arquivos, solicitando Manifest Version 2.

```json
"_version": "1.85.0"
```

## Descrição

Os descritores são aceitos pelo schema, mas não atendem à versão exigida pelo tooling UI5 atual. Isso mantém o lint vermelho e adia ajustes de compatibilidade.

## Sugestão

Executar a migração oficial para Manifest Version 2 e repetir a validação e o linter nos dois apps. Não alterar apenas o número sem revisar as mudanças da migração.

```json
"_version": "2.0.0"
```

## Resolução

- Os manifests dos aplicativos Ordens e Lotes foram migrados para a Manifest Version 2.
- O autofix do `@ui5/linter` confirmou que a regra exige revisão manual e não realiza essa migração automaticamente.
- A estrutura existente dos dois manifests já era compatível; somente `_version` precisou ser alterado de `1.85.0` para `2.0.0`.
- Os demais campos, rotas, targets, modelos e configurações foram preservados.

## Evidências

```text
Validação JSON dos dois manifests -> passou
UI5 linter — Ordens               -> zero findings
UI5 linter — Lotes                -> zero findings
Fiori/OPA5 — Ordens               -> 45/45 passed
Fiori/OPA5 — Lotes                -> 45/45 passed
git diff --check                  -> passou
```
