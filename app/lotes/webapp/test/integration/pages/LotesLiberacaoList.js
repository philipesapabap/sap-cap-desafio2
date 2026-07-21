sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'treinamento.cap.lotes',
            componentId: 'LotesLiberacaoList',
            contextPath: '/LotesLiberacao'
        },
        CustomPageDefinitions
    );
});
