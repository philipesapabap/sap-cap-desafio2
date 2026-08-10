sap.ui.define([
    "sap/fe/test/ListReport",
    "sap/ui/test/Opa5"
], function (ListReport, Opa5) {
    "use strict";

    const GRID_TABLE_ID_SUFFIX = "fe::table::LotesLiberacao::LineItem-innerTable";

    /**
     * Retorna as linhas visíveis da GridTable que possuem contexto OData.
     * Linhas vazias criadas para completar a altura da tabela são ignoradas.
     *
     * @param {sap.ui.table.Table} table Tabela interna renderizada pelo Fiori elements.
     * @returns {sap.ui.table.Row[]} Linhas atualmente vinculadas a registros.
     * @private
     */
    function getBoundRows(table) {
        return table.getRows().filter((row) => Boolean(row.getBindingContext()));
    }

    /**
     * Localiza a tabela interna de lotes sem depender dos helpers voltados à
     * ResponsiveTable.
     *
     * @param {sap.ui.table.Table} table Controle candidato encontrado pelo OPA5.
     * @returns {boolean} `true` quando o controle é a GridTable do List Report.
     * @private
     */
    function isLotesGridTable(table) {
        return table.getId().endsWith(GRID_TABLE_ID_SUFFIX);
    }

    /**
     * Navega dentro do shell de teste para um caminho interno do aplicativo.
     *
     * @param {string} routePath Caminho produzido pelas rotas do manifest.
     * @returns {void}
     * @private
     */
    function navigateToAppPath(routePath) {
        const appWindow = Opa5.getWindow();
        const shellHash = appWindow.location.hash.split("&/")[0];

        appWindow.location.hash = `${shellHash}&/${routePath}`;
    }

    const CustomPageDefinitions = {
        actions: {
            /**
             * Abre o lote identificado pelo código usando o contexto OData da
             * GridTable e a rota pública configurada no manifest.
             *
             * @param {string} codigo Código funcional do lote.
             * @returns {sap.ui.test.Opa5} Encadeamento OPA5 da ação.
             */
            iPressGridRowByCode: function (codigo) {
                return this.waitFor({
                    controlType: "sap.ui.table.Table",
                    matchers: isLotesGridTable,
                    success: function (tables) {
                        const row = getBoundRows(tables[0]).find(
                            (candidate) =>
                                candidate.getBindingContext().getProperty("codigo") === codigo
                        );

                        Opa5.assert.ok(row, `O lote ${codigo} foi encontrado na GridTable`);
                        if (!row)
                            return;

                        const contextPath = row.getBindingContext().getPath();
                        const key = contextPath.match(/^\/LotesLiberacao\((.*)\)$/)?.[1];

                        if (!key)
                            throw new Error(`Não foi possível extrair a chave de ${contextPath}`);

                        navigateToAppPath(`LotesLiberacao(${key})`);
                    },
                    errorMessage: "A GridTable de lotes não foi encontrada"
                });
            }
        },
        assertions: {
            /**
             * Confere registros da GridTable pelos valores técnicos do contexto
             * OData, sem acessar a agregação `items` inexistente em GridTable.
             *
             * @param {{codigo?: string, status_code?: string}} expectedValues Valores esperados.
             * @param {number} expectedCount Quantidade esperada de linhas correspondentes.
             * @returns {sap.ui.test.Opa5} Encadeamento OPA5 da assertion.
             */
            iCheckGridRows: function (expectedValues, expectedCount) {
                return this.waitFor({
                    controlType: "sap.ui.table.Table",
                    matchers: isLotesGridTable,
                    check: function (tables) {
                        const rows = getBoundRows(tables[0]);
                        const matchingRows = rows.filter((row) => {
                            const context = row.getBindingContext();

                            return Object.entries(expectedValues).every(
                                ([property, value]) => {
                                    const bindingPath =
                                        property === "status_code" ? "status/code" : property;

                                    return context.getProperty(bindingPath) === value;
                                }
                            );
                        });

                        return matchingRows.length === expectedCount;
                    },
                    success: function () {
                        Opa5.assert.ok(
                            true,
                            `A GridTable contém ${expectedCount} linha(s) correspondente(s)`
                        );
                    },
                    errorMessage: `A GridTable não apresentou ${expectedCount} linha(s) com os valores esperados`
                });
            }
        }
    };

    return new ListReport(
        {
            appId: "treinamento.cap.lotes",
            componentId: "LotesLiberacaoList",
            contextPath: "/LotesLiberacao"
        },
        CustomPageDefinitions
    );
});
