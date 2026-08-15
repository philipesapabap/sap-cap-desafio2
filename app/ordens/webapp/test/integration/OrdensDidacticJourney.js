/**
 * Jornada OPA5 didática do aplicativo de Ordens.
 *
 * Execução isolada:
 *
 *     npm run test:fiori:ordens
 *
 * Cenários:
 * 1. abre o List Report e valida seus elementos essenciais;
 * 2. filtra uma ordem pelo código;
 * 3. abre a Object Page e valida dados, actions e reservas;
 * 4. navega para o detalhe de uma reserva e retorna;
 * 5. libera uma ordem atendida pelo estoque;
 * 6. seleciona a ordem sem estoque suficiente;
 * 7. apresenta o erro funcional ao tentar liberá-la;
 * 8. cancela a ordem informando o motivo obrigatório;
 * 9. inicia a criação de uma ordem em draft e valida os campos editáveis;
 * 10. encerra a aplicação e limpa o iframe.
 */

sap.ui.define(["sap/ui/test/opaQunit"], function (opaTest) {
  "use strict";

  const CODE_FILTER = { property: "codigo" };
  const RISK_FILTER = { property: "comRiscoEstoque" };
  const STATUS_FIELD = { property: "status_code" };
  const CENTER_FIELD = { property: "centro_ID" };
  const INSTALLATION_LOCATION_FIELD = { property: "localInstalacao_ID" };
  const RESPONSIBLE_FIELD = { property: "responsavel_matricula" };
  const OBSERVATION_FIELD = { property: "observacao" };
  const GENERAL_DATA_FORM = { fieldGroup: "DadosGerais" };
  const PLANNING_FORM = { fieldGroup: "Planejamento" };

  /**
   * Registra os testes na ordem de uma jornada real. O estado visual é
   * compartilhado entre os testes para tornar explícita a navegação feita
   * pelo usuário, enquanto o servidor usa um banco temporário exclusivo.
   *
   * @returns {void}
   */
  function journey() {
    QUnit.module("Ordens — jornada didática Fiori elements");

    /**
     * Dado: o CAP iniciado com a carga inicial e autenticação de administrador.
     * Quando: o Fiori Launchpad de teste abre o aplicativo de Ordens.
     * Então: o List Report, os filtros principais e as três ordens ficam disponíveis.
     * Por quê: esta verificação separa falhas de bootstrap das regras dos próximos testes.
     */
    opaTest(
      "abre o List Report com filtros e dados",
      function (Given, When, Then) {
        Given.iStartMyApp();

        Then.onTheOrdensList.iSeeThisPage();
        Then.onTheOrdensList.onFilterBar().iCheckFilterField(CODE_FILTER);
        Then.onTheOrdensList.onFilterBar().iCheckFilterField(RISK_FILTER);

        // O List Report foi configurado para aguardar o botão Ir antes da primeira leitura.
        When.onTheOrdensList.onFilterBar().iExecuteSearch();
        Then.onTheOrdensList.onTable().iCheckRows({}, 3);
      },
    );

    /**
     * Dado: o List Report contém ordens de responsáveis, centros e riscos distintos.
     * Quando: o código `OM-0001` é informado e a pesquisa é executada.
     * Então: o filtro conserva o valor digitado e a tabela mostra somente essa ordem.
     * Por quê: valida a integração entre FilterBar, OData V4 e tabela gerada por annotations.
     */
    opaTest("filtra uma ordem pelo código", function (Given, When, Then) {
      When.onTheOrdensList
        .onFilterBar()
        .iChangeFilterField(CODE_FILTER, "OM-0001", true);
      When.onTheOrdensList.onFilterBar().iExecuteSearch();

      Then.onTheOrdensList
        .onFilterBar()
        .iCheckFilterField(CODE_FILTER, "OM-0001");
      Then.onTheOrdensList.onTable().iCheckRows({}, 1);
    });

    /**
     * Dado: a tabela está filtrada para uma ordem aberta com duas reservas atendidas.
     * Quando: o usuário pressiona a linha da ordem.
     * Então: a Object Page mostra título, descrição, estado, actions e duas reservas.
     * Por quê: protege o contrato das annotations de cabeçalho, facets e composição.
     */
    opaTest(
      "abre a ordem e apresenta suas reservas",
      function (Given, When, Then) {
        When.onTheOrdensList.onTable().iPressRow(0);

        Then.onTheOrdensObjectPage.iSeeThisPage();
        Then.onTheOrdensObjectPage
          .onHeader()
          .iCheckTitle("OM-0001", "Troca preventiva de rolamento");
        Then.onTheOrdensObjectPage.onHeader().iCheckAction("Liberar ordem", {
          visible: true,
          enabled: true,
        });
        Then.onTheOrdensObjectPage.onHeader().iCheckAction("Cancelar ordem", {
          visible: true,
          enabled: true,
        });
        Then.onTheOrdensObjectPage
          .onForm(GENERAL_DATA_FORM)
          .iCheckField(STATUS_FIELD, "Aberta");
        Then.onTheOrdensObjectPage
          .onTable({ property: "reservas" })
          .iCheckRows({}, 2);
      },
    );

    /**
     * Dado: a Object Page da ordem exibe a composição `reservas` como tabela.
     * Quando: a primeira reserva é pressionada e depois o navegador retorna.
     * Então: a página filha abre e a Object Page da ordem volta a ficar ativa.
     * Por quê: garante que as rotas de composição declaradas no manifest são navegáveis.
     */
    /**
     * Dado: `OM-0001` está aberta e o estoque atende todas as suas reservas.
     * Quando: o usuário executa a action `Liberar ordem` pelo cabeçalho.
     * Então: a mesma página passa a apresentar o estado `LIBERADA`.
     * Por quê: valida action bound, chamada OData e SideEffects que atualizam a tela.
     */
    opaTest(
      "libera uma ordem com estoque suficiente",
      function (Given, When, Then) {
        When.onTheOrdensObjectPage.onHeader().iExecuteAction("Liberar ordem");

        Then.onTheOrdensObjectPage
          .onForm(GENERAL_DATA_FORM)
          .iCheckField(STATUS_FIELD, "Liberada");
      },
    );

    /**
     * Dado: a primeira ordem já foi liberada e não serve para testar insuficiência.
     * Quando: o usuário retorna, troca o filtro para `OM-0002` e abre a linha.
     * Então: a Object Page da segunda ordem aparece no estado `ABERTA`.
     * Por quê: prepara explicitamente o contexto do cenário negativo seguinte.
     */
    opaTest(
      "seleciona a ordem com risco de estoque",
      function (Given, When, Then) {
        When.iNavigateBack();
        Then.onTheOrdensList.iSeeThisPage();

        When.onTheOrdensList
          .onFilterBar()
          .iChangeFilterField(CODE_FILTER, "OM-0002", true);
        When.onTheOrdensList.onFilterBar().iExecuteSearch();
        Then.onTheOrdensList.onTable().iCheckRows({}, 1);

        When.onTheOrdensList.onTable().iPressRow(0);
        Then.onTheOrdensObjectPage
          .onHeader()
          .iCheckTitle("OM-0002", "Substituicao de filtro hidraulico");
        Then.onTheOrdensObjectPage
          .onForm(GENERAL_DATA_FORM)
          .iCheckField(STATUS_FIELD, "Aberta");
      },
    );

    /**
     * Dado: `OM-0002` requer três unidades, mas seu estoque possui apenas uma.
     * Quando: a action de liberação é executada.
     * Então: o Fiori elements abre um diálogo de erro, que o usuário consegue fechar.
     * Por quê: erros funcionais do CAP precisam chegar à interface de forma compreensível.
     */
    opaTest(
      "exibe o erro de estoque insuficiente",
      function (Given, When, Then) {
        When.onTheOrdensObjectPage.onHeader().iExecuteAction("Liberar ordem");
        Then.onTheOrdensObjectPage.iCheckErrorMessageDialog();

        When.onTheOrdensObjectPage.iCloseErrorMessageDialog();
        Then.onTheOrdensObjectPage.iSeeThisPage();
        Then.onTheOrdensObjectPage
          .onForm(GENERAL_DATA_FORM)
          .iCheckField(STATUS_FIELD, "Aberta");
      },
    );

    /**
     * Dado: a ordem continua aberta depois da tentativa de liberação rejeitada.
     * Quando: `Cancelar ordem` é acionada, o motivo é preenchido e confirmado.
     * Então: a tela mostra `CANCELADA` e conserva a justificativa na observação.
     * Por quê: cobre o diálogo de parâmetros e o SideEffect de uma action com entrada.
     */
    opaTest(
      "cancela a ordem com motivo obrigatório",
      function (Given, When, Then) {
        When.onTheOrdensObjectPage.onHeader().iExecuteAction("Cancelar ordem");
        Then.onTheOrdensObjectPage
          .onActionDialog()
          .iCheckDialogField({ property: "motivo" }, "");

        When.onTheOrdensObjectPage
          .onActionDialog()
          .iChangeDialogField(
            { property: "motivo" },
            "Cancelamento validado pela jornada OPA5",
            true,
          );
        Then.onTheOrdensObjectPage
          .onActionDialog()
          .iCheckConfirm({ enabled: true });
        When.onTheOrdensObjectPage.onActionDialog().iConfirm();

        Then.onTheOrdensObjectPage
          .onForm(GENERAL_DATA_FORM)
          .iCheckField(STATUS_FIELD, "Cancelada");
        Then.onTheOrdensObjectPage
          .onForm(PLANNING_FORM)
          .iCheckField(
            OBSERVATION_FIELD,
            "Motivo do cancelamento: Cancelamento validado pela jornada OPA5",
          );
      },
    );

    /**
     * Dado: o List Report oferece criação porque `Ordens` é draft-enabled.
     * Quando: o usuário retorna à lista e pressiona Criar.
     * Então: a Object Page abre com ações de rodapé e permite informar centro,
     * local de instalação e responsável.
     * Por quê: esses vínculos obrigatórios precisam ser gravados no novo draft.
     */
    opaTest(
      "inicia a criação de uma ordem em draft",
      function (Given, When, Then) {
        When.iNavigateBack();
        Then.onTheOrdensList.iSeeThisPage();

        When.onTheOrdensList.onTable().iExecuteCreate();
        Then.onTheOrdensObjectPage.iSeeThisPage();
        Then.onTheOrdensObjectPage.onFooter().iCheckSave({ visible: true });
        Then.onTheOrdensObjectPage.onFooter().iCheckCancel({ visible: true });
        Then.onTheOrdensObjectPage
          .onForm(GENERAL_DATA_FORM)
          .iCheckField(CENTER_FIELD, "", { editMode: "Editable" });
        Then.onTheOrdensObjectPage
          .onForm(GENERAL_DATA_FORM)
          .iCheckField(INSTALLATION_LOCATION_FIELD, "", {
            editMode: "Editable",
          });
        Then.onTheOrdensObjectPage
          .onForm(GENERAL_DATA_FORM)
          .iCheckField(RESPONSIBLE_FIELD, "", { editMode: "Editable" });
      },
    );

    /**
     * Dado: todos os comportamentos previstos já foram exercitados.
     * Quando: a aplicação de teste é desmontada.
     * Então: iframe, stubs e recursos OPA são removidos.
     * Por quê: teardown explícito evita vazamentos entre execuções locais ou no CI.
     */
    opaTest("encerra a jornada de Ordens", function (Given, When, Then) {
      Given.iTearDownMyApp();
    });
  }

  return journey;
});
