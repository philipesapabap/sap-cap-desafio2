# F007 — Arquivo HTTP usa URL incorreta

**Severidade:** 🟨 Baixa

## Base

- Arquivo: `test/http/planejamento.http:3`.
- O serviço declara `@path: '/planejamento'` em `srv/planejamento-service.cds:4`.
- Reprodução: `/odata/v4/planejamento/$metadata` respondeu HTTP 404; `/planejamento/$metadata` respondeu HTTP 200.

```http
@service = {{host}}/odata/v4/planejamento
```

## Descrição

Todas as requisições manuais do arquivo apontam para um endpoint não servido pelo projeto. Assim, o artefato obrigatório do ponto 15 não executa como entregue.

## Sugestão

Alinhar a variável com o caminho explícito do serviço.

```http
@service = {{host}}/planejamento
```

## Resolução

**Status:** 🟢 Resolvido

A variável `@service` foi alterada para utilizar o caminho explícito `/planejamento`.

A validação local confirmou:

- `GET /planejamento/$metadata`: HTTP 200;
- `GET /planejamento/Ordens?$top=3`: HTTP 200.
