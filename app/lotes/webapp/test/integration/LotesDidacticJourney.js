/**
 * Jornada OPA5 didática do aplicativo de Lotes de Liberação.
 *
 * Execução isolada:
 *
 *     npm run test:fiori:lotes
 *
 * Cenários:
 * 1. abre o List Report e valida seus elementos essenciais;
 * 2. filtra o lote aberto pelo código;
 * 3. abre a Object Page e valida action e itens;
 * 4. navega para o detalhe de um item e retorna;
 * 5. processa o lote;
 * 6. atualiza visualmente o resultado dos itens;
 * 7. apresenta o estado agregado definido no contrato;
 * 8. rejeita uma segunda execução do lote processado;
 * 9. rejeita o processamento de outro lote já encerrado;
 * 10. inicia a criação de um lote em draft;
 * 11. encerra a aplicação e limpa o iframe.
 */

sap.ui.define([
    "sap/ui/test/opaQunit"
], function (opaTest) {
    "use strict";

    const CODE_FILTER = { property: "codigo" };
    const STATUS_FILTER = { property: "status_code" };

    /**
     * Registra uma jornada contínua. Cada teste documenta uma etapa observável
     * pelo usuário, e os efeitos persistidos são usados conscientemente pelos
     * testes seguintes para validar transições e tentativas repetidas.
     *
     * @returns {void}
     */
    function journey() {
        QUnit.module("Lotes — jornada didática Fiori elements");

        /**
         * Dado: o aplicativo usa a carga inicial do CAP em SQLite temporário.
         * Quando: o Fiori Launchpad de teste abre o List Report de lotes.
         * Então: filtros essenciais e os três lotes conhecidos são renderizados.
         * Por quê: garante que metadata, annotations, serviço e template carregaram juntos.
         */
        opaTest("abre o List Report com filtros e dados", function (Given, When, Then) {
            Given.iStartMyApp();

            Then.onTheLotesLiberacaoList.iSeeThisPage();
            Then.onTheLotesLiberacaoList.onFilterBar().iCheckFilterField(CODE_FILTER);
            Then.onTheLotesLiberacaoList.onFilterBar().iCheckFilterField(STATUS_FILTER);

            // O List Report aguarda o botão Ir antes de executar a primeira leitura.
            When.onTheLotesLiberacaoList.onFilterBar().iExecuteSearch();
            Then.onTheLotesLiberacaoList.onTable().iCheckRows({}, 3);
        });

        /**
         * Dado: existem lotes abertos e processados na mesma coleção.
         * Quando: o usuário filtra pelo código `LOTE-0001`.
         * Então: a tabela mantém somente o lote aberto correspondente.
         * Por quê: valida FilterBar e tabela antes de executar qualquer mutação.
         */
        opaTest("filtra o lote aberto pelo código", function (Given, When, Then) {
            When.onTheLotesLiberacaoList.onFilterBar().iChangeFilterField(
                CODE_FILTER,
                "LOTE-0001",
                true
            );
            When.onTheLotesLiberacaoList.onFilterBar().iExecuteSearch();

            Then.onTheLotesLiberacaoList.onFilterBar().iCheckFilterField(
                CODE_FILTER,
                "LOTE-0001"
            );
            Then.onTheLotesLiberacaoList.onTable().iCheckRows({ Código: "LOTE-0001" }, 1);
        });

        /**
         * Dado: `LOTE-0001` está aberto e contém dois itens `PENDENTE`.
         * Quando: sua linha é pressionada.
         * Então: a Object Page mostra cabeçalho, estado, action e dois itens.
         * Por quê: protege a navegação e as annotations que formam a tela de detalhe.
         */
        opaTest("abre o lote e apresenta seus itens", function (Given, When, Then) {
            When.onTheLotesLiberacaoList.onTable().iPressRow({ Código: "LOTE-0001" });

            Then.onTheLotesLiberacaoObjectPage.iSeeThisPage();
            Then.onTheLotesLiberacaoObjectPage.onHeader().iCheckTitle(
                "LOTE-0001",
                "Lote aberto com ordens pendentes"
            );
            Then.onTheLotesLiberacaoObjectPage.onHeader().iCheckAction("Processar lote", {
                visible: true,
                enabled: true
            });
            Then.onTheLotesLiberacaoObjectPage.onTable({ property: "itens" }).iCheckRows(
                { Status: "PENDENTE" },
                2
            );
        });

        /**
         * Dado: a tabela `itens` é uma composição navegável do lote.
         * Quando: o primeiro item é aberto e o navegador retorna.
         * Então: a página filha e, depois, a Object Page do lote ficam visíveis.
         * Por quê: valida a rota de segundo nível configurada no manifest.
         */
        opaTest("navega para um item e retorna ao lote", function (Given, When, Then) {
            When.onTheLotesLiberacaoObjectPage.onTable({ property: "itens" }).iPressRow(0);
            Then.onTheItensLoteLiberacaoObjectPage.iSeeThisPage();

            When.iNavigateBack();
            Then.onTheLotesLiberacaoObjectPage.iSeeThisPage();
        });

        /**
         * Dado: um item possui estoque suficiente e o outro possui insuficiência.
         * Quando: a action `Processar lote` é executada.
         * Então: a requisição termina e a Object Page continua ativa.
         * Por quê: separa a execução da action das verificações visuais posteriores.
         */
        opaTest("processa o lote aberto", function (Given, When, Then) {
            When.onTheLotesLiberacaoObjectPage.onHeader().iExecuteAction("Processar lote");
            Then.onTheLotesLiberacaoObjectPage.iSeeThisPage();
        });

        /**
         * Dado: o backend concluiu um item com sucesso e outro com erro funcional.
         * Quando: os SideEffects da action atualizam a composição exibida na tabela.
         * Então: pelo menos a linha concluída como `SUCESSO` substitui o estado `PENDENTE`.
         * Por quê: uma única transição observável já prova que a tabela deixou de exibir
         * o snapshot antigo; os dois resultados de negócio são cobertos no teste do serviço.
         */
        opaTest("atualiza os resultados visuais dos itens", function (Given, When, Then) {
            Then.onTheLotesLiberacaoObjectPage.onTable({ property: "itens" }).iCheckRows(
                { Status: "SUCESSO" },
                1
            );
        });

        /**
         * Dado: o processamento terminou com pelo menos um item em erro.
         * Quando: o usuário volta à lista e força uma nova leitura do serviço.
         * Então: a linha do lote apresenta o código `PROCESSADO_COM_ERRO`.
         * Por quê: a nova leitura separa a divergência do status contratual de um eventual
         * problema de SideEffects na Object Page.
         */
        opaTest("apresenta o estado contratual do lote", function (Given, When, Then) {
            When.iNavigateBack();
            Then.onTheLotesLiberacaoList.iSeeThisPage();

            When.onTheLotesLiberacaoList.onFilterBar().iExecuteSearch();
            Then.onTheLotesLiberacaoList.onTable().iCheckRows(
                { Código: "LOTE-0001", Status: "PROCESSADO_COM_ERRO" },
                1
            );
        });

        /**
         * Dado: `LOTE-0001` acabou de ser processado pela etapa anterior.
         * Quando: a mesma action é executada novamente.
         * Então: a interface apresenta o conflito devolvido pelo backend.
         * Por quê: uma repetição não pode consumir estoque ou reprocessar itens.
         */
        opaTest("exibe erro ao repetir o processamento", function (Given, When, Then) {
            When.onTheLotesLiberacaoList.onTable().iPressRow({ Código: "LOTE-0001" });
            Then.onTheLotesLiberacaoObjectPage.iSeeThisPage();

            When.onTheLotesLiberacaoObjectPage.onHeader().iExecuteAction("Processar lote");
            Then.onTheLotesLiberacaoObjectPage.onErrorDialog().iCheckState({ visible: true });

            When.onTheLotesLiberacaoObjectPage.onErrorDialog().iClose();
            Then.onTheLotesLiberacaoObjectPage.iSeeThisPage();
        });

        /**
         * Dado: `LOTE-0002` já vem marcado como processado na carga inicial.
         * Quando: o usuário o localiza e tenta processá-lo.
         * Então: o backend rejeita a operação e o Fiori elements mostra o erro.
         * Por quê: valida o mesmo bloqueio sem depender do efeito do teste anterior.
         */
        opaTest("rejeita outro lote previamente processado", function (Given, When, Then) {
            When.iNavigateBack();
            Then.onTheLotesLiberacaoList.iSeeThisPage();

            When.onTheLotesLiberacaoList.onFilterBar().iChangeFilterField(
                CODE_FILTER,
                "LOTE-0002",
                true
            );
            When.onTheLotesLiberacaoList.onFilterBar().iExecuteSearch();
            Then.onTheLotesLiberacaoList.onTable().iCheckRows(
                { Código: "LOTE-0002", Status: "PROCESSADO" },
                1
            );

            When.onTheLotesLiberacaoList.onTable().iPressRow({ Código: "LOTE-0002" });
            Then.onTheLotesLiberacaoObjectPage.iSeeThisPage();

            When.onTheLotesLiberacaoObjectPage.onHeader().iExecuteAction("Processar lote");
            Then.onTheLotesLiberacaoObjectPage.onErrorDialog().iCheckState({ visible: true });
            When.onTheLotesLiberacaoObjectPage.onErrorDialog().iClose();
        });

        /**
         * Dado: `LotesLiberacao` é uma entidade draft-enabled.
         * Quando: o usuário retorna ao List Report e aciona Criar.
         * Então: uma nova Object Page editável apresenta Salvar e Cancelar.
         * Por quê: confirma a entrada do fluxo de criação usado para montar novos lotes.
         */
        opaTest("inicia a criação de um lote em draft", function (Given, When, Then) {
            When.iNavigateBack();
            Then.onTheLotesLiberacaoList.iSeeThisPage();

            When.onTheLotesLiberacaoList.onTable().iExecuteCreate();
            Then.onTheLotesLiberacaoObjectPage.iSeeThisPage();
            Then.onTheLotesLiberacaoObjectPage.onFooter().iCheckSave({ visible: true });
            Then.onTheLotesLiberacaoObjectPage.onFooter().iCheckCancel({ visible: true });
        });

        /**
         * Dado: a jornada já cobriu leitura, navegação, action, erro e draft.
         * Quando: a aplicação é desmontada.
         * Então: iframe e stubs são removidos de maneira controlada.
         * Por quê: a limpeza mantém execuções repetíveis no desenvolvimento e no CI.
         */
        opaTest("encerra a jornada de Lotes", function (Given, When, Then) {
            Given.iTearDownMyApp();
        });
    }

    return journey;
});
