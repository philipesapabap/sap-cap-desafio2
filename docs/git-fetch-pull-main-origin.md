# Git: `fetch`, `pull`, `main` e `origin`

Este documento explica:

1. a diferença entre `git fetch origin` e `git pull origin main`;
2. como a `main` local se relaciona com a `main` remota;
3. o significado de `origin` e `origin/main`.

## 1. Conceitos principais

Considere os seguintes nomes:

```text
main          = branch local, existente no seu computador
origin        = apelido do repositório remoto, normalmente no GitHub
origin/main   = referência local do último estado conhecido da main remota
```

No GitHub, a branch se chama apenas `main`. `origin/main` é o nome usado pelo Git local para acompanhar a `main` pertencente ao remoto chamado `origin`.

## 2. O que faz `git fetch origin`

```bash
git fetch origin
```

Esse comando consulta o repositório remoto e baixa informações sobre novos commits e branches.

Ele atualiza referências como:

```text
origin/main
```

Porém, ele não modifica:

- a sua branch `main` local;
- os arquivos do diretório de trabalho;
- suas modificações locais.

### Exemplo

Antes de outra pessoa enviar uma alteração:

```text
main:          A — B
origin/main:   A — B
```

O GitHub recebe o commit `C`, mas seu computador ainda não sabe disso:

```text
GitHub/main:   A — B — C

main:          A — B
origin/main:   A — B
```

Depois de executar:

```bash
git fetch origin
```

o estado local fica:

```text
main:          A — B
origin/main:   A — B — C
```

O commit foi baixado, mas ainda não foi integrado à sua `main`.

Para verificar a situação:

```bash
git status --short --branch
```

Se aparecer:

```text
## main...origin/main [behind 1]
```

significa que sua `main` está um commit atrás da `main` remota.

Para visualizar os commits remotos ainda não integrados:

```bash
git log main..origin/main --oneline
```

## 3. O que faz `git pull origin main`

```bash
git pull origin main
```

Esse comando faz aproximadamente duas operações:

```text
git fetch origin
        +
integração da main remota na branch local atual
```

Portanto, o `pull`:

1. busca os commits no repositório remoto;
2. tenta integrá-los à branch local atual;
3. pode modificar os arquivos locais;
4. pode gerar conflitos.

### Exemplo sem divergência

Antes:

```text
main:          A — B
origin/main:   A — B — C
```

Depois do `pull`:

```text
main:          A — B — C
origin/main:   A — B — C
```

### Exemplo com alterações dos dois lados

```text
             C  ← origin/main
            /
A — B
            \
             D  ← main
```

O commit `C` veio do GitHub e o commit `D` foi criado localmente.

Um `git pull origin main` normalmente tenta fazer merge. Isso pode criar um commit adicional:

```text
             C
            / \
A — B          M
            \ /
             D
```

`M` é o commit de merge.

Se `C` e `D` alterarem a mesma parte do mesmo arquivo, o Git poderá solicitar a resolução de conflitos.

## 4. `pull` com rebase

```bash
git pull --rebase origin main
```

Esse comando também busca as alterações remotas, mas reaplica seus commits locais depois delas.

Antes:

```text
             C  ← origin/main
            /
A — B
            \
             D  ← main
```

Depois:

```text
A — B — C — D'
```

`D'` representa sua modificação reaplicada depois de `C`.

O rebase deixa o histórico mais linear, mas ainda pode gerar conflitos.

## 5. Comparação entre os comandos

| Comando                         | Busca commits | Altera a `main` local | Altera arquivos | Pode gerar conflito |
| ------------------------------- | ------------: | --------------------: | --------------: | ------------------: |
| `git fetch origin`              |           Sim |                   Não |             Não |                 Não |
| `git pull origin main`          |           Sim |                   Sim |             Sim |                 Sim |
| `git pull --rebase origin main` |           Sim |                   Sim |             Sim |                 Sim |

Em resumo:

```text
fetch = veja o que mudou no GitHub
pull  = baixe e integre o que mudou no GitHub
```

## 6. Push da `main` local para a `main` remota

Conceitualmente, esta operação é:

```text
main local → main remota
```

O comando normalmente utilizado é:

```bash
git push origin main
```

Sua leitura é:

```text
git push   origin   main
│          │        │
│          │        └─ branch local que será enviada
│          └─ repositório remoto de destino
└─ operação de envio
```

O nome `origin` é necessário para o Git saber para qual repositório remoto deve enviar a branch.

Uma forma ainda mais explícita é:

```bash
git push origin main:main
```

A sintaxe é:

```text
branch_local:branch_remota
```

Portanto, `main:main` significa literalmente enviar a `main` local para a `main` remota.

## 7. Push e pull sem escrever `origin`

Quando a branch local já está vinculada a uma branch remota, podem ser usados os comandos curtos:

```bash
git push
git pull
```

Se a `main` acompanha `origin/main`, o Git entende:

```text
git push = main local → main do origin
git pull = main do origin → integração na main local
```

Para confirmar esse vínculo:

```bash
git status --short --branch
```

Um resultado como:

```text
## main...origin/main
```

indica que a `main` local acompanha a `main` do remoto `origin`.

## 8. Por que `git push main main` não funciona normalmente

A sintaxe do push é:

```text
git push <remoto> <branch>
```

Se executar:

```bash
git push main main
```

o Git interpretará o primeiro `main` como o nome de um repositório remoto. Se não existir um remoto com esse nome, ocorrerá um erro semelhante a:

```text
fatal: 'main' does not appear to be a git repository
```

## 9. Como interpretar o status

Depois de executar `git fetch origin`, use:

```bash
git status --short --branch
```

### Apenas commits locais

```text
## main...origin/main [ahead 1]
```

Significa que existe um commit local ainda não enviado. Se o remoto não tiver avançado:

```bash
git push origin main
```

### Apenas commits remotos

```text
## main...origin/main [behind 1]
```

Significa que existe um commit remoto ainda não integrado:

```bash
git pull --rebase origin main
```

### Commits diferentes dos dois lados

```text
## main...origin/main [ahead 1, behind 1]
```

Significa que o histórico divergiu. Uma opção é:

```bash
git pull --rebase origin main
```

Se houver conflitos, eles devem ser resolvidos antes do `push`.

## 10. Fluxo controlado recomendado

```bash
git fetch origin
git status --short --branch
```

Analise o resultado antes de integrar ou enviar alterações.

Quando for necessário integrar alterações remotas:

```bash
git pull --rebase origin main
```

Quando sua `main` local estiver pronta para ser enviada:

```bash
git push origin main
```
