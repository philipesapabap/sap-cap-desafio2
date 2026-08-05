# F002 — Action ignora o acesso da ordem

**Severidade:** 🟥 Alta

## Base

- Arquivo: `srv/planejamento-service.js:381`.
- `liberarOrdemPorID` valida existência, status, reservas e estoque, mas não valida `req.user` nem `V_AcessosOrdem`.
- Reprodução: o usuário `100002`, que não possui responsabilidade sobre `OM-0001`, chamou diretamente `liberarOrdem` e recebeu HTTP 200. A ordem passou para `LIBERADA`, o estoque foi reduzido e dois movimentos foram criados.
- A especificação exige expressamente validar o acesso dentro de `liberarOrdemPorID`, não apenas na lista.
- Teste automatizado: `PlanejamentoService.integration.test.js`, cenário `rejeita liberação sem acesso`. Esperava HTTP 403, mas recebeu HTTP 200; a suíte falhou como previsto.

```text
usuário = 100002
ordem = OM-0001
responsável autorizado = 100001
HTTP = 200
status final = LIBERADA
```

## Descrição

O filtro aplicado em `before READ` protege somente consultas. Conhecendo o UUID, qualquer usuário autenticado pode executar a action sobre uma ordem fora do seu escopo. O processamento de lote reutiliza o mesmo helper e herda a falha.

## Sugestão

Passar a requisição ou o usuário ao helper e validar `V_AcessosOrdem` antes de adquirir e alterar os estoques. Preservar o bypass explícito do perfil `admin`.

```javascript
async liberarOrdemPorID(ID, req) {
  if (!req.user.is("admin")) {
    const acesso = await SELECT.one
      .from("desafio.ordens.V_AcessosOrdem")
      .where({ ordem_ID: ID, matricula: req.user.id });

    if (!acesso) {
      throw new ErroDeNegocio(403, "Usuário sem acesso à ordem");
    }
  }

  // Demais validações e mutações.
}
```

## Impacto

Usuários autenticados podem liberar ordens alheias e alterar estoque sem autorização funcional.
