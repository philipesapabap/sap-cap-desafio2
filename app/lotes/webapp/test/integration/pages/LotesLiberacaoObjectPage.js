sap.ui.define([
    "sap/fe/test/ObjectPage",
    "sap/ui/test/actions/Press",
    "sap/ui/test/Opa5"
], function (ObjectPage, Press, Opa5) {
    "use strict";

    const GRID_TABLE_ID_SUFFIX = "fe::table::itens::LineItem-innerTable";
    const PROCESSAR_LOTE_ACTION_ID = /.*processarLote$/;

    /**
     * Identifica a GridTable interna que exibe os itens do lote.
     *
     * @param {sap.ui.table.Table} table Controle candidato encontrado pelo OPA5.
     * @returns {boolean} `true` quando o controle é a tabela de itens.
     * @private
     */
    function isItensGridTable(table) {
        return table.getId().endsWith(GRID_TABLE_ID_SUFFIX);
    }

    /**
     * Retorna somente linhas que representam itens vinculados ao serviço.
     *
     * @param {sap.ui.table.Table} table Tabela interna de itens.
     * @returns {sap.ui.table.Row[]} Linhas com contexto OData.
     * @private
     */
    function getBoundRows(table) {
        return table.getRows().filter((row) => Boolean(row.getBindingContext()));
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
             * Executa a action do lote pelo ID técnico gerado pelo Fiori elements.
             * O seletor não depende do texto traduzido exibido no botão.
             *
             * @returns {sap.ui.test.Opa5} Encadeamento OPA5 da ação.
             */
            iExecuteProcessarLoteAction: function () {
                return this.waitFor({
                    controlType: "sap.m.Button",
                    id: PROCESSAR_LOTE_ACTION_ID,
                    actions: new Press(),
                    errorMessage: "A action processarLote não foi encontrada"
                });
            },

            iPressSectionIconTabFilterButton: function (section) {
                return this.waitFor({
                    id: new RegExp(`.*--fe::FacetSection::${section}-anchor$`),
                    actions: new Press()
                });
            },

            /**
             * Abre a ordem associada ao item visível da GridTable.
             *
             * @param {number} rowIndex Índice da linha vinculada que será aberta.
             * @returns {sap.ui.test.Opa5} Encadeamento OPA5 da ação.
             */
            iPressItemGridRow: function (rowIndex) {
                return this.waitFor({
                    controlType: "sap.ui.table.Table",
                    matchers: isItensGridTable,
                    check: function (tables) {
                        return Boolean(getBoundRows(tables[0])[rowIndex]);
                    },
                    success: function (tables) {
                        const row = getBoundRows(tables[0])[rowIndex];

                        const orderId = row.getBindingContext().getProperty("ordem/ID");

                        if (!orderId)
                            throw new Error("O item do lote não possui ordem/ID");

                        navigateToAppPath(`Ordens(ID=${orderId},IsActiveEntity=true)`);
                    },
                    errorMessage: `O item da linha ${rowIndex} não foi encontrado na GridTable`
                });
            }
        },
        assertions: {
            /**
             * Confirma que a action do lote está visível e habilitada sem
             * depender do idioma atual da interface.
             *
             * @returns {sap.ui.test.Opa5} Encadeamento OPA5 da assertion.
             */
            iCheckProcessarLoteAction: function () {
                return this.waitFor({
                    controlType: "sap.m.Button",
                    id: PROCESSAR_LOTE_ACTION_ID,
                    check: function (buttons) {
                        return buttons.some(
                            (button) => button.getVisible() && button.getEnabled()
                        );
                    },
                    success: function () {
                        Opa5.assert.ok(true, "A action processarLote está disponível");
                    },
                    errorMessage: "A action processarLote não está disponível"
                });
            },

            /**
             * Confere a quantidade de itens que possuem o status técnico informado.
             * A leitura usa o contexto OData, evitando helpers que esperam `getItems()`.
             *
             * @param {string} statusCode Código técnico do status do item.
             * @param {number} expectedCount Quantidade esperada de registros.
             * @returns {sap.ui.test.Opa5} Encadeamento OPA5 da assertion.
             */
            iCheckItemGridRowsByStatus: function (statusCode, expectedCount) {
                return this.waitFor({
                    controlType: "sap.ui.table.Table",
                    matchers: isItensGridTable,
                    check: function (tables) {
                        return getBoundRows(tables[0]).filter(
                            (row) =>
                                row.getBindingContext().getProperty("status/code") === statusCode
                        ).length === expectedCount;
                    },
                    success: function () {
                        Opa5.assert.ok(
                            true,
                            `A GridTable contém ${expectedCount} item(ns) com status ${statusCode}`
                        );
                    },
                    errorMessage: `A GridTable não apresentou ${expectedCount} item(ns) com status ${statusCode}`
                });
            }
        }
    };

    return new ObjectPage(
        {
            appId: 'treinamento.cap.lotes',
            componentId: 'LotesLiberacaoObjectPage',
            contextPath: '/LotesLiberacao'
        },
        CustomPageDefinitions
    );
});
