sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"treinamento/cap/lotes/test/integration/pages/LotesLiberacaoList",
	"treinamento/cap/lotes/test/integration/pages/LotesLiberacaoObjectPage",
	"treinamento/cap/lotes/test/integration/pages/ItensLoteLiberacaoObjectPage"
], function (JourneyRunner, LotesLiberacaoList, LotesLiberacaoObjectPage, ItensLoteLiberacaoObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('treinamento/cap/lotes') + '/test/flp.html#app-preview',
        pages: {
			onTheLotesLiberacaoList: LotesLiberacaoList,
			onTheLotesLiberacaoObjectPage: LotesLiberacaoObjectPage,
			onTheItensLoteLiberacaoObjectPage: ItensLoteLiberacaoObjectPage
        },
        async: true
    });

    return runner;
});
