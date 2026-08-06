using PlanejamentoService as service from '../../srv/planejamento-service';


/*
 * Configura a apresentação do status no contexto da entidade Ordens.
 *
 * `status` é uma associação gerenciada para StatusOrdem. Como a chave da
 * entidade de destino é `code`, o CAP gera no OData a chave estrangeira
 * `status_code`.
 *
 * A annotation `Common.Text` informa que o texto associado ao código deve
 * ser obtido por meio do caminho `status.texto`. Portanto, uma ordem continua
 * armazenando e filtrando pelo código técnico, como `ABERTA`, mas o Fiori pode
 * apresentar o texto localizado, como `Aberta` ou `Open`.
 *
 * `TextOnly` solicita que a interface apresente somente o texto, sem exibir
 * o código técnico junto dele.
 *
 * `ValueListWithFixedValues` informa que a ajuda de valores possui uma lista
 * pequena e fixa, permitindo que a interface a apresente como um dropdown.
 */
annotate service.Ordens : status with
@Common.Text                    : (status.texto)
@Common.TextArrangement         : #TextOnly
@Common.ValueListWithFixedValues: true;

/*
 * Configura a apresentação da chave na entidade usada pela ajuda de valores.
 *
 * A ajuda de valores/pesquisa de status consulta `PlanejamentoService.StatusOrdem`.
 * Nessa entidade, `code` é a chave técnica selecionada e `texto` é sua
 * descrição localizada.
 *
 * Esta annotation informa ao Fiori que `texto` é a descrição correspondente
 * ao campo `code`. Assim, a ajuda pode apresentar `Aberta` em português ou
 * `Open` em inglês, enquanto devolve `ABERTA` como valor técnico para o filtro
 * `Ordens.status_code`.
 */
annotate service.StatusOrdem : code with
@Common.Text           : (texto)
@Common.TextArrangement: #TextOnly;

annotate service.Ordens : prioridade with
@Common.Text                    : (prioridade.texto)
@Common.TextArrangement         : #TextOnly
@Common.ValueListWithFixedValues: true;

annotate service.Prioridades : code with
@Common.Text           : (texto)
@Common.TextArrangement: #TextOnly;

/*
 * Oculta o UUID técnico na ajuda de valores de centros.
 * O ID continua sendo usado internamente para vincular a ordem ao centro,
 * mas somente o código e o nome são apresentados ao usuário.
 */
annotate service.Centros : ID with
@UI.Hidden: true;

annotate service.Centros with {
    codigo @title: '{i18n>code}';
    nome   @title: '{i18n>centerName}';
};

/*
 * Apresenta o código do centro acompanhado do seu nome.
 * O código permanece como referência operacional e o nome facilita
 * a identificação do centro pelo usuário.
 * #TextLast  significa: código (texto)
 * #TextFirst significa: texto (código)
 */
annotate service.Centros : codigo with
@Common.Text           : (nome)
@Common.TextArrangement: #TextLast;

/*
 * Apresenta o código do local de instalação acompanhado do seu nome.
 * O UUID técnico continua sendo utilizado internamente, mas não é
 * mostrado na interface.
 */
annotate service.LocaisInstalacao : codigo with
@Common.Text           : (nome)
@Common.TextArrangement: #TextLast;

annotate service.Ordens with @(
    // Identifica as principais informações e ações em uma Object Page
    UI.Identification          : [
        {
            // Informa ao Fiori Elements que o elemento deve ser apresentado como uma ação
            $Type : 'UI.DataFieldForAction',
            // Ao clicar na action, o frotend chama a action CAP indicada em Action
            Action: 'PlanejamentoService.liberarOrdem',
            Label : '{i18n>releaseOrder}'
        },
        {
            $Type : 'UI.DataFieldForAction',

            Action: 'PlanejamentoService.cancelarOrdem',
            Label : '{i18n>cancelOrder}'
        },
    ],

    // Configura o cabeçalho principal da Object Page
    UI.HeaderInfo              : {
        // Nome de um único registro
        TypeName      : '{i18n>order}',
        // Nome da coleção
        TypeNamePlural: '{i18n>orders}',
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
                Label: '{i18n>order}'
            },
            {
                Value: descricao,
                Label: '{i18n>description}'
            },
            {
                Value: centro.codigo,
                Label: '{i18n>center}'
            },
            {
                Value: localInstalacao.codigo,
                Label: '{i18n>installationLocation}'
            },
            {
                Value: responsavel.nome,
                Label: '{i18n>responsible}'
            },
            {
                Value: status_code,
                Label: '{i18n>status}'
            },
            {
                Value: prioridade_code,
                Label: '{i18n>priority}'
            }
        ]
    },
    // Identificador do grupo: Planejamento
    UI.FieldGroup #Planejamento: {
        $Type: 'UI.FieldGroupType',
        Data : [
            {
                Value: dataInicioPlanejada,
                Label: '{i18n>plannedStart}'
            },
            {
                Value: dataFimPlanejada,
                Label: '{i18n>plannedEnd}'
            },
            {
                Value: valorEstimado,
                Label: '{i18n>estimatedValue}'
            },
            {
                Value: observacao,
                Label: '{i18n>observation}'
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
            Label : '{i18n>generalData}',
            Target: '@UI.FieldGroup#DadosGerais',
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'Planejamento',
            Label : '{i18n>planning}',
            Target: '@UI.FieldGroup#Planejamento'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'Reservas',
            Label : '{i18n>reservations}',
            Target: 'reservas/@UI.LineItem'
        },
    ],
    // Define as colunas da tabela principal de ordens no List Report
    UI.LineItem                : [
        {
            $Type: 'UI.DataField',
            Label: '{i18n>order}',
            Value: codigo,
        },
        {
            $Type: 'UI.DataField',
            Label: '{i18n>description}',
            Value: descricao,
        },
        {
            $Type: 'UI.DataField',
            Label: '{i18n>center}',
            Value: centro.codigo,
        },
        {
            $Type: 'UI.DataField',
            Label: '{i18n>location}',
            Value: localInstalacao.codigo,
        },
        {
            $Type: 'UI.DataField',
            Label: '{i18n>responsible}',
            Value: responsavel.nome,
        },
        {
            $Type: 'UI.DataField',
            Label: '{i18n>status}',
            Value: status.texto
        },
        {
            $Type: 'UI.DataField',
            Label: '{i18n>priority}',
            Value: prioridade.texto,
        },
        {
            $Type: 'UI.DataField',
            Label: '{i18n>start}',
            Value: dataInicioPlanejada,
        },
        {
            $Type: 'UI.DataField',
            Label: '{i18n>end}',
            Value: dataFimPlanejada,
        },
    ],
);

// Define as colunas da tabela de reservas
// Esse é exatamente o LineItem acessado pelo facet -> Target: 'reservas/@UI.LineItem'
annotate service.ReservasMateriais with @(UI.LineItem: [
    {
        Value                : material.codigo,
        Label                : '{i18n>material}',
        ![@HTML5.CssDefaults]: {width: '10%'}
    },
    {
        Value                : material.descricao,
        Label                : '{i18n>description}',
        ![@HTML5.CssDefaults]: {width: '24%'}
    },
    {
        Value                : material.unidade,
        Label                : '{i18n>unit}',
        ![@HTML5.CssDefaults]: {width: '6%'}
    },
    {
        Value                : deposito.codigo,
        Label                : '{i18n>warehouse}',
        ![@HTML5.CssDefaults]: {width: '10%'}
    },
    {
        Value                : deposito.nome,
        Label                : '{i18n>warehouseName}',
        ![@HTML5.CssDefaults]: {width: '18%'}
    },
    {
        Value                : quantidadeNecessaria,
        Label                : '{i18n>requestedQuantity}',
        ![@HTML5.CssDefaults]: {width: '12%'}
    },
    {
        Value                : quantidadeDisponivel,
        Label                : '{i18n>availableQuantity}',
        ![@HTML5.CssDefaults]: {width: '10%'}
    },
    {
        $Type                : 'UI.DataField',
        Value                : situacaoEstoque,
        Label                : '{i18n>stockSituation}',
        Criticality          : criticidadeSituacaoEstoque,
        ![@HTML5.CssDefaults]: {width: '10%'}
    }
]);
