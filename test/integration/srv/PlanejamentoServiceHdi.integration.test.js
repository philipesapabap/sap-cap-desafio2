/**
 * Integração HTTP com o SAP HANA Cloud/HDI do PlanejamentoService.
 *
 * Execução:
 *
 *     npm run test:integration:hdi
 *
 * A suíte fica desabilitada no `npm test`. Quando habilitada, usa o binding do
 * profile `hybrid`, grava fixtures sintéticas no HDI e remove tudo ao final.
 *
 * Teste 1 - confirma o HANA, a carga inicial e as views implantadas.
 * Teste 2 - serializa duas liberações concorrentes da mesma ordem.
 * Teste 3 - impede consumo concorrente acima do saldo compartilhado.
 * Teste 4 - reverte integralmente uma liberação individual sem saldo.
 * Teste 5 - mantém atomicidade da ordem que falha dentro do lote.
 * Teste 6 - preserva a semântica de `or` no filtro virtual no HANA.
 * Teste 7 - resolve o domínio do status após cancelar uma ordem.
 * Teste 8 - usa o status contratual quando o lote termina com erro.
 */

const assert = require("node:assert/strict");
const cds = require("@sap/cds");
const { expect } = cds.test;
const { DELETE, INSERT, SELECT } = cds.ql;

const RUN = process.env.RUN_PLANEJAMENTO_HDI_INTEGRATION === "true";
const describeIntegration = RUN ? describe : describe.skip;
const SERVICE_URL = "/planejamento";
const AUTH = Object.freeze({
  admin: { auth: { username: "admin", password: "admin" } },
});
const IDS = Object.freeze({
  center: "c9000000-0000-4000-a000-000000000001",
  location: "c9000000-0000-4000-a000-000000000002",
  deposit: "c9000000-0000-4000-a000-000000000003",
  materialA: "a9000000-0000-4000-a000-000000000001",
  materialB: "a9000000-0000-4000-a000-000000000002",
  stockA: "e9000000-0000-4000-a000-000000000001",
  stockB: "e9000000-0000-4000-a000-000000000002",
  sameOrder: "f9000000-0000-4000-a000-000000000001",
  competingA: "f9000000-0000-4000-a000-000000000002",
  competingB: "f9000000-0000-4000-a000-000000000003",
  rollback: "f9000000-0000-4000-a000-000000000004",
  batchPartial: "f9000000-0000-4000-a000-000000000005",
  risk: "f9000000-0000-4000-a000-000000000006",
  cancel: "f9000000-0000-4000-a000-000000000007",
  batchError: "f9000000-0000-4000-a000-000000000008",
  lotPartial: "d9000000-0000-4000-a000-000000000001",
  lotError: "d9000000-0000-4000-a000-000000000002",
});
const ORDER_IDS = Object.freeze([
  IDS.sameOrder,
  IDS.competingA,
  IDS.competingB,
  IDS.rollback,
  IDS.batchPartial,
  IDS.risk,
  IDS.cancel,
  IDS.batchError,
]);
const LOT_IDS = Object.freeze([IDS.lotPartial, IDS.lotError]);

describeIntegration("PlanejamentoService — integração com HANA/HDI", () => {
  const test = cds.test("serve", "--project", __dirname + "/../../..");
  const { GET, POST } = test;

  let db;
  let entities;

  before(async () => {
    test.axios.defaults.auth = AUTH.admin.auth;
    db = await cds.connect.to("db");

    if (db.kind !== "hana") {
      throw new Error(
        `A suíte HDI exige db.kind "hana"; recebido "${db.kind}".`,
      );
    }

    entities = cds.entities("desafio.ordens");
    await cleanupFixtures();
  });

  beforeEach(async () => {
    await cleanupFixtures();
    await seedMasterData();
  });

  after(async () => {
    if (db && entities) {
      await cleanupFixtures();
    }
  });

  /**
   * Dado: a aplicação iniciada pelo profile `hybrid` e vinculada ao HDI.
   * Quando: consultamos usuários da carga inicial e a view `OrdensLista` pela API.
   * Então: o adapter ativo é HANA, os usuários existem e a view responde HTTP 200.
   * Por quê: os demais cenários só são válidos se binding, deploy, dados e views estiverem prontos.
   */
  it("confirma o HANA, a carga inicial e as views implantadas", async () => {
    const users = await SELECT.from(entities.Usuarios)
      .columns("matricula")
      .where({ matricula: { in: ["100001", "100002"] } });
    const { data, status } = await GET(
      `${SERVICE_URL}/OrdensLista?$select=ID&$top=1`,
      AUTH.admin,
    );

    expect(db.kind).to.equal("hana");
    expect(users).to.have.length(2);
    expect(status).to.equal(200);
    expect(data.value).to.be.an("array");
  });

  /**
   * Dado: uma ordem aberta com uma reserva de duas unidades e estoque inicial dez.
   * Quando: duas requisições tentam liberar exatamente a mesma ordem ao mesmo tempo.
   * Então: uma conclui com 200, outra com 409, e apenas um movimento reduz o saldo para oito.
   * Por quê: o bloqueio pessimista deve impedir dupla liberação em processos concorrentes.
   */
  it("serializa duas liberações concorrentes da mesma ordem", async () => {
    await insertOrders([
      buildOrder(IDS.sameOrder, "HDI-MESMA-ORDEM"),
    ]);
    await insertReservations([
      buildReservation(
        "b9000000-0000-4000-a000-000000000001",
        IDS.sameOrder,
        IDS.materialA,
        2,
      ),
    ]);

    const results = await Promise.allSettled([
      POST(actionUrl("Ordens", IDS.sameOrder, "liberarOrdem"), {}, AUTH.admin),
      POST(actionUrl("Ordens", IDS.sameOrder, "liberarOrdem"), {}, AUTH.admin),
    ]);
    const stock = await SELECT.one.from(entities.Estoques, IDS.stockA);
    const order = await SELECT.one.from(entities.Ordens, IDS.sameOrder);
    const movements = await SELECT.from(entities.MovimentosEstoque).where({
      ordem_ID: IDS.sameOrder,
    });

    expect(httpStatuses(results)).to.deep.equal([200, 409]);
    expect(Number(stock.quantidadeDisponivel)).to.equal(8);
    expect(order.status_code).to.equal("LIBERADA");
    expect(movements).to.have.length(1);
  });

  /**
   * Dado: duas ordens distintas disputando sete unidades de um estoque com saldo dez.
   * Quando: ambas são liberadas concorrentemente.
   * Então: apenas uma vence, o saldo termina em três e somente um movimento é criado.
   * Por quê: o lock deve proteger o recurso de estoque, não apenas o registro da ordem.
   */
  it("impede consumo concorrente acima do saldo compartilhado", async () => {
    await insertOrders([
      buildOrder(IDS.competingA, "HDI-CONCORRENTE-A"),
      buildOrder(IDS.competingB, "HDI-CONCORRENTE-B"),
    ]);
    await insertReservations([
      buildReservation(
        "b9000000-0000-4000-a000-000000000002",
        IDS.competingA,
        IDS.materialA,
        7,
      ),
      buildReservation(
        "b9000000-0000-4000-a000-000000000003",
        IDS.competingB,
        IDS.materialA,
        7,
      ),
    ]);

    const results = await Promise.allSettled([
      POST(actionUrl("Ordens", IDS.competingA, "liberarOrdem"), {}, AUTH.admin),
      POST(actionUrl("Ordens", IDS.competingB, "liberarOrdem"), {}, AUTH.admin),
    ]);
    const stock = await SELECT.one.from(entities.Estoques, IDS.stockA);
    const orders = await SELECT.from(entities.Ordens)
      .columns("status_code")
      .where({ ID: { in: [IDS.competingA, IDS.competingB] } });
    const movements = await SELECT.from(entities.MovimentosEstoque).where({
      ordem_ID: { in: [IDS.competingA, IDS.competingB] },
    });

    expect(httpStatuses(results)).to.deep.equal([200, 409]);
    expect(Number(stock.quantidadeDisponivel)).to.equal(3);
    expect(orders.filter(({ status_code }) => status_code === "LIBERADA")).to.have.length(1);
    expect(orders.filter(({ status_code }) => status_code === "ABERTA")).to.have.length(1);
    expect(movements).to.have.length(1);
  });

  /**
   * Dado: uma ordem com duas reservas; a primeira tem saldo e a segunda não.
   * Quando: a liberação individual percorre as reservas dentro da mesma transação.
   * Então: recebe 409 e nenhum saldo, estado ou movimento permanece alterado.
   * Por quê: no fluxo individual, lançar o erro deve provocar rollback integral no HANA.
   */
  it("reverte integralmente uma liberação individual sem saldo", async () => {
    await insertOrders([buildOrder(IDS.rollback, "HDI-ROLLBACK")]);
    await insertReservations([
      buildReservation(
        "b9000000-0000-4000-a000-000000000004",
        IDS.rollback,
        IDS.materialA,
        2,
      ),
      buildReservation(
        "b9000000-0000-4000-a000-000000000005",
        IDS.rollback,
        IDS.materialB,
        3,
      ),
    ]);

    await expectRequestError(
      POST(actionUrl("Ordens", IDS.rollback, "liberarOrdem"), {}, AUTH.admin),
      409,
      "Estoque insuficiente",
    );

    const stockA = await SELECT.one.from(entities.Estoques, IDS.stockA);
    const stockB = await SELECT.one.from(entities.Estoques, IDS.stockB);
    const order = await SELECT.one.from(entities.Ordens, IDS.rollback);
    const movements = await SELECT.from(entities.MovimentosEstoque).where({
      ordem_ID: IDS.rollback,
    });

    expect(Number(stockA.quantidadeDisponivel)).to.equal(10);
    expect(Number(stockB.quantidadeDisponivel)).to.equal(1);
    expect(order.status_code).to.equal("ABERTA");
    expect(movements).to.have.length(0);
  });

  /**
   * Dado: um item de lote cuja ordem possui uma reserva atendida e outra sem saldo.
   * Quando: o lote captura a falha funcional dessa ordem para continuar o processamento.
   * Então: o item fica em `ERRO`, mas nenhum consumo ou movimento parcial pode sobreviver.
   * Por quê: capturar o erro não deve confirmar mutações feitas antes da reserva que falhou.
   */
  it("mantém atomicidade da ordem que falha dentro do lote", async () => {
    await insertOrders([buildOrder(IDS.batchPartial, "HDI-LOTE-PARCIAL")]);
    await insertReservations([
      buildReservation(
        "b9000000-0000-4000-a000-000000000006",
        IDS.batchPartial,
        IDS.materialA,
        2,
      ),
      buildReservation(
        "b9000000-0000-4000-a000-000000000007",
        IDS.batchPartial,
        IDS.materialB,
        3,
      ),
    ]);
    await insertLot(
      IDS.lotPartial,
      IDS.batchPartial,
      "d9000000-0000-4000-a000-000000000011",
    );

    await POST(
      actionUrl("LotesLiberacao", IDS.lotPartial, "processarLote"),
      {},
      AUTH.admin,
    );

    const stockA = await SELECT.one.from(entities.Estoques, IDS.stockA);
    const order = await SELECT.one.from(entities.Ordens, IDS.batchPartial);
    const movements = await SELECT.from(entities.MovimentosEstoque).where({
      ordem_ID: IDS.batchPartial,
    });
    const [item] = await SELECT.from(entities.ItensLoteLiberacao).where({
      lote_ID: IDS.lotPartial,
    });

    expect(item.status_code).to.equal("ERRO");
    expect(order.status_code).to.equal("ABERTA");
    expect(Number(stockA.quantidadeDisponivel)).to.equal(10);
    expect(movements).to.have.length(0);
  });

  /**
   * Dado: uma ordem em risco cujo código satisfaz o segundo operando de um filtro `or`.
   * Quando: o handler substitui `comRiscoEstoque` por uma expressão executável no HANA.
   * Então: a ordem deve aparecer porque basta um dos operandos ser verdadeiro.
   * Por quê: confirma que a reescrita CQN preserva a árvore lógica no banco-alvo.
   */
  it("preserva a semântica de or no filtro virtual no HANA", async () => {
    await insertOrders([buildOrder(IDS.risk, "HDI-RISCO")]);
    await insertReservations([
      buildReservation(
        "b9000000-0000-4000-a000-000000000008",
        IDS.risk,
        IDS.materialB,
        3,
      ),
    ]);
    const filter = encodeURIComponent(
      "comRiscoEstoque eq false or codigo eq 'HDI-RISCO'",
    );

    const { data, status } = await GET(
      `${SERVICE_URL}/Ordens?$select=ID&$filter=${filter}`,
      AUTH.admin,
    );
    const returnedIds = data.value.map(({ ID }) => ID);

    expect(status).to.equal(200);
    expect(returnedIds).to.include(IDS.risk);
  });

  /**
   * Dado: uma ordem aberta persistida no HDI.
   * Quando: ela é cancelada e relida expandindo a associação `status`.
   * Então: o código `CANCELADA` precisa encontrar seu registro na entidade de domínio.
   * Por quê: a UI usa essa associação para exibir texto e ajuda de valores do estado.
   */
  it("resolve o domínio do status após cancelar uma ordem", async () => {
    await insertOrders([buildOrder(IDS.cancel, "HDI-CANCELAR")]);

    const action = await POST(
      actionUrl("Ordens", IDS.cancel, "cancelarOrdem"),
      { motivo: "Validação HDI" },
      AUTH.admin,
    );
    const read = await GET(
      `${orderUrl(IDS.cancel)}?$select=status_code&$expand=status`,
      AUTH.admin,
    );

    expect(action.status).to.equal(200);
    expect(action.data.status_code).to.equal("CANCELADA");
    assert.notEqual(read.data.status, null, "O domínio CANCELADA deve existir");
    expect(read.data.status.code).to.equal("CANCELADA");
  });

  /**
   * Dado: um lote com uma ordem que não possui estoque suficiente.
   * Quando: o processamento termina com erro funcional no item.
   * Então: o lote retornado deve assumir `PROCESSADO_COM_ERRO`.
   * Por quê: valida no HANA o mesmo código público definido pela especificação do serviço.
   */
  it("usa o status contratual quando o lote termina com erro", async () => {
    await insertOrders([buildOrder(IDS.batchError, "HDI-LOTE-ERRO")]);
    await insertReservations([
      buildReservation(
        "b9000000-0000-4000-a000-000000000009",
        IDS.batchError,
        IDS.materialB,
        3,
      ),
    ]);
    await insertLot(
      IDS.lotError,
      IDS.batchError,
      "d9000000-0000-4000-a000-000000000012",
    );

    const { data, status } = await POST(
      actionUrl("LotesLiberacao", IDS.lotError, "processarLote"),
      {},
      AUTH.admin,
    );

    expect(status).to.equal(200);
    expect(data.status_code).to.equal("PROCESSADO_COM_ERRO");
  });

  async function seedMasterData() {
    await db.run(
      INSERT.into(entities.Centros).entries({
        ID: IDS.center,
        codigo: "HC01",
        nome: "Centro HDI",
      }),
    );
    await db.run(
      INSERT.into(entities.LocaisInstalacao).entries({
        ID: IDS.location,
        codigo: "HL01",
        nome: "Local HDI",
        centro_ID: IDS.center,
        ativo: true,
      }),
    );
    await db.run(
      INSERT.into(entities.Depositos).entries({
        ID: IDS.deposit,
        codigo: "HD01",
        nome: "Depósito HDI",
        centro_ID: IDS.center,
      }),
    );
    await db.run(
      INSERT.into(entities.Materiais).entries([
        buildMaterial(IDS.materialA, "HM-A"),
        buildMaterial(IDS.materialB, "HM-B"),
      ]),
    );
    await db.run(
      INSERT.into(entities.Estoques).entries([
        buildStock(IDS.stockA, IDS.materialA, 10),
        buildStock(IDS.stockB, IDS.materialB, 1),
      ]),
    );
  }

  async function insertOrders(entries) {
    await db.run(INSERT.into(entities.Ordens).entries(entries));
  }

  async function insertReservations(entries) {
    await db.run(INSERT.into(entities.ReservasMateriais).entries(entries));
  }

  async function insertLot(lotId, orderId, itemId) {
    await db.run(
      INSERT.into(entities.LotesLiberacao).entries({
        ID: lotId,
        codigo: `HDI-${lotId.slice(1, 5)}`,
        descricao: "Lote de integração HDI",
        status_code: "ABERTO",
        solicitadoPor_matricula: "100001",
      }),
    );
    await db.run(
      INSERT.into(entities.ItensLoteLiberacao).entries({
        ID: itemId,
        lote_ID: lotId,
        ordem_ID: orderId,
        status_code: "PENDENTE",
        processado: false,
      }),
    );
  }

  async function cleanupFixtures() {
    if (!db || !entities) {
      return;
    }

    await db.run(
      DELETE.from(entities.MovimentosEstoque).where({
        ordem_ID: { in: ORDER_IDS },
      }),
    );
    await db.run(
      DELETE.from(entities.ItensLoteLiberacao).where({
        lote_ID: { in: LOT_IDS },
      }),
    );
    await db.run(
      DELETE.from(entities.LotesLiberacao).where({ ID: { in: LOT_IDS } }),
    );
    await db.run(
      DELETE.from(entities.ResponsabilidadesOrdem).where({
        ordem_ID: { in: ORDER_IDS },
      }),
    );
    await db.run(
      DELETE.from(entities.ReservasMateriais).where({
        ordem_ID: { in: ORDER_IDS },
      }),
    );
    await db.run(
      DELETE.from(entities.Ordens).where({ ID: { in: ORDER_IDS } }),
    );
    await db.run(
      DELETE.from(entities.Estoques).where({
        ID: { in: [IDS.stockA, IDS.stockB] },
      }),
    );
    await db.run(
      DELETE.from(entities.Materiais).where({
        ID: { in: [IDS.materialA, IDS.materialB] },
      }),
    );
    await db.run(
      DELETE.from(entities.LocaisInstalacao).where({ ID: IDS.location }),
    );
    await db.run(DELETE.from(entities.Depositos).where({ ID: IDS.deposit }));
    await db.run(DELETE.from(entities.Centros).where({ ID: IDS.center }));
  }

  function buildOrder(ID, codigo) {
    return {
      ID,
      codigo,
      descricao: codigo,
      centro_ID: IDS.center,
      localInstalacao_ID: IDS.location,
      responsavel_matricula: "100001",
      status_code: "ABERTA",
      prioridade_code: "MEDIA",
      dataInicioPlanejada: "2026-08-10T08:00:00Z",
      dataFimPlanejada: "2026-08-10T10:00:00Z",
      valorEstimado: 100,
    };
  }

  function buildMaterial(ID, codigo) {
    return {
      ID,
      codigo,
      descricao: codigo,
      unidade: "UN",
      precoMedio: 10,
      ativo: true,
    };
  }

  function buildStock(ID, material_ID, quantidadeDisponivel) {
    return {
      ID,
      material_ID,
      deposito_ID: IDS.deposit,
      quantidadeDisponivel,
      quantidadeReservada: 0,
    };
  }

  function buildReservation(ID, ordem_ID, material_ID, quantidadeNecessaria) {
    return {
      ID,
      ordem_ID,
      material_ID,
      deposito_ID: IDS.deposit,
      quantidadeNecessaria,
    };
  }

  function actionUrl(entity, ID, action) {
    return `${SERVICE_URL}/${entity}(ID=${ID},IsActiveEntity=true)/${action}`;
  }

  function orderUrl(ID) {
    return `${SERVICE_URL}/Ordens(ID=${ID},IsActiveEntity=true)`;
  }

  function httpStatuses(results) {
    return results
      .map((result) =>
        result.status === "fulfilled"
          ? result.value.status
          : result.reason?.response?.status,
      )
      .sort((left, right) => left - right);
  }

  async function expectRequestError(request, expectedStatus, expectedMessage) {
    try {
      const response = await request;
      expect.fail(`Esperado HTTP ${expectedStatus}; recebido ${response.status}.`);
    } catch (error) {
      if (!error.response) {
        throw error;
      }

      expect(error.response.status).to.equal(expectedStatus);
      expect(error.response.data?.error?.message).to.include(expectedMessage);
    }
  }
});
