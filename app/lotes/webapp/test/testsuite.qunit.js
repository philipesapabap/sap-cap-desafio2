/**
 * Catálogo da suíte UI5 Test Starter de Lotes de Liberação.
 *
 * A configuração fixa QUnit 2 e desativa reordenação, pois os cenários formam
 * uma jornada intencional: filtros e ações de uma etapa preparam a seguinte.
 */

sap.ui.define(function () {
    "use strict";

    return {
        name: "Fiori elements — Lotes de Liberação",
        defaults: {
            page: "ui5://test-resources/treinamento/cap/lotes/Test.qunit.html?testsuite={suite}&test={name}",
            qunit: {
                version: 2,
                reorder: false
            },
            sinon: false,
            ui5: {
                language: "pt-BR",
                theme: "sap_horizon"
            },
            loader: {
                paths: {
                    "treinamento/cap/lotes": "../"
                }
            }
        },
        tests: {
            integration: {
                title: "Jornada OPA5 didática de Lotes",
                module: "./integration/opaTests.qunit"
            }
        }
    };
});
