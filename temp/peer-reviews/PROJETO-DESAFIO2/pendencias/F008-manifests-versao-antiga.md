# F008 — Manifests usam versão antiga

**Severidade:** 🟨 Baixa

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
