/**
 * Módulo QUnit da suíte OPA5 de Ordens.
 *
 * O UI5 Test Starter carrega este módulo depois de configurar QUnit e o runtime.
 * Aqui registramos um resultado serializável para o runner headless e iniciamos
 * somente a jornada didática mantida pelo projeto.
 */

sap.ui.define([
    "sap/ui/thirdparty/qunit-2",
    "treinamento/cap/ordens/test/integration/pages/JourneyRunner",
    "treinamento/cap/ordens/test/integration/OrdensDidacticJourney"
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
