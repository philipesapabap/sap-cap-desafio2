# Controle do peer review

| ID | Severidade | Status | Observações |
|---|---|---|---|
| F001 | 🟥 Alta | 🔵 Pendente | Item com erro pode consumir estoque e gravar movimento parcial. |
| F002 | 🟥 Alta | 🟢 Resolvido | Actions de liberação e cancelamento validam o acesso funcional à ordem. |
| F003 | 🟧 Média | 🔵 Pendente | Filtro de risco transforma expressões com `or` em interseção. |
| F004 | 🟧 Média | 🟢 Resolvido | O catálogo contém `CANCELADA` e a associação retorna o texto após o cancelamento. |
| F005 | 🟧 Média | 🟢 Resolvido | Lotes com falha assumem o status contratual `PROCESSADO_COM_ERRO`. |
| F006 | 🟧 Média | 🟢 Resolvido | Criação, edição e ativação rejeitam `valorEstimado` fora do intervalo permitido. |
| F007 | 🟨 Baixa | 🟢 Resolvido | Arquivo `.http` utiliza o endpoint correto `/planejamento`. |
| F008 | 🟨 Baixa | 🟢 Resolvido | Os dois manifests usam a Version 2 e passam no UI5 linter sem findings. |
| F009 | 🟧 Média | 🔵 Pendente | Patch do draft não valida o período completo. |
| F010 | 🟥 Alta | 🔵 Pendente | Escopo de leitura impede ativar um draft novo. |
| F011 | 🟧 Média | 🟢 Resolvido | A action solicita a releitura do status e dos itens após processar o lote. |
