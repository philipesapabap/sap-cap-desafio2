# F010 — Escopo impede ativar um draft novo

**Severidade:** 🟥 Alta

**Status:** 🟠 Parcialmente resolvido

## Base

- Arquivo: `srv/planejamento-service.js:30`.
- Arquivo: `srv/planejamento-service.js:46`.
- Originalmente, o escopo baseado em `V_AcessosOrdem` também era aplicado a `Ordens.drafts`.
- Um draft novo ainda não possui registro em `ResponsabilidadesOrdem`; portanto, o `EXISTS` de acesso eliminava o próprio draft da leitura.
- O handler específico para drafts passou a permitir que o criador leia o próprio draft novo e eliminou o erro HTTP 404 original.
- O teste automatizado `ativa um draft válido` avançou, mas ainda recebe HTTP 204 em vez de 201 porque a ordem ativa permanece sem registro em `ResponsabilidadesOrdem` e fica fora do escopo de leitura.

```text
POST /planejamento/Ordens                                      -> 204; draft persistido
POST .../PlanejamentoService.draftActivate                     -> 204; ativação avança
leitura da ordem ativa pelo usuário comum                    -> ordem fora do escopo
```

## Descrição

O bloqueio da leitura do draft novo pelo próprio criador foi corrigido. Ainda falta definir e implementar como a nova ordem ativa receberá um registro em `ResponsabilidadesOrdem`, necessário para permanecer visível ao usuário comum após a ativação.

O tutor definiu que essa regra adicional será tratada como Change Request no Desafio 3. Por isso, o finding está parcialmente resolvido no escopo do Desafio 2.

## Sugestão

No Desafio 3, a Change Request deve definir se a ativação cria automaticamente uma responsabilidade para o responsável principal ou se exige que uma responsabilidade seja informada antes da ativação.

Depois da implementação, validar o fluxo completo com usuário comum, outro usuário e administrador, preservando o escopo de acesso das ordens ativas e dos drafts existentes.

## Impacto

O usuário comum voltou a acessar o draft que criou, mas a nova ordem ativa ainda pode ficar invisível para ele por não possuir uma responsabilidade associada. O risco residual foi transferido para a Change Request do Desafio 3.
