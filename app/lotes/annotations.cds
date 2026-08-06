using PlanejamentoService as service from '../../srv/planejamento-service';

/*
 * Associa o código técnico do status ao seu texto traduzido.
 * O lote continua armazenando `ABERTO`, `PROCESSADO` ou `ERRO`, enquanto
 * o Fiori apresenta `Open`, `Processed` ou `Error` conforme o idioma.
 *
 * `ValueListWithFixedValues` permite apresentar a lista como dropdown.
 */
annotate service.LotesLiberacao : status with
@Common.Text                    : (status.texto)
@Common.TextArrangement         : #TextOnly
@Common.ValueListWithFixedValues: true;

/*
 * Informa que, na ajuda de valores de StatusLote, `texto` é a descrição
 * correspondente à chave técnica `code`.
 */
annotate service.StatusLote : code with
@Common.Text           : (texto)
@Common.TextArrangement: #TextOnly;

/*
 * Associa a matrícula técnica do solicitante ao seu nome.
 * O vínculo continua sendo feito por matrícula, mas o usuário visualiza
 * o nome correspondente.
 */
annotate service.LotesLiberacao : solicitadoPor with
@Common.Text           : (solicitadoPor.nome)
@Common.TextArrangement: #TextOnly;

/*
 * Define títulos amigáveis para as colunas apresentadas na ajuda
 * de pesquisa de usuários.
 */
annotate service.Usuarios : matricula with
@Common.Label: '{i18n>employeeNumber}';

annotate service.Usuarios : nome with
@Common.Label: '{i18n>userName}';

/*
 * Configura as colunas da ajuda de pesquisa do solicitante.
 *
 * A matrícula é o valor técnico devolvido ao lote. Nome e e-mail
 * são informações adicionais utilizadas para identificar o usuário.
 */
annotate service.LotesLiberacao : solicitadoPor with
@Common.ValueList: {
    CollectionPath: 'Usuarios',
    Parameters    : [
        {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: solicitadoPor_matricula,
            ValueListProperty: 'matricula'
        },
        {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'nome'
        }
    ]
};


annotate service.LotesLiberacao with @(
    UI.Identification            : [{
        $Type : 'UI.DataFieldForAction',
        Action: 'PlanejamentoService.processarLote',
        Label : '{i18n>processLot}'
    }],
    UI.HeaderInfo                : {
        TypeName      : '{i18n>lot}',
        TypeNamePlural: '{i18n>lots}',
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
                Label: '{i18n>code}',
                Value: codigo,
            },
            {
                $Type: 'UI.DataField',
                Label: '{i18n>description}',
                Value: descricao,
            },
            {
                $Type: 'UI.DataField',
                Label: '{i18n>status}',
                Value: status_code,
            },
            {
                $Type: 'UI.DataField',
                Label: '{i18n>requester}',
                Value: solicitadoPor_matricula,
            },
        ],
    },
    /*
     * Define as seções exibidas no corpo da Object Page do lote.
     *
     * A primeira facet apresenta os dados gerais definidos no FieldGroup.
     * A segunda utiliza a composição `itens` para gerar a tabela de ordens
     * pertencentes ao lote.
     */
    UI.Facets                    : [
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'DadosGerais',
            Label : '{i18n>generalData}',
            Target: '@UI.FieldGroup#GeneratedGroup'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'Itens',
            Label : '{i18n>orders}',
            Target: 'itens/@UI.LineItem'
        }
    ],
    UI.LineItem                  : [
        {
            $Type                : 'UI.DataField',
            Label                : '{i18n>code}',
            Value                : codigo,
            ![@HTML5.CssDefaults]: {width: '15%'}
        },
        {
            $Type                : 'UI.DataField',
            Label                : '{i18n>description}',
            Value                : descricao,
            ![@HTML5.CssDefaults]: {width: '40%'}
        },
        {
            $Type                : 'UI.DataField',
            Label                : '{i18n>status}',
            Value                : status.texto,
            ![@HTML5.CssDefaults]: {width: '20%'}
        },
        {
            $Type                : 'UI.DataField',
            Label                : '{i18n>requester}',
            Value                : solicitadoPor.nome,
            ![@HTML5.CssDefaults]: {width: '25%'}
        }
    ],
);

annotate service.ItensLoteLiberacao : status with
@Common.Text                    : (status.texto)
@Common.TextArrangement         : #TextOnly
@Common.ValueListWithFixedValues: true;

annotate service.StatusItemLote : code with
@Common.Text           : (texto)
@Common.TextArrangement: #TextOnly;

annotate service.ItensLoteLiberacao with @(UI.LineItem: [
    {
        Value                : ordem.codigo,
        Label                : '{i18n>order}',
        ![@HTML5.CssDefaults]: {width: '15%'}
    },
    {
        Value                : ordem.descricao,
        Label                : '{i18n>description}',
        ![@HTML5.CssDefaults]: {width: '35%'}
    },
    {
        Value                : status.texto,
        Label                : '{i18n>status}',
        ![@HTML5.CssDefaults]: {width: '15%'}
    },
    {
        Value                : mensagemExibicao,
        Label                : '{i18n>message}',
        ![@HTML5.CssDefaults]: {width: '25%'}
    },
    {
        Value                : processado,
        Label                : '{i18n>processed}',
        ![@HTML5.CssDefaults]: {width: '10%'}
    }
]);
