/**
 * Como rodar apenas esta suíte:
 *
 *     npx cds test test/integration/srv/PlanejamentoService.integration.test.js
 *
 * Teste 1 - limita a lista ao usuário responsável.
 * Teste 2 - permite ao administrador listar todas as ordens.
 * Teste 3 - filtra ordens com risco de estoque.
 * Teste 4 - filtra ordens sem risco de estoque.
 * Teste 5 - preserva a semântica de `or` no filtro virtual.
 * Teste 6 - rejeita período inválido na criação do draft.
 * Teste 7 - rejeita período inválido no patch do draft.
 * Teste 8 - rejeita valor estimado negativo.
 * Teste 9 - ativa um draft válido.
 * Teste 10 - rejeita valor estimado negativo na ativação do draft.
 * Teste 11 - libera ordem válida e movimenta estoque.
 * Teste 12 - rejeita estoque duplicado para material e depósito.
 * Teste 13 - considera o consumo acumulado de reservas do mesmo estoque.
 * Teste 14 - rejeita liberação de ordem inexistente.
 * Teste 15 - rejeita liberação de ordem não aberta.
 * Teste 16 - rejeita liberação sem reservas.
 * Teste 17 - reverte liberação individual sem estoque.
 * Teste 18 - rejeita liberação sem acesso.
 * Teste 19 - rejeita cancelamento sem acesso.
 * Teste 20 - exige motivo no cancelamento.
 * Teste 21 - cancela ordem e resolve o texto do status.
 * Teste 22 - rejeita cancelamento de ordem não aberta.
 * Teste 23 - rejeita cancelamento de ordem inexistente.
 * Teste 24 - processa lote integralmente válido.
 * Teste 25 - continua lote após falha funcional de um item.
 * Teste 26 - usa o status contratual para lote com erro.
 * Teste 27 - mantém atomicidade do item que falha no lote.
 * Teste 28 - rejeita lote já processado.
 * Teste 29 - rejeita lote aberto sem itens pendentes.
 * Teste 30 - rejeita lote inexistente.
 */

const cds = require("@sap/cds");
const assert = require("node:assert/strict");
const { expect } = cds.test;
const { DELETE, INSERT, SELECT, UPDATE } = cds.ql;

const SERVICE_URL = "/planejamento";
const USERS = Object.freeze({
  authorized: "TEST1001",
  other: "TEST1002",
});
const AUTH = Object.freeze({
  authorized: { auth: { username: USERS.authorized, password: "dev" } },
  other: { auth: { username: USERS.other, password: "dev" } },
  admin: { auth: { username: "admin", password: "admin" } },
});

cds.env.requires.auth = {
  ...cds.env.requires.auth,
  kind: "mocked",
  users: {
    ...cds.env.requires.auth?.users,
    [USERS.authorized]: { password: "dev", roles: ["authenticated-user"] },
    [USERS.other]: { password: "dev", roles: ["authenticated-user"] },
  },
};

const test = cds.test(
  "serve",
  "--project",
  __dirname + "/../../..",
  "--in-memory",
);
const { GET, POST, PATCH } = test;
const IDS = Object.freeze({
  center: "c1000000-0000-4000-a000-000000000001",
  location: "c2000000-0000-4000-a000-000000000001",
  deposit: "d1000000-0000-4000-a000-000000000001",
  materialA: "a1000000-0000-4000-a000-000000000001",
  materialB: "a2000000-0000-4000-a000-000000000001",
  materialC: "a3000000-0000-4000-a000-000000000001",
  stockA: "e1000000-0000-4000-a000-000000000001",
  stockB: "e2000000-0000-4000-a000-000000000001",
  stockC: "e3000000-0000-4000-a000-000000000001",
  stockDuplicate: "e4000000-0000-4000-a000-000000000001",
  success: "f1000000-0000-4000-a000-000000000001",
  risk: "f2000000-0000-4000-a000-000000000002",
  withoutReservations: "f3000000-0000-4000-a000-000000000003",
  otherUser: "f4000000-0000-4000-a000-000000000004",
  released: "f5000000-0000-4000-a000-000000000005",
  successSecond: "f6000000-0000-4000-a000-000000000006",
  partial: "f7000000-0000-4000-a000-000000000007",
  repeatedStock: "f8000000-0000-4000-a000-000000000008",
  draftPeriod: "d1000000-0000-4000-a000-000000000001",
  draftNegative: "d2000000-0000-4000-a000-000000000002",
  draftValid: "d3000000-0000-4000-a000-000000000003",
  draftNegativeActivation: "d4000000-0000-4000-a000-000000000004",
  lotSuccess: "a8000000-0000-4000-a000-000000000001",
  lotMixed: "a8000000-0000-4000-a000-000000000002",
  lotPartial: "a8000000-0000-4000-a000-000000000003",
  lotProcessed: "a8000000-0000-4000-a000-000000000004",
  lotNoPending: "a8000000-0000-4000-a000-000000000005",
  missing: "ffffffff-ffff-4fff-afff-ffffffffffff",
});

describe("PlanejamentoService — fluxos HTTP com SQLite", () => {
  let db;
  let entities;

  before(async () => {
    test.axios.defaults.auth = AUTH.admin.auth;
    test.axios.defaults.headers.common["Accept-Language"] = "pt";
    db = await cds.connect.to("db");
    entities = cds.entities("desafio.ordens");
  });

  beforeEach(async () => {
    await cleanupFixtures();
    await seedFixtures();
  });

  after(async () => {
    if (db) {
      await cleanupFixtures();
    }
  });

  /**
   * Dado: duas ordens de teste atribuídas a usuários diferentes.
   * Quando: o usuário comum consulta a coleção `Ordens`.
   * Então: ele enxerga sua ordem, mas não a ordem do outro usuário.
   * Por quê: valida o recorte de dados aplicado pelo controle de responsabilidade.
   */
  it("limita a lista ao usuário responsável", async () => {
    const { data, status } = await GET(
      `${SERVICE_URL}/Ordens?$select=ID&$filter=startswith(codigo,'T-')`,
      AUTH.authorized,
    );
    const returnedIds = data.value.map(({ ID }) => ID);

    expect(status).to.equal(200);
    expect(returnedIds).to.include(IDS.success);
    expect(returnedIds).to.not.include(IDS.otherUser);
  });

  /**
   * Dado: o mesmo conjunto de ordens pertencentes a usuários diferentes.
   * Quando: um usuário com papel `admin` consulta a coleção.
   * Então: todas as ordens de teste ficam visíveis.
   * Por quê: administradores precisam ignorar o recorte aplicado aos responsáveis.
   */
  it("permite ao administrador listar todas as ordens", async () => {
    const { data, status } = await GET(
      `${SERVICE_URL}/Ordens?$select=ID&$filter=startswith(codigo,'T-')`,
      AUTH.admin,
    );
    const returnedIds = data.value.map(({ ID }) => ID);

    expect(status).to.equal(200);
    expect(returnedIds).to.include(IDS.success);
    expect(returnedIds).to.include(IDS.otherUser);
  });

  /**
   * Dado: uma ordem atendida pelo estoque e outra com quantidade insuficiente.
   * Quando: a API recebe `$filter=comRiscoEstoque eq true`.
   * Então: somente a ordem com insuficiência é retornada.
   * Por quê: comprova a tradução do campo virtual para uma subconsulta de estoque.
   */
  it("filtra ordens com risco de estoque", async () => {
    const filter = encodeURIComponent("comRiscoEstoque eq true");
    const { data, status } = await GET(
      `${SERVICE_URL}/Ordens?$select=ID&$filter=${filter}`,
      AUTH.authorized,
    );
    const returnedIds = data.value.map(({ ID }) => ID);

    expect(status).to.equal(200);
    expect(returnedIds).to.include(IDS.risk);
    expect(returnedIds).to.not.include(IDS.success);
  });

  /**
   * Dado: ordens com e sem saldo suficiente para suas reservas.
   * Quando: a API recebe `$filter=comRiscoEstoque eq false`.
   * Então: inclui a ordem atendida e exclui a ordem em risco.
   * Por quê: também é necessário validar a negação da regra virtual.
   */
  it("filtra ordens sem risco de estoque", async () => {
    const filter = encodeURIComponent("comRiscoEstoque eq false");
    const { data, status } = await GET(
      `${SERVICE_URL}/Ordens?$select=ID&$filter=${filter}`,
      AUTH.authorized,
    );
    const returnedIds = data.value.map(({ ID }) => ID);

    expect(status).to.equal(200);
    expect(returnedIds).to.include(IDS.success);
    expect(returnedIds).to.not.include(IDS.risk);
  });

  /**
   * Dado: um filtro que combina o campo virtual e o código por meio de `or`.
   * Quando: uma ordem atende somente ao segundo operando.
   * Então: ela ainda deve aparecer no resultado.
   * Por quê: trocar `or` por `and` durante a transformação muda o contrato OData.
   */
  it("preserva a semântica de or no filtro virtual", async () => {
    const filter = encodeURIComponent(
      "comRiscoEstoque eq false or codigo eq 'T-RISCO'",
    );
    const { data, status } = await GET(
      `${SERVICE_URL}/Ordens?$select=ID&$filter=${filter}`,
      AUTH.authorized,
    );
    const returnedIds = data.value.map(({ ID }) => ID);

    expect(status).to.equal(200);
    expect(returnedIds).to.include(IDS.risk);
  });

  /**
   * Dado: um novo draft cujo início planejado ocorre após o fim.
   * Quando: o cliente tenta criar a ordem.
   * Então: a API responde 400 com a mensagem da regra de período.
   * Por quê: drafts também devem ser validados desde sua primeira persistência.
   */
  it("rejeita período inválido na criação do draft", async () => {
    await expectRequestError(
      POST(
        `${SERVICE_URL}/Ordens`,
        buildDraftPayload(IDS.draftPeriod, {
          dataInicioPlanejada: "2026-08-10T12:00:00Z",
          dataFimPlanejada: "2026-08-10T10:00:00Z",
        }),
        AUTH.authorized,
      ),
      400,
      "Período planejado inválido",
    );
  });

  /**
   * Dado: um draft inicialmente válido já persistido.
   * Quando: um `PATCH` antecipa o fim para antes do início.
   * Então: a alteração deve ser rejeitada com HTTP 400.
   * Por quê: uma atualização parcial não pode contornar a validação da criação.
   */
  it("rejeita período inválido no patch do draft", async () => {
    await POST(
      `${SERVICE_URL}/Ordens`,
      buildDraftPayload(IDS.draftPeriod),
      AUTH.authorized,
    );

    await expectRequestError(
      PATCH(
        orderUrl(IDS.draftPeriod, false),
        { dataFimPlanejada: "2026-08-10T07:00:00Z" },
        AUTH.authorized,
      ),
      400,
      "Período planejado inválido",
    );
  });

  /**
   * Dado: um payload de draft com `valorEstimado` negativo.
   * Quando: a ordem é criada.
   * Então: a API deve rejeitar o valor com HTTP 400.
   * Por quê: o domínio aceita somente custos estimados maiores ou iguais a zero.
   */
  it("rejeita valor estimado negativo", async () => {
    await expectRequestError(
      POST(
        `${SERVICE_URL}/Ordens`,
        buildDraftPayload(IDS.draftNegative, { valorEstimado: -10 }),
        AUTH.authorized,
      ),
      400,
      "Valor estimado",
    );
  });

  /**
   * Dado: um draft completo e válido pertencente ao usuário autenticado.
   * Quando: a action padrão `draftActivate` é executada.
   * Então: nasce a entidade ativa e `IsActiveEntity` passa a ser `true`.
   * Por quê: valida o ciclo principal de criação usado pelo Fiori elements.
   */
  it("ativa um draft válido", async () => {
    await POST(
      `${SERVICE_URL}/Ordens`,
      buildDraftPayload(IDS.draftValid),
      AUTH.authorized,
    );

    const { data, status } = await POST(
      `${orderUrl(IDS.draftValid, false)}/PlanejamentoService.draftActivate`,
      {},
      AUTH.authorized,
    );

    expect(status).to.equal(201);
    expect(data.ID).to.equal(IDS.draftValid);
    expect(data.IsActiveEntity).to.equal(true);
  });

  /**
   * Dado: um draft que contém valor estimado negativo.
   * Quando: o administrador tenta ativá-lo.
   * Então: a ativação deve falhar com HTTP 400.
   * Por quê: a validação final protege o banco mesmo se um draft inválido já existir.
   */
  it("rejeita valor estimado negativo na ativação do draft", async () => {
    await POST(
      `${SERVICE_URL}/Ordens`,
      buildDraftPayload(IDS.draftNegativeActivation),
      AUTH.admin,
    );

    // Simula um draft inválido preexistente sem passar pela API, pois a
    // validação de CREATE já impede que um valor negativo seja informado.
    await db.run(
      UPDATE("PlanejamentoService.Ordens.drafts")
        .set({ valorEstimado: -10 })
        .where({ ID: IDS.draftNegativeActivation }),
    );

    await expectRequestError(
      POST(
        `${orderUrl(IDS.draftNegativeActivation, false)}/PlanejamentoService.draftActivate`,
        {},
        AUTH.admin,
      ),
      400,
      "Valor estimado",
    );
  });

  /**
   * Dado: uma ordem aberta, acessível e com saldo para todas as reservas.
   * Quando: a action `liberarOrdem` é chamada.
   * Então: a ordem vira `LIBERADA`, os saldos diminuem e dois movimentos são criados.
   * Por quê: este é o caminho feliz completo da principal regra de negócio.
   */
  it("libera ordem válida e movimenta estoque", async () => {
    const { data, status } = await POST(
      actionUrl("Ordens", IDS.success, "liberarOrdem"),
      {},
      AUTH.authorized,
    );
    const stockA = await SELECT.one.from(entities.Estoques, IDS.stockA);
    const stockB = await SELECT.one.from(entities.Estoques, IDS.stockB);
    const movements = await SELECT.from(entities.MovimentosEstoque).where({
      ordem_ID: IDS.success,
    });

    expect(status).to.equal(200);
    expect(data.status_code).to.equal("LIBERADA");
    expect(Number(stockA.quantidadeDisponivel)).to.equal(8);
    expect(Number(stockB.quantidadeDisponivel)).to.equal(4);
    expect(movements).to.have.length(2);
  });

  /**
   * Dado: um estoque já cadastrado para determinada combinação de material e depósito.
   * Quando: outro registro tenta usar a mesma combinação com um UUID diferente.
   * Então: o banco rejeita a duplicidade e mantém somente o estoque original.
   * Por quê: cada chave usada no saldo projetado precisa representar uma única linha física.
   */
  it("rejeita estoque duplicado para material e depósito", async () => {
    await assert.rejects(
      db.run(
        INSERT.into(entities.Estoques).entries(
          buildStock(IDS.stockDuplicate, IDS.materialA, 99),
        ),
      ),
    );

    const estoques = await SELECT.from(entities.Estoques).where({
      material_ID: IDS.materialA,
      deposito_ID: IDS.deposit,
    });

    expect(estoques).to.have.length(1);
    expect(estoques[0].ID).to.equal(IDS.stockA);
  });

  /**
   * Dado: uma ordem com duas reservas de seis unidades sobre o mesmo saldo dez.
   * Quando: a regra simula o consumo acumulado antes de persistir.
   * Então: a liberação falha, o estoque permanece dez e nenhum movimento é criado.
   * Por quê: validar cada reserva isoladamente aprovaria incorretamente um total de doze.
   */
  it("considera o consumo acumulado de reservas do mesmo estoque", async () => {
    await db.run(
      INSERT.into(entities.Ordens).entries(
        buildOrder(IDS.repeatedStock, "T-SALDO-ACUMULADO", USERS.authorized),
      ),
    );
    await db.run(
      INSERT.into(entities.ReservasMateriais).entries([
        buildReservation(
          "b8000000-0000-4000-a000-000000000001",
          IDS.repeatedStock,
          IDS.materialA,
          6,
        ),
        buildReservation(
          "b8000000-0000-4000-a000-000000000002",
          IDS.repeatedStock,
          IDS.materialA,
          6,
        ),
      ]),
    );

    await expectRequestError(
      POST(
        actionUrl("Ordens", IDS.repeatedStock, "liberarOrdem"),
        {},
        AUTH.admin,
      ),
      409,
      "Estoque insuficiente",
    );

    const estoque = await SELECT.one.from(entities.Estoques, IDS.stockA);
    const ordem = await SELECT.one.from(entities.Ordens, IDS.repeatedStock);
    const movimentos = await SELECT.from(entities.MovimentosEstoque).where({
      ordem_ID: IDS.repeatedStock,
    });

    expect(Number(estoque.quantidadeDisponivel)).to.equal(10);
    expect(Number(estoque.quantidadeReservada)).to.equal(0);
    expect(ordem.status_code).to.equal("ABERTA");
    expect(movimentos).to.have.length(0);
  });

  /**
   * Dado: um UUID válido que não corresponde a nenhuma ordem.
   * Quando: o administrador solicita sua liberação.
   * Então: a API responde 404 com mensagem de ordem não encontrada.
   * Por quê: diferencia ausência do recurso de conflitos de estado ou autorização.
   */
  it("rejeita liberação de ordem inexistente", async () => {
    await expectRequestError(
      POST(actionUrl("Ordens", IDS.missing, "liberarOrdem"), {}, AUTH.admin),
      404,
      "Ordem não encontrada",
    );
  });

  /**
   * Dado: uma ordem que já está no estado `LIBERADA`.
   * Quando: a action de liberação é repetida.
   * Então: a API responde 409 e mantém o estado existente.
   * Por quê: evita baixar estoque duas vezes por repetição da mesma operação.
   */
  it("rejeita liberação de ordem não aberta", async () => {
    await expectRequestError(
      POST(
        actionUrl("Ordens", IDS.released, "liberarOrdem"),
        {},
        AUTH.authorized,
      ),
      409,
      "não está aberta",
    );

    const order = await SELECT.one.from(entities.Ordens, IDS.released);
    expect(order.status_code).to.equal("LIBERADA");
  });

  /**
   * Dado: uma ordem aberta que não possui reservas de materiais.
   * Quando: o usuário tenta liberá-la.
   * Então: a API responde 409 informando a ausência das reservas.
   * Por quê: liberar sem itens impediria qualquer validação ou movimento de estoque.
   */
  it("rejeita liberação sem reservas", async () => {
    await expectRequestError(
      POST(
        actionUrl("Ordens", IDS.withoutReservations, "liberarOrdem"),
        {},
        AUTH.authorized,
      ),
      409,
      "não possui reservas",
    );
  });

  /**
   * Dado: uma ordem cuja reserva exige mais material que o saldo disponível.
   * Quando: a liberação individual é processada.
   * Então: responde 409, preserva o saldo e não cria movimentos.
   * Por quê: comprova o rollback da transação quando a regra de estoque falha.
   */
  it("reverte liberação individual sem estoque", async () => {
    await expectRequestError(
      POST(actionUrl("Ordens", IDS.risk, "liberarOrdem"), {}, AUTH.authorized),
      409,
      "Estoque insuficiente",
    );
    const stock = await SELECT.one.from(entities.Estoques, IDS.stockC);
    const movements = await SELECT.from(entities.MovimentosEstoque).where({
      ordem_ID: IDS.risk,
    });

    expect(Number(stock.quantidadeDisponivel)).to.equal(1);
    expect(movements).to.have.length(0);
  });

  /**
   * Dado: uma ordem atribuída a outro responsável.
   * Quando: um usuário comum tenta executar `liberarOrdem` diretamente pela URL.
   * Então: a API responde 403.
   * Por quê: actions precisam repetir a autorização, não apenas esconder registros no `READ`.
   */
  it("rejeita liberação sem acesso", async () => {
    await expectRequestError(
      POST(actionUrl("Ordens", IDS.success, "liberarOrdem"), {}, AUTH.other),
      403,
      "autorização",
    );
  });

  /**
   * Dado: uma ordem aberta atribuída a outro responsável.
   * Quando: um usuário comum tenta executar `cancelarOrdem` diretamente pela URL.
   * Então: a API responde 403 e mantém a ordem aberta.
   * Por quê: ocultar a ordem no READ não impede uma chamada direta à action.
   */
  it("rejeita cancelamento sem acesso", async () => {
    await expectRequestError(
      POST(
        actionUrl("Ordens", IDS.success, "cancelarOrdem"),
        { motivo: "Tentativa sem autorização" },
        AUTH.other,
      ),
      403,
      "autorização",
    );

    const ordem = await SELECT.one
      .from(entities.Ordens)
      .columns("status_code", "observacao")
      .where({ ID: IDS.success });

    expect(ordem.status_code).to.equal("ABERTA");
    expect(ordem.observacao == null).to.equal(true);
  });

  /**
   * Dado: uma ordem aberta e acessível.
   * Quando: `cancelarOrdem` é chamada sem o parâmetro obrigatório `motivo`.
   * Então: o runtime rejeita a chamada com HTTP 400.
   * Por quê: todo cancelamento deve conservar uma justificativa auditável.
   */
  it("exige motivo no cancelamento", async () => {
    await expectRequestError(
      POST(
        actionUrl("Ordens", IDS.success, "cancelarOrdem"),
        {},
        AUTH.authorized,
      ),
      400,
      "missing value",
    );
  });

  /**
   * Dado: uma ordem aberta e um motivo de cancelamento válido.
   * Quando: a action cancela a ordem e ela é relida com `$expand=status`.
   * Então: código, observação e texto `Cancelada` devem estar disponíveis.
   * Por quê: gravar apenas um código sem domínio deixa a UI sem descrição do estado.
   */
  it("cancela ordem e resolve o texto do status", async () => {
    const action = await POST(
      actionUrl("Ordens", IDS.success, "cancelarOrdem"),
      { motivo: "Teste automatizado" },
      AUTH.authorized,
    );
    const read = await GET(
      `${orderUrl(IDS.success, true)}?$select=status_code,observacao&$expand=status`,
      AUTH.authorized,
    );

    expect(action.status).to.equal(200);
    expect(action.data.status_code).to.equal("CANCELADA");
    expect(read.data.observacao).to.include("Teste automatizado");
    assert.notEqual(
      read.data.status,
      null,
      "O status CANCELADA deve resolver a associação de domínio",
    );
    expect(read.data.status.code).to.equal("CANCELADA");
    expect(read.data.status.texto).to.equal("Cancelada");
  });

  /**
   * Dado: uma ordem que já se encontra liberada.
   * Quando: o usuário tenta cancelá-la.
   * Então: a API responde 409 por transição de estado inválida.
   * Por quê: somente ordens abertas podem seguir para o estado cancelado.
   */
  it("rejeita cancelamento de ordem não aberta", async () => {
    await expectRequestError(
      POST(
        actionUrl("Ordens", IDS.released, "cancelarOrdem"),
        { motivo: "Não permitido" },
        AUTH.authorized,
      ),
      409,
      "não está aberta",
    );
  });

  /**
   * Dado: um UUID sem ordem correspondente.
   * Quando: `cancelarOrdem` é executada por um administrador.
   * Então: a API responde 404.
   * Por quê: mantém o contrato de recurso inexistente também na action de cancelamento.
   */
  it("rejeita cancelamento de ordem inexistente", async () => {
    await expectRequestError(
      POST(
        actionUrl("Ordens", IDS.missing, "cancelarOrdem"),
        { motivo: "Inexistente" },
        AUTH.admin,
      ),
      404,
      "Ordem não encontrada",
    );
  });

  /**
   * Dado: um lote aberto com dois itens pendentes e ordens liberáveis.
   * Quando: a action `processarLote` é executada.
   * Então: o lote vira `PROCESSADO` e ambos os itens terminam com `SUCESSO`.
   * Por quê: valida o caminho feliz e a consolidação do resultado do lote.
   */
  it("processa lote integralmente válido", async () => {
    const { data, status } = await POST(
      actionUrl("LotesLiberacao", IDS.lotSuccess, "processarLote"),
      {},
      AUTH.authorized,
    );
    const items = await SELECT.from(entities.ItensLoteLiberacao).where({
      lote_ID: IDS.lotSuccess,
    });

    expect(status).to.equal(200);
    expect(data.status_code).to.equal("PROCESSADO");
    expect(items).to.have.length(2);
    expect(
      items.every(({ status_code }) => status_code === "SUCESSO"),
    ).to.equal(true);
  });

  /**
   * Dado: um lote misto com uma ordem válida e outra sem estoque suficiente.
   * Quando: o lote é processado.
   * Então: um item termina em `SUCESSO`, outro em `ERRO`, e ambos são marcados processados.
   * Por quê: falhas funcionais são isoladas por item e não interrompem o restante do lote.
   */
  it("continua lote após falha funcional de um item", async () => {
    const { status } = await POST(
      actionUrl("LotesLiberacao", IDS.lotMixed, "processarLote"),
      {},
      AUTH.authorized,
    );
    const items = await SELECT.from(entities.ItensLoteLiberacao).where({
      lote_ID: IDS.lotMixed,
    });
    const successItem = items.find(({ ordem_ID }) => ordem_ID === IDS.success);
    const errorItem = items.find(({ ordem_ID }) => ordem_ID === IDS.risk);

    expect(status).to.equal(200);
    expect(successItem.status_code).to.equal("SUCESSO");
    expect(Boolean(successItem.processado)).to.equal(true);
    expect(errorItem.status_code).to.equal("ERRO");
    expect(Boolean(errorItem.processado)).to.equal(true);
    expect(errorItem.mensagem).to.include("Estoque insuficiente");
  });

  /**
   * Dado: um lote que conclui com pelo menos um item em erro.
   * Quando: o processamento termina e devolve o lote atualizado.
   * Então: o estado agregado deve ser `PROCESSADO_COM_ERRO`.
   * Por quê: consumidores dependem do código definido no contrato da especificação.
   */
  it("usa o status contratual para lote com erro", async () => {
    const { data, status } = await POST(
      actionUrl("LotesLiberacao", IDS.lotMixed, "processarLote"),
      {},
      AUTH.authorized,
    );

    expect(status).to.equal(200);
    expect(data.status_code).to.equal("PROCESSADO_COM_ERRO");
  });

  /**
   * Dado: uma ordem do lote com duas reservas, mas saldo insuficiente na segunda.
   * Quando: o item é tentado e termina com `ERRO`.
   * Então: a primeira reserva também não consome saldo nem gera movimento.
   * Por quê: todas as reservas da ordem precisam ser atendidas antes de sua liberação.
   */
  it("mantém atomicidade do item que falha no lote", async () => {
    const stockBefore = await SELECT.one.from(entities.Estoques, IDS.stockA);

    await POST(
      actionUrl("LotesLiberacao", IDS.lotPartial, "processarLote"),
      {},
      AUTH.authorized,
    );

    const stockAfter = await SELECT.one.from(entities.Estoques, IDS.stockA);
    const order = await SELECT.one.from(entities.Ordens, IDS.partial);
    const movements = await SELECT.from(entities.MovimentosEstoque).where({
      ordem_ID: IDS.partial,
    });
    const [item] = await SELECT.from(entities.ItensLoteLiberacao).where({
      lote_ID: IDS.lotPartial,
    });

    expect(item.status_code).to.equal("ERRO");
    expect(order.status_code).to.equal("ABERTA");
    expect(Number(stockAfter.quantidadeDisponivel)).to.equal(
      Number(stockBefore.quantidadeDisponivel),
    );
    expect(movements).to.have.length(0);
  });

  /**
   * Dado: um lote cujo estado já é `PROCESSADO`.
   * Quando: o usuário tenta executar `processarLote` novamente.
   * Então: recebe 409 e o item permanece pendente, sem mutações colaterais.
   * Por quê: impede reprocessamento acidental e possível consumo duplicado de estoque.
   */
  it("rejeita lote já processado", async () => {
    await expectRequestError(
      POST(
        actionUrl("LotesLiberacao", IDS.lotProcessed, "processarLote"),
        {},
        AUTH.authorized,
      ),
      409,
      "já foi processado",
    );

    const [item] = await SELECT.from(entities.ItensLoteLiberacao).where({
      lote_ID: IDS.lotProcessed,
    });
    expect(item.status_code).to.equal("PENDENTE");
    expect(Boolean(item.processado)).to.equal(false);
  });

  /**
   * Dado: um lote aberto, porém sem qualquer item elegível como `PENDENTE`.
   * Quando: sua action de processamento é chamada.
   * Então: a API responde 409.
   * Por quê: um lote sem trabalho pendente não deve simular processamento bem-sucedido.
   */
  it("rejeita lote aberto sem itens pendentes", async () => {
    await expectRequestError(
      POST(
        actionUrl("LotesLiberacao", IDS.lotNoPending, "processarLote"),
        {},
        AUTH.authorized,
      ),
      409,
      "não possui itens pendentes",
    );
  });

  /**
   * Dado: um UUID que não identifica nenhum lote persistido.
   * Quando: o administrador tenta processá-lo.
   * Então: a API responde 404 com mensagem de lote não encontrado.
   * Por quê: fecha o contrato de erro básico da action de lote.
   */
  it("rejeita lote inexistente", async () => {
    await expectRequestError(
      POST(
        actionUrl("LotesLiberacao", IDS.missing, "processarLote"),
        {},
        AUTH.admin,
      ),
      404,
      "Lote não encontrado",
    );
  });

  async function cleanupFixtures() {
    const orderIds = [
      IDS.success,
      IDS.risk,
      IDS.withoutReservations,
      IDS.otherUser,
      IDS.released,
      IDS.successSecond,
      IDS.partial,
      IDS.repeatedStock,
      IDS.draftPeriod,
      IDS.draftNegative,
      IDS.draftValid,
      IDS.draftNegativeActivation,
    ];
    const lotIds = [
      IDS.lotSuccess,
      IDS.lotMixed,
      IDS.lotPartial,
      IDS.lotProcessed,
      IDS.lotNoPending,
    ];

    await db.run(
      DELETE.from(entities.MovimentosEstoque).where({
        ordem_ID: { in: orderIds },
      }),
    );
    await db.run(
      DELETE.from(entities.ItensLoteLiberacao).where({
        lote_ID: { in: lotIds },
      }),
    );
    await db.run(
      DELETE.from(entities.LotesLiberacao).where({ ID: { in: lotIds } }),
    );
    await db.run(
      DELETE.from(entities.ResponsabilidadesOrdem).where({
        ordem_ID: { in: orderIds },
      }),
    );
    await db.run(
      DELETE.from(entities.ReservasMateriais).where({
        ordem_ID: { in: orderIds },
      }),
    );
    await db.run(DELETE.from(entities.Ordens).where({ ID: { in: orderIds } }));
    await db.run(
      DELETE.from(entities.Estoques).where({
        ID: {
          in: [IDS.stockA, IDS.stockB, IDS.stockC, IDS.stockDuplicate],
        },
      }),
    );
    await db.run(
      DELETE.from(entities.Materiais).where({
        ID: { in: [IDS.materialA, IDS.materialB, IDS.materialC] },
      }),
    );
    await db.run(
      DELETE.from(entities.LocaisInstalacao).where({ ID: IDS.location }),
    );
    await db.run(DELETE.from(entities.Depositos).where({ ID: IDS.deposit }));
    await db.run(DELETE.from(entities.Centros).where({ ID: IDS.center }));
    await db.run(
      DELETE.from(entities.Usuarios).where({
        matricula: { in: Object.values(USERS) },
      }),
    );
  }

  async function seedFixtures() {
    await db.run(
      INSERT.into(entities.Usuarios).entries([
        {
          matricula: USERS.authorized,
          nome: "Usuário autorizado",
          ativo: true,
        },
        { matricula: USERS.other, nome: "Outro usuário", ativo: true },
      ]),
    );
    await db.run(
      INSERT.into(entities.Centros).entries({
        ID: IDS.center,
        codigo: "TC01",
        nome: "Centro de teste",
      }),
    );
    await db.run(
      INSERT.into(entities.LocaisInstalacao).entries({
        ID: IDS.location,
        codigo: "TL01",
        nome: "Local de teste",
        centro_ID: IDS.center,
        ativo: true,
      }),
    );
    await db.run(
      INSERT.into(entities.Depositos).entries({
        ID: IDS.deposit,
        codigo: "TD01",
        nome: "Depósito de teste",
        centro_ID: IDS.center,
      }),
    );
    await db.run(
      INSERT.into(entities.Materiais).entries([
        buildMaterial(IDS.materialA, "TM-A"),
        buildMaterial(IDS.materialB, "TM-B"),
        buildMaterial(IDS.materialC, "TM-C"),
      ]),
    );
    await db.run(
      INSERT.into(entities.Estoques).entries([
        buildStock(IDS.stockA, IDS.materialA, 10),
        buildStock(IDS.stockB, IDS.materialB, 5),
        buildStock(IDS.stockC, IDS.materialC, 1),
      ]),
    );
    await db.run(
      INSERT.into(entities.Ordens).entries([
        buildOrder(IDS.success, "T-SUCESSO", USERS.authorized),
        buildOrder(IDS.risk, "T-RISCO", USERS.authorized),
        buildOrder(IDS.withoutReservations, "T-SEM-RESERVA", USERS.authorized),
        buildOrder(IDS.otherUser, "T-OUTRO-USUARIO", USERS.other),
        buildOrder(IDS.released, "T-LIBERADA", USERS.authorized, {
          status_code: "LIBERADA",
        }),
        buildOrder(IDS.successSecond, "T-SUCESSO-2", USERS.authorized),
        buildOrder(IDS.partial, "T-PARCIAL", USERS.authorized),
      ]),
    );
    await db.run(
      INSERT.into(entities.ReservasMateriais).entries([
        buildReservation(
          "b1000000-0000-4000-a000-000000000001",
          IDS.success,
          IDS.materialA,
          2,
        ),
        buildReservation(
          "b1000000-0000-4000-a000-000000000002",
          IDS.success,
          IDS.materialB,
          1,
        ),
        buildReservation(
          "b2000000-0000-4000-a000-000000000001",
          IDS.risk,
          IDS.materialC,
          3,
        ),
        buildReservation(
          "b4000000-0000-4000-a000-000000000001",
          IDS.otherUser,
          IDS.materialA,
          1,
        ),
        buildReservation(
          "b6000000-0000-4000-a000-000000000001",
          IDS.successSecond,
          IDS.materialA,
          1,
        ),
        buildReservation(
          "b7000000-0000-4000-a000-000000000001",
          IDS.partial,
          IDS.materialA,
          2,
        ),
        buildReservation(
          "b7000000-0000-4000-a000-000000000002",
          IDS.partial,
          IDS.materialC,
          3,
        ),
      ]),
    );
    await db.run(
      INSERT.into(entities.ResponsabilidadesOrdem).entries([
        buildResponsibility(
          "c3000000-0000-4000-a000-000000000001",
          IDS.success,
          USERS.authorized,
        ),
        buildResponsibility(
          "c3000000-0000-4000-a000-000000000002",
          IDS.risk,
          USERS.authorized,
        ),
        buildResponsibility(
          "c3000000-0000-4000-a000-000000000003",
          IDS.withoutReservations,
          USERS.authorized,
        ),
        buildResponsibility(
          "c3000000-0000-4000-a000-000000000004",
          IDS.otherUser,
          USERS.other,
        ),
        buildResponsibility(
          "c3000000-0000-4000-a000-000000000005",
          IDS.released,
          USERS.authorized,
        ),
        buildResponsibility(
          "c3000000-0000-4000-a000-000000000006",
          IDS.successSecond,
          USERS.authorized,
        ),
        buildResponsibility(
          "c3000000-0000-4000-a000-000000000007",
          IDS.partial,
          USERS.authorized,
        ),
      ]),
    );
    await db.run(
      INSERT.into(entities.LotesLiberacao).entries([
        buildLot(IDS.lotSuccess, "T-LOTE-SUCESSO"),
        buildLot(IDS.lotMixed, "T-LOTE-MISTO"),
        buildLot(IDS.lotPartial, "T-LOTE-PARCIAL"),
        buildLot(IDS.lotProcessed, "T-LOTE-PROCESSADO", "PROCESSADO"),
        buildLot(IDS.lotNoPending, "T-LOTE-SEM-PENDENTE"),
      ]),
    );
    await db.run(
      INSERT.into(entities.ItensLoteLiberacao).entries([
        buildLotItem(
          "d8000000-0000-4000-a000-000000000001",
          IDS.lotSuccess,
          IDS.success,
        ),
        buildLotItem(
          "d8000000-0000-4000-a000-000000000002",
          IDS.lotSuccess,
          IDS.successSecond,
        ),
        buildLotItem(
          "d8000000-0000-4000-a000-000000000003",
          IDS.lotMixed,
          IDS.success,
        ),
        buildLotItem(
          "d8000000-0000-4000-a000-000000000004",
          IDS.lotMixed,
          IDS.risk,
        ),
        buildLotItem(
          "d8000000-0000-4000-a000-000000000005",
          IDS.lotPartial,
          IDS.partial,
        ),
        buildLotItem(
          "d8000000-0000-4000-a000-000000000007",
          IDS.lotProcessed,
          IDS.success,
        ),
        buildLotItem(
          "d8000000-0000-4000-a000-000000000006",
          IDS.lotNoPending,
          IDS.released,
          { status_code: "SUCESSO", processado: true },
        ),
      ]),
    );
  }

  function buildDraftPayload(ID, overrides = {}) {
    return {
      ID,
      codigo: `T-DRAFT-${ID.slice(1, 5)}`,
      descricao: "Draft automatizado",
      centro_ID: IDS.center,
      localInstalacao_ID: IDS.location,
      responsavel_matricula: USERS.authorized,
      dataInicioPlanejada: "2026-08-10T08:00:00Z",
      dataFimPlanejada: "2026-08-10T10:00:00Z",
      valorEstimado: 100,
      ...overrides,
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

  function buildOrder(ID, codigo, responsavel_matricula, overrides = {}) {
    return {
      ID,
      codigo,
      descricao: codigo,
      centro_ID: IDS.center,
      localInstalacao_ID: IDS.location,
      responsavel_matricula,
      status_code: "ABERTA",
      prioridade_code: "MEDIA",
      dataInicioPlanejada: "2026-08-10T08:00:00Z",
      dataFimPlanejada: "2026-08-10T10:00:00Z",
      valorEstimado: 100,
      ...overrides,
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

  function buildResponsibility(ID, ordem_ID, usuario_matricula) {
    return { ID, ordem_ID, usuario_matricula, papel: "EXECUTOR" };
  }

  function buildLot(ID, codigo, status_code = "ABERTO") {
    return {
      ID,
      codigo,
      descricao: codigo,
      status_code,
      solicitadoPor_matricula: USERS.authorized,
    };
  }

  function buildLotItem(ID, lote_ID, ordem_ID, overrides = {}) {
    return {
      ID,
      lote_ID,
      ordem_ID,
      status_code: "PENDENTE",
      processado: false,
      ...overrides,
    };
  }

  function orderUrl(ID, isActive) {
    return `${SERVICE_URL}/Ordens(ID=${ID},IsActiveEntity=${isActive})`;
  }

  function actionUrl(entity, ID, action) {
    return `${SERVICE_URL}/${entity}(ID=${ID},IsActiveEntity=true)/${action}`;
  }

  async function expectRequestError(request, expectedStatus, expectedMessage) {
    try {
      const response = await request;
      expect.fail(
        `Esperado HTTP ${expectedStatus}; recebido ${response.status}.`,
      );
    } catch (error) {
      if (!error.response) {
        throw error;
      }

      expect(error.response.status).to.equal(expectedStatus);
      const responseError = error.response.data?.error;
      const returnedMessages = [
        responseError?.message,
        ...(responseError?.details || []).map((detail) => detail.message),
      ]
        .filter(Boolean)
        .join(" ");

      expect(returnedMessages).to.include(expectedMessage);
    }
  }
});
