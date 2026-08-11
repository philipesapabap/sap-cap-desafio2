# Controle do peer review

| ID | Severidade | Status | Observações |
|---|---|---|---|
| F001 | 🟥 Alta | 🔵 Pendente | Item com erro pode consumir estoque e gravar movimento parcial. |
| F002 | 🟥 Alta | 🟢 Resolvido | Actions de liberação e cancelamento validam o acesso funcional à ordem. |
| F003 | 🟧 Média | 🔵 Pendente | Filtro de risco transforma expressões com `or` em interseção. |
| F004 | 🟧 Média | 🔵 Pendente | Cancelamento grava código inexistente na lista de status. |
| F005 | 🟧 Média | 🔵 Pendente | Lote usa `ERRO` em vez de `PROCESSADO_COM_ERRO`. |
| F006 | 🟧 Média | 🔵 Pendente | Draft e ativação aceitam `valorEstimado` negativo. |
| F007 | 🟨 Baixa | 🟢 Resolvido | Arquivo `.http` utiliza o endpoint correto `/planejamento`. |
| F008 | 🟨 Baixa | 🔵 Pendente | UI5 linter rejeita a versão dos dois manifests. |
| F009 | 🟧 Média | 🔵 Pendente | Patch do draft não valida o período completo. |
| F010 | 🟥 Alta | 🔵 Pendente | Escopo de leitura impede ativar um draft novo. |
| F011 | 🟧 Média | 🔵 Pendente | Processamento persiste, mas os itens permanecem desatualizados na Object Page. |
