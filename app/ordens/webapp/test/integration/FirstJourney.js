sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("First journey");

        opaTest("Start application", function (Given, When, Then) {
            Given.iStartMyApp();
            Then.onTheOrdensList.iSeeThisPage();
        });


        opaTest("Navigate to ObjectPage", function (Given, When, Then) {
            // Note: this test will fail if the ListReport page doesn't show any data

            When.onTheOrdensList.onFilterBar().iExecuteSearch();

            Then.onTheOrdensList.onTable().iCheckRows();

            When.onTheOrdensList.onTable().iPressRow(0);
            Then.onTheOrdensObjectPage.iSeeThisPage();

        });

        opaTest("Teardown", function (Given, When, Then) {
            // Cleanup
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});
