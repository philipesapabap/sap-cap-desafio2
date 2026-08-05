using PlanejamentoService as service from '../../srv/planejamento-service';

annotate service.Ordens with @(
    // Identifica as principais informações e ações em uma Object Page
    UI.Identification          : [
        {
            // Informa ao Fiori Elements que o elemento deve ser apresentado como uma ação
            $Type : 'UI.DataFieldForAction',
            // Ao clicar na action, o frotend chama a action CAP indicada em Action
            Action: 'PlanejamentoService.liberarOrdem',
            Label : 'Liberar ordem'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'PlanejamentoService.cancelarOrdem',
            Label : 'Cancelar ordem'
        },
    ],

    // Configura o cabeçalho principal da Object Page
    UI.HeaderInfo              : {
        // Nome de um único registro
        TypeName      : 'Ordem',
        // Nome da coleção
        TypeNamePlural: 'Ordens',
        // Título principal da página
        Title         : {Value: codigo},
        // Texto abaixo ou próximo ao título
        Description   : {Value: descricao}
    },

    // Define quais campos aparecem inicialmente na barra de filtros do List Report
    // Essa anotação não define as colunas da tabela. Ela define somente os filtros principais.
    UI.SelectionFields         : [
        codigo,
        centro_ID,
        //Status_code não existe, é uma foreign keys gerada pelo CAP,
        //Não elementos CDS reais no momento em que o annotate service.Ordens with {...} é processado
        //Gerado na transformação do OData
        status_code,
        //Prioridade_code não existe, é uma foreign kays gerada pelo CAP,
        //Não elementos CDS reais no momento em que o annotate service.Ordens with {...} é processado
        //Gerado na transformação do OData
        prioridade_code,
        //Não vem de association nem é foreign key gerada
        //É um campo virtual declarado explicitamente na projection do serviço
        //srv/planejamento-service
        //entity Ordens as projection on db.Ordens{...}
        comRiscoEstoque
    ],
    // Agrupa campos relacionados para exibição conjunta, principalmente na Object Page
    // # É o qualificador/identificador do grupo
    // Qualificador do grupo: Dados Gerias
    UI.FieldGroup #DadosGerais : {
        $Type: 'UI.FieldGroupType',
        Data : [
            {
                Value: codigo,
                Label: 'Ordem'
            },
            {
                Value: descricao,
                Label: 'Descrição'
            },
            {
                Value: centro_ID,
                Label: 'Centro'
            },
            {
                Value: localInstalacao_ID,
                Label: 'Local de instalação'
            },
            {
                Value: responsavel_matricula,
                Label: 'Responsável'
            },
            {
                Value: status_code,
                Label: 'Status'
            },
            {
                Value: prioridade_code,
                Label: 'Prioridade'
            }
        ]
    },
    // Identificador do grupo: Planejamento
    UI.FieldGroup #Planejamento: {
        $Type: 'UI.FieldGroupType',
        Data : [
            {
                Value: dataInicioPlanejada,
                Label: 'Início planejado'
            },
            {
                Value: dataFimPlanejada,
                Label: 'Fim planejado'
            },
            {
                Value: valorEstimado,
                Label: 'Valor estimado'
            },
            {
                Value: observacao,
                Label: 'Observação'
            }
        ]
    },
    // Define as sessões e subsessões da Object Page
    // Os dois primeiros apontam para FieldGroup's em Target
    // Já a sessão Reservas aponta para uma assossiação em Target
    // Portanto, essa facet deve gerar uma tabela(UI.LineItem) de reservas dento da Object Page
    // Cada item possui $Type: tipo do elemento visual
    UI.Facets                  : [
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'DadosGerais',
            Label : 'Dados Gerais',
            Target: '@UI.FieldGroup#DadosGerais',
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'Planejamento',
            Label : 'Planejamento',
            Target: '@UI.FieldGroup#Planejamento'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'Reservas',
            Label : 'Reservas',
            Target: 'reservas/@UI.LineItem'
        },
    ],
    // Define as colunas da tabela principal de ordens no List Report
    UI.LineItem                : [
        {
            $Type: 'UI.DataField',
            Label: 'Ordem',
            Value: codigo,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Descrição',
            Value: descricao,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Centro',
            Value: centro.codigo,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Local',
            Value: localInstalacao.codigo,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Responsável',
            Value: responsavel.nome,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Status',
            Value: status.texto
        },
        {
            $Type: 'UI.DataField',
            Label: 'Prioridade',
            Value: prioridade.texto,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Início',
            Value: dataInicioPlanejada,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Fim',
            Value: dataFimPlanejada,
        },
    ],
);

// Define as colunas da tabela de reservas
// Esse é exatamente o LineItem acessado pelo facet -> Target: 'reservas/@UI.LineItem'
annotate service.ReservasMateriais with @(UI.LineItem: [
    {
        Value: material_ID,
        Label: 'Material'
    },
    {
        Value: deposito_ID,
        Label: 'Depósito'
    },
    {
        Value: quantidadeNecessaria,
        Label: 'Quantidade'
    }
]);
