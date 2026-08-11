/**
 * Como rodar apenas esta suíte:
 *
 *     npx cds test test/srv/planejamento-service.test.js
 *
 * Teste 1 - cria alias na consulta quando ele está ausente.
 * Teste 2 - preserva alias existente.
 * Teste 3 - encontra comparação booleana direta e invertida.
 * Teste 4 - encontra comparação booleana aninhada.
 * Teste 5 - remove filtro virtual simples e preserva o filtro restante.
 * Teste 6 - aceita período válido.
 * Teste 7 - rejeita período inválido no campo alterado.
 */

const cds = require("@sap/cds");
const { expect } = cds.test;
const PlanejamentoService = require("../../srv/planejamento-service");

describe("PlanejamentoService — unidades dos handlers", () => {
  let service;

  beforeEach(() => {
    service = Object.create(PlanejamentoService.prototype);
  });

  /**
   * Dado: uma consulta CQN cuja origem ainda não possui alias.
   * Quando: `garantirAlias` recebe o nome sugerido `ordem`.
   * Então: o helper devolve e grava esse alias na própria consulta.
   * Por quê: subconsultas correlacionadas precisam referenciar a ordem sem ambiguidade.
   */
  it("cria alias na consulta quando ele está ausente", () => {
    const query = { SELECT: { from: { ref: ["PlanejamentoService.Ordens"] } } };

    const alias = service.garantirAlias(query, "ordem");

    expect(alias).to.equal("ordem");
    expect(query.SELECT.from.as).to.equal("ordem");
  });

  /**
   * Dado: uma consulta CQN que já usa o alias `ordemExistente`.
   * Quando: `garantirAlias` é chamado com outra sugestão.
   * Então: o alias original é devolvido e não é sobrescrito.
   * Por quê: alterar um alias existente quebraria referências já presentes na consulta.
   */
  it("preserva alias existente", () => {
    const query = {
      SELECT: {
        from: { ref: ["PlanejamentoService.Ordens"], as: "ordemExistente" },
      },
    };

    const alias = service.garantirAlias(query, "ordem");

    expect(alias).to.equal("ordemExistente");
  });

  /**
   * Dado: duas formas equivalentes de comparar o campo virtual com booleanos.
   * Quando: `extrairComparacaoBooleana` interpreta os operandos e o operador.
   * Então: ambas são normalizadas para o mesmo valor lógico `true`.
   * Por quê: clientes OData podem serializar comparações equivalentes em ordens diferentes.
   */
  it("encontra comparação booleana direta e invertida", () => {
    const direta = service.extrairComparacaoBooleana(
      { ref: ["comRiscoEstoque"] },
      "=",
      { val: true },
      "comRiscoEstoque",
    );
    const invertida = service.extrairComparacaoBooleana(
      { val: false },
      "!=",
      { ref: ["comRiscoEstoque"] },
      "comRiscoEstoque",
    );

    expect(direta).to.deep.equal({ valor: true });
    expect(invertida).to.deep.equal({ valor: true });
  });

  /**
   * Dado: o filtro virtual dentro de um nó CQN aninhado do tipo `xpr`.
   * Quando: `obterFiltroBooleano` percorre a expressão recursivamente.
   * Então: a comparação é encontrada com o valor `false`.
   * Por quê: parênteses em `$filter` são representados por expressões aninhadas.
   */
  it("encontra comparação booleana aninhada", () => {
    const where = [
      {
        xpr: [
          { ref: ["comRiscoEstoque"] },
          "=",
          { val: false },
        ],
      },
    ];

    const filtro = service.obterFiltroBooleano(where, "comRiscoEstoque");

    expect(filtro).to.include({ valor: false });
  });

  /**
   * Dado: um `$filter` com o campo virtual e uma condição persistente por código.
   * Quando: `removerFiltroDoCampo` elimina a comparação não armazenada no banco.
   * Então: a condição por código e seus operandos permanecem intactos.
   * Por quê: o HANA/SQLite não pode receber uma coluna virtual no SQL gerado.
   */
  it("remove filtro virtual simples e preserva o filtro restante", () => {
    const where = [
      { ref: ["comRiscoEstoque"] },
      "=",
      { val: true },
      "and",
      { ref: ["codigo"] },
      "=",
      { val: "OM-TESTE" },
    ];

    const resultado = service.removerFiltroDoCampo(where, "comRiscoEstoque");

    expect(resultado).to.deep.equal([
      { ref: ["codigo"] },
      "=",
      { val: "OM-TESTE" },
    ]);
  });

  /**
   * Dado: início planejado anterior ao fim planejado.
   * Quando: `validarDatasPeriodo` avalia as duas datas.
   * Então: nenhum erro é anexado à requisição.
   * Por quê: períodos cronologicamente válidos devem prosseguir normalmente.
   */
  it("aceita período válido", () => {
    const errors = [];
    const req = {
      data: { dataFimPlanejada: "2026-08-10T10:00:00Z" },
      error: (...args) => errors.push(args),
    };

    service.validarDatasPeriodo(
      req,
      "2026-08-10T08:00:00Z",
      "2026-08-10T10:00:00Z",
    );

    expect(errors).to.deep.equal([]);
  });

  /**
   * Dado: início planejado posterior ao fim e o início presente no payload.
   * Quando: `validarDatasPeriodo` detecta a inversão cronológica.
   * Então: rejeita a requisição com erro 400 em `dataInicioPlanejada`.
   * Por quê: indicar o campo alterado ajuda a UI a exibir a validação no local correto.
   */
  it("rejeita período inválido no campo alterado", () => {
    const rejects = [];
    const req = {
      data: { dataInicioPlanejada: "2026-08-10T11:00:00Z" },
      reject: (...args) => rejects.push(args),
    };

    service.validarDatasPeriodo(
      req,
      "2026-08-10T11:00:00Z",
      "2026-08-10T10:00:00Z",
    );

    expect(rejects).to.deep.equal([
      [400, "INVALID_PLANNED_PERIOD", "dataInicioPlanejada"],
    ]);
  });
});
