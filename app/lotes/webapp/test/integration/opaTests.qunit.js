/**
 * Módulo QUnit da suíte OPA5 de Lotes de Liberação.
 *
 * O UI5 Test Starter cuida do bootstrap. Este módulo inicia a jornada e publica
 * resumo e falhas em propriedades da janela para o runner Node.
 */

sap.ui.define([
    "sap/ui/thirdparty/qunit-2",
    "treinamento/cap/lotes/test/integration/pages/JourneyRunner",
    "treinamento/cap/lotes/test/integration/LotesDidacticJourney"
], function (QUnit, runner, journey) {
    "use strict";

    window.__opaFailures = [];
    QUnit.log(function (details) {
        if (!details.result) {
            window.__opaFailures.push({
                module: details.module || "Sem módulo",
                name: details.name || "Sem nome",
                message: details.message || details.source || "Falha sem mensagem"
            });
        }
    });
    QUnit.done(function (details) {
        window.__opaResult = {
            finished: true,
            failed: details.failed,
            passed: details.passed,
            total: details.total,
            runtime: details.runtime
        };
    });

    runner.run([journey]);
});
