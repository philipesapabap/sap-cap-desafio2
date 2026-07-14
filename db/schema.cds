namespace desafio.ordens;

using {
    cuid,
    managed
} from '@sap/cds/common';

@cds.odata.valuelist
entity StatusOrdem {
    key code  : String(20);
        texto : String(80) not null;
}

@cds.odata.valuelist
entity Prioridades {
    key code  : String(10);
        texto : String(80) not null;
        peso  : Integer not null;
}

@cds.odata.valuelist
entity StatusLote {
    key code  : String(20);
        texto : String(80) not null;
}

@cds.odata.valuelist
entity StatusItemLote {
    key code  : String(20);
        texto : String(80) not null;
}

@cds.odata.valuelist
entity Usuarios {
    key matricula : String(20);
        nome      : String(100) not null;
        email     : String(120);
        ativo     : Boolean default true;
}

@cds.odata.valuelist
entity Centros : cuid {
    codigo : String(10) not null;
    nome   : String(80) not null;
}

@cds.odata.valuelist
entity LocaisInstalacao : cuid {
    codigo : String(40) not null;
    nome   : String(120) not null;
    centro : Association to Centros not null;
    ativo  : Boolean default true;
}

@cds.odata.valuelist
entity Depositos : cuid {
    codigo : String(10) not null;
    nome   : String(80) not null;
    centro : Association to Centros not null;
}

@cds.odata.valuelist
entity Materiais : cuid {
    codigo     : String(30) not null;
    descricao  : String(120) not null;
    unidade    : String(3) default 'UN';
    precoMedio : Decimal(13, 2) default 0;
    ativo      : Boolean default true;
}

entity Estoques : cuid, managed {
    material             : Association to Materiais not null;
    deposito             : Association to Depositos not null;
    quantidadeDisponivel : Decimal(13, 3) default 0;
    quantidadeReservada  : Decimal(13, 3) default 0;
}

entity Ordens : cuid, managed {
    codigo              : String(30) not null                         @title       : 'Código';
    descricao           : String(160) not null                        @title       : 'Descrição';
    centro              : Association to Centros not null             @title       : 'Centro';
    localInstalacao     : Association to LocaisInstalacao not null;
    responsavel         : Association to Usuarios not null;
    status              : Association to StatusOrdem default 'ABERTA' @Common.Label: 'Status da ordem';
    prioridade          : Association to Prioridades default 'MEDIA'  @Common.Label: 'Prioridade da ordem';
    dataInicioPlanejada : DateTime not null;
    dataFimPlanejada    : DateTime not null;
    valorEstimado       : Decimal(13, 2) default 0;
    observacao          : String(500);
    reservas            : Composition of many ReservasMateriais
                              on reservas.ordem = $self;
    responsabilidades   : Composition of many ResponsabilidadesOrdem
                              on responsabilidades.ordem = $self;
}

entity ReservasMateriais : cuid, managed {
    ordem                : Association to Ordens not null;
    material             : Association to Materiais not null;
    deposito             : Association to Depositos not null;
    quantidadeNecessaria : Decimal(13, 3) not null @assert.range: [
        0.001,
        100000
    ];
}

entity ResponsabilidadesOrdem : cuid {
    ordem   : Association to Ordens not null;
    usuario : Association to Usuarios not null;
    papel   : String(30) not null;
}

entity LotesLiberacao : cuid, managed {
    codigo        : String(30) not null;
    descricao     : String(160);
    status        : Association to StatusLote default 'ABERTO';
    solicitadoPor : Association to Usuarios;

    itens         : Composition of many ItensLoteLiberacao
                        on itens.lote = $self;
}

entity ItensLoteLiberacao : cuid, managed {
    lote       : Association to LotesLiberacao not null;
    ordem      : Association to Ordens not null;
    status     : Association to StatusItemLote default 'PENDENTE';
    mensagem   : String(500);
    processado : Boolean default false;
}

entity MovimentosEstoque : cuid, managed {
    ordem      : Association to Ordens;
    material   : Association to Materiais not null;
    deposito   : Association to Depositos not null;
    quantidade : Decimal(13, 3) not null;
    tipo       : String(20) not null;
    origem     : String(40);
}

view V_ReservasPorOrdem as
    select from ReservasMateriais as reserva {
        key reserva.ordem.ID as ordem_ID,
            cast(
                count( * ) as Integer
            )                as totalReservas,
            cast(
                sum(reserva.quantidadeNecessaria) as Decimal(13, 3)
            )                as quantidadeTotal
    }
    group by
        reserva.ordem.ID;

view V_AcessosOrdem as
    select from ResponsabilidadesOrdem as responsabilidade {
        key responsabilidade.ordem.ID          as ordem_ID,
        key responsabilidade.usuario.matricula as matricula,
            responsabilidade.papel             as papel
    };

view V_OrdensComResumo as
    select from Ordens as ordem
    left join V_ReservasPorOrdem as resumo
        on resumo.ordem_ID = ordem.ID
    {
        key ordem.ID,
            ordem.codigo,
            ordem.descricao,
            ordem.status.code            as statusCode,
            ordem.status.texto           as statusTexto,
            ordem.prioridade.code        as prioridadeCode,
            ordem.prioridade.texto       as prioridadeTexto,
            ordem.centro.codigo          as centroCodigo,
            ordem.centro.nome            as centroNome,
            ordem.localInstalacao.codigo as localInstalacaoCodigo,
            ordem.localInstalacao.nome   as localInstalacaoNome,
            ordem.responsavel.matricula  as responsavelMatricula,
            ordem.responsavel.nome       as responsavelNome,
            ordem.dataInicioPlanejada,
            ordem.dataFimPlanejada,
            ordem.valorEstimado,
            resumo.totalReservas,
            resumo.quantidadeTotal
    };
