using PlanejamentoService as service from '../../srv/planejamento-service';

annotate service.LotesLiberacao with @(
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
    UI.Facets                    : [{
        $Type : 'UI.ReferenceFacet',
        ID    : 'GeneratedFacet1',
        Label : 'General Information',
        Target: '@UI.FieldGroup#GeneratedGroup',
    }, ],
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
