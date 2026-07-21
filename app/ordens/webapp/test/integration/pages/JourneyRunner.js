sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"treinamento/cap/ordens/test/integration/pages/OrdensList",
	"treinamento/cap/ordens/test/integration/pages/OrdensObjectPage",
	"treinamento/cap/ordens/test/integration/pages/ReservasMateriaisObjectPage"
], function (JourneyRunner, OrdensList, OrdensObjectPage, ReservasMateriaisObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('treinamento/cap/ordens') + '/test/flp.html#app-preview',
        pages: {
			onTheOrdensList: OrdensList,
			onTheOrdensObjectPage: OrdensObjectPage,
			onTheReservasMateriaisObjectPage: ReservasMateriaisObjectPage
        },
        async: true
    });

    return runner;
});
