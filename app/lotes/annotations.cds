using PlanejamentoService as service from '../../srv/planejamento-service';

annotate service.LotesLiberacao with @(
    UI.Identification            : [{
        $Type : 'UI.DataFieldForAction',
        Action: 'PlanejamentoService.processarLote',
        Label : 'Processar lote'
    }],
    UI.HeaderInfo                : {
        TypeName      : 'Lote',
        TypeNamePlural: 'Lotes',
        Title         : {Value: codigo},
        Description   : {Value: descricao},
    },
    UI.SelectionFields           : [
        codigo,
        descricao,
        status_code,
        solicitadoPor_matricula,
        createdAt
    ],
    UI.FieldGroup #GeneratedGroup: {
        $Type: 'UI.FieldGroupType',
        Data : [
            {
                $Type: 'UI.DataField',
                Label: 'Código',
                Value: codigo,
            },
            {
                $Type: 'UI.DataField',
                Label: 'Descrição',
                Value: descricao,
            },
            {
                $Type: 'UI.DataField',
                Label: 'Status',
                Value: status_code,
            },
            {
                $Type: 'UI.DataField',
                Label: 'Solicitante',
                Value: solicitadoPor_matricula,
            },
        ],
    },
    UI.Facets                    : [
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'GeneratedFacet1',
            Label : 'General Information',
            Target: '@UI.FieldGroup#GeneratedGroup',
        },

        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'Itens',
            Label : 'Ordens',
            Target: 'itens/@UI.LineItem'
        },
    ],
    UI.LineItem                  : [
        {
            $Type: 'UI.DataField',
            Label: 'Código',
            Value: codigo,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Descrição',
            Value: descricao,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Status',
            Value: status_code,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Solicitante',
            Value: solicitadoPor_matricula,
        },
    ],

);

annotate service.ItensLoteLiberacao with @(UI.LineItem: [
    {
        Value: ordem.codigo,
        Label: 'Ordem'
    },
    {
        Value: status_code,
        Label: 'Status'
    },
    {
        Value: mensagem,
        Label: 'Mensagem'
    },
    {
        Value: processado,
        Label: 'Processado'
    }
]);
