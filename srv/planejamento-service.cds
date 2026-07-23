using {desafio.ordens as db} from '../db/schema';

service PlanejamentoService @(
    path    : '/planejamento',
    requires: 'authenticated-user'
) {

    @odata.draft.enabled
    entity Ordens                 as
        projection on db.Ordens {
            *, //Projete todos os campos de db.Ordens. Incluindo campos simples, associações e composições.
            virtual comRiscoEstoque : Boolean @title: 'Risco de Estoque'
        }
        actions {
            @Common.SideEffects: {
                TargetProperties: ['in/status_code'],
                TargetEntities  : [in.status]
            }
            action liberarOrdem()                                                                returns Ordens;
            @Common.SideEffects: {
                TargetProperties: [
                    'in/status_code',
                    'in/observacao',
                ],
                TargetEntities  : [in.status]
            }
            action cancelarOrdem(motivo: String(255) not null @title: 'Motivo do cancelamento' ) returns Ordens;
        };

    entity ReservasMateriais      as projection on db.ReservasMateriais;

    @cds.redirection.target
    entity ResponsabilidadesOrdem as projection on db.ResponsabilidadesOrdem;

    @readonly
    @cds.redirection.target: false
    entity OrdensLista            as projection on db.V_OrdensComResumo;

    @readonly
    @cds.redirection.target: false
    entity AcessosOrdem           as projection on db.V_AcessosOrdem;

    @odata.draft.enabled
    entity LotesLiberacao         as projection on db.LotesLiberacao
        actions {
            action processarLote() returns LotesLiberacao;
        };

    entity ItensLoteLiberacao     as projection on db.ItensLoteLiberacao;

    @readonly
    entity Usuarios               as projection on db.Usuarios;

    @readonly
    entity Centros                as projection on db.Centros;

    @readonly
    entity LocaisInstalacao       as projection on db.LocaisInstalacao;

    @readonly
    entity Depositos              as projection on db.Depositos;

    @readonly
    entity Materiais              as projection on db.Materiais;

    @readonly
    entity StatusOrdem            as projection on db.StatusOrdem;

    @readonly
    entity Prioridades            as projection on db.Prioridades;

    @readonly
    entity StatusLote             as projection on db.StatusLote;

    @readonly
    entity StatusItemLote         as projection on db.StatusItemLote;

}

//Não resolveu meu problema
/*
annotate PlanejamentoService.Ordens with @(Common.SideEffects #PeriodoPlanejado: {
  SourceProperties: [
    dataInicioPlanejada,
    dataFimPlanejada
  ],
  TargetProperties: [
    dataInicioPlanejada,
    dataFimPlanejada
  ]
});*/
