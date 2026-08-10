sap.ui.define([
    "sap/fe/test/ObjectPage",
    "sap/ui/test/actions/Press",
    "sap/ui/test/Opa5",
    "sap/ui/test/matchers/Properties"
], function (ObjectPage, Press, Opa5, Properties) {
    "use strict";

    const ERROR_DIALOG_TITLE = "Erro";
    const CLOSE_BUTTON_TEXT = "Fechar";

    /**
     * Verifica se um controle pertence ao MessageBox de erro aberto pelo Fiori elements.
     *
     * @param {sap.ui.core.Control} control Controle candidato encontrado pelo OPA5.
     * @returns {boolean} `true` quando o ancestral é um diálogo aberto com título `Erro`.
     * @private
     */
    function isInsideOpenErrorDialog(control) {
        let parent = control.getParent();

        while (parent) {
            if (
                parent.isA("sap.m.Dialog") &&
                parent.getTitle() === ERROR_DIALOG_TITLE &&
                parent.isOpen()
            )
                return true;

            parent = parent.getParent();
        }

        return false;
    }

    const CustomPageDefinitions = {
        actions: {
            iPressSectionIconTabFilterButton: function (section) {
                return this.waitFor({
                    id: new RegExp(`.*--fe::FacetSection::${section}-anchor$`),
                    actions: new Press()
                });
            },

            /**
             * Pressiona o botão `Fechar` pertencente ao MessageBox de erro aberto.
             *
             * @returns {sap.ui.test.Opa5} Encadeamento OPA5 para aguardar a ação.
             */
            iCloseErrorMessageDialog: function () {
                return this.waitFor({
                    controlType: "sap.m.Button",
                    searchOpenDialogs: true,
                    matchers: [
                        new Properties({ text: CLOSE_BUTTON_TEXT }),
                        isInsideOpenErrorDialog
                    ],
                    actions: new Press(),
                    errorMessage: "O botão Fechar do diálogo de erro não foi encontrado"
                });
            }
        },
        assertions: {
            /**
             * Confirma que existe um MessageBox de erro aberto com o título esperado.
             * Não usa o `state` porque o controle capturado pelo UI5 expõe `None`.
             *
             * @returns {sap.ui.test.Opa5} Encadeamento OPA5 para aguardar a assertion.
             */
            iCheckErrorMessageDialog: function () {
                return this.waitFor({
                    controlType: "sap.m.Dialog",
                    searchOpenDialogs: true,
                    matchers: new Properties({ title: ERROR_DIALOG_TITLE }),
                    success: function (dialogs) {
                        Opa5.assert.ok(
                            dialogs.some((dialog) => dialog.isOpen()),
                            "O diálogo de erro está aberto"
                        );
                    },
                    errorMessage: "O diálogo de erro com título Erro não foi encontrado"
                });
            }
        }
    };

    return new ObjectPage(
        {
            appId: 'treinamento.cap.ordens',
            componentId: 'OrdensObjectPage',
            contextPath: '/Ordens'
        },
        CustomPageDefinitions
    );
});
