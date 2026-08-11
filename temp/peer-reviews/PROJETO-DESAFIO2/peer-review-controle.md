# Controle do peer review

## Status utilizados

- 🔵 Pendente: o finding ainda não recebeu tratamento suficiente.
- 🟠 Parcialmente resolvido: parte comprovável do finding foi corrigida, mas ainda existe trabalho transferido ou pendente.
- 🟢 Resolvido: o comportamento esperado foi implementado e validado.
- 🟡 Won't fix: foi decidido que o finding não será corrigido.
- ⚪ Inexistente: a revisão concluiu que o finding não existe.

| ID | Severidade | Status | Observações |
|---|---|---|---|
| F001 | 🟥 Alta | 🔵 Pendente | Item com erro pode consumir estoque e gravar movimento parcial. |
| F002 | 🟥 Alta | 🟢 Resolvido | Actions de liberação e cancelamento validam o acesso funcional à ordem. |
| F003 | 🟧 Média | 🟢 Resolvido | A comparação virtual é substituída na posição original e preserva `and`, `or` e agrupamentos. |
| F004 | 🟧 Média | 🟢 Resolvido | O catálogo contém `CANCELADA` e a associação retorna o texto após o cancelamento. |
| F005 | 🟧 Média | 🟢 Resolvido | Lotes com falha assumem o status contratual `PROCESSADO_COM_ERRO`. |
| F006 | 🟧 Média | 🟢 Resolvido | Criação, edição e ativação rejeitam `valorEstimado` fora do intervalo permitido. |
| F007 | 🟨 Baixa | 🟢 Resolvido | Arquivo `.http` utiliza o endpoint correto `/planejamento`. |
| F008 | 🟨 Baixa | 🟢 Resolvido | Os dois manifests usam a Version 2 e passam no UI5 linter sem findings. |
| F009 | 🟧 Média | 🟢 Resolvido | O PATCH combina o delta com o draft persistido e rejeita períodos inválidos com HTTP 400. |
| F010 | 🟥 Alta | 🟠 Parcialmente resolvido | O criador voltou a acessar o próprio draft; a conclusão da ativação foi transferida para uma Change Request do Desafio 3. |
| F011 | 🟧 Média | 🟢 Resolvido | A action solicita a releitura do status e dos itens após processar o lote. |
