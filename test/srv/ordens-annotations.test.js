/**
 * Como rodar apenas esta suíte:
 *
 *     npx cds test test/srv/ordens-annotations.test.js
 *
 * Teste 1 - usa as chaves estrangeiras editáveis no formulário da ordem.
 * Teste 2 - mantém texto e ajuda de valores para as três associações.
 */

const cds = require("@sap/cds");
const { expect } = cds.test;

describe("Ordens — annotations do formulário", () => {
  let edmx;

  before(async () => {
    const model = await cds.load("*");
    edmx = cds.compile.to.edmx(model, { service: "PlanejamentoService" });
  });

  /**
   * Recorta as annotations OData de um elemento da entidade Ordens.
   *
   * @param {string} element Nome do elemento exposto no OData.
   * @returns {string} Bloco XML correspondente ao elemento.
   */
  function annotationsFor(element) {
    const target = `<Annotations Target="PlanejamentoService.Ordens/${element}">`;
    const start = edmx.indexOf(target);
    const end = edmx.indexOf("</Annotations>", start);

    expect(start, `annotations de ${element}`).to.be.at.least(0);
    expect(end, `fim das annotations de ${element}`).to.be.greaterThan(start);

    return edmx.slice(start, end + "</Annotations>".length);
  }

  it("usa chaves estrangeiras editáveis no grupo de dados gerais", () => {
    const start = edmx.indexOf(
      '<Annotation Term="UI.FieldGroup" Qualifier="DadosGerais">',
    );
    const end = edmx.indexOf(
      '<Annotation Term="UI.FieldGroup" Qualifier="Planejamento">',
      start,
    );
    const fieldGroup = edmx.slice(start, end);

    expect(start, "FieldGroup DadosGerais").to.be.at.least(0);
    expect(end, "FieldGroup Planejamento").to.be.greaterThan(start);
    expect(fieldGroup).to.include('Path="centro_ID"');
    expect(fieldGroup).to.include('Path="localInstalacao_ID"');
    expect(fieldGroup).to.include('Path="responsavel_matricula"');
    expect(fieldGroup).not.to.include('Path="centro/codigo"');
    expect(fieldGroup).not.to.include('Path="localInstalacao/codigo"');
    expect(fieldGroup).not.to.include('Path="responsavel/nome"');
  });

  it("mantém texto e ajuda de valores nos campos editáveis", () => {
    const expectedTextPaths = {
      centro_ID: "centro/codigo",
      localInstalacao_ID: "localInstalacao/codigo",
      responsavel_matricula: "responsavel/nome",
    };

    for (const [element, textPath] of Object.entries(expectedTextPaths)) {
      const annotations = annotationsFor(element);

      expect(annotations).to.include(
        `<Annotation Term="Common.Text" Path="${textPath}">`,
      );
      expect(annotations).to.include('<Annotation Term="Common.ValueList">');
    }
  });
});
