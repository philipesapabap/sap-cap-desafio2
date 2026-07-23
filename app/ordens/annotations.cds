using PlanejamentoService as service from '../../srv/planejamento-service';

annotate service.Ordens with @(
    UI.Identification          : [
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'PlanejamentoService.liberarOrdem',
            Label : 'Liberar ordem'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'PlanejamentoService.cancelarOrdem',
            Label : 'Cancelar ordem'
        },
    ],

    UI.HeaderInfo              : {
        TypeName      : 'Ordem',
        TypeNamePlural: 'Ordens',
        Title         : {Value: codigo},
        Description   : {Value: descricao}
    }, //Aplica na Object Page

    UI.SelectionFields         : [
        codigo,
        centro_ID,
        //Status_code não existe, é uma foreign kays gerada pelo CAP,
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
