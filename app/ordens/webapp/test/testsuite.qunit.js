/**
 * Catálogo da suíte UI5 Test Starter de Ordens.
 *
 * O Test Starter centraliza QUnit, tema, paths e carregamento assíncrono. Isso
 * elimina o bootstrap manual e mantém a suíte compatível com a evolução do UI5.
 */

sap.ui.define(function () {
    "use strict";

    return {
        name: "Fiori elements — Liberação de Ordens",
        defaults: {
            page: "ui5://test-resources/treinamento/cap/ordens/Test.qunit.html?testsuite={suite}&test={name}",
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
                    "treinamento/cap/ordens": "../"
                }
            }
        },
        tests: {
            integration: {
                title: "Jornada OPA5 didática de Ordens",
                module: "./integration/opaTests.qunit"
            }
        }
    };
});
