# Controle do peer review

## Status utilizados

- 🔵 Pendente: o finding ainda não recebeu tratamento suficiente.
- 🟠 Parcialmente resolvido: parte comprovável do finding foi corrigida, mas ainda existe trabalho transferido ou pendente.
- 🟢 Resolvido: o comportamento esperado foi implementado e validado.
- 🟡 Won't fix: foi decidido que o finding não será corrigido.
- ⚪ Inexistente: a revisão concluiu que o finding não existe.

| ID | Severidade | Status | Observações |
|---|---|---|---|
| F001 | 🟥 Alta | 🟢 Resolvido | Cada ordem valida todos os saldos bloqueados antes de persistir estoques, movimentos e status. |
| F002 | 🟥 Alta | 🟢 Resolvido | Liberação exige EXECUTOR e cancelamento exige SUPERVISOR, inclusive para administradores. |
| F003 | 🟧 Média | 🟢 Resolvido | A comparação virtual é substituída na posição original e preserva `and`, `or` e agrupamentos. |
| F004 | 🟧 Média | 🟢 Resolvido | O catálogo contém `CANCELADA` e a associação retorna o texto após o cancelamento. |
| F005 | 🟧 Média | 🟢 Resolvido | Lotes com falha assumem o status contratual `PROCESSADO_COM_ERRO`. |
| F006 | 🟧 Média | 🟢 Resolvido | Criação, edição e ativação rejeitam `valorEstimado` fora do intervalo permitido. |
| F007 | 🟨 Baixa | 🟢 Resolvido | Arquivo `.http` utiliza o endpoint correto `/planejamento`. |
| F008 | 🟨 Baixa | 🟢 Resolvido | Os dois manifests usam a Version 2 e passam no UI5 linter sem findings. |
| F009 | 🟧 Média | 🟢 Resolvido | O PATCH combina o delta com o draft persistido e rejeita períodos inválidos com HTTP 400. |
| F010 | 🟥 Alta | 🟢 Resolvido | A ativação cria as responsabilidades iniciais e mantém a nova ordem visível ao criador e ao responsável principal. |
| F011 | 🟧 Média | 🟢 Resolvido | A action solicita a releitura do status e dos itens após processar o lote. |
