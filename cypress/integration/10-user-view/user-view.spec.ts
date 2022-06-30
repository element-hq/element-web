/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/// <reference types="cypress" />

import { SynapseInstance } from "../../plugins/synapsedocker";
import { MatrixClient } from "../../global";

describe("UserView", () => {
    let synapse: SynapseInstance;

    beforeEach(() => {
        cy.startSynapse("default").then(data => {
            synapse = data;

            cy.initTestUser(synapse, "Violet");
            cy.getBot(synapse, { displayName: "Usman" }).as("bot");
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse);
    });

    it("should render the user view as expected", () => {
        cy.get<MatrixClient>("@bot").then(bot => {
            cy.visit(`/#/user/${bot.getUserId()}`);
        });

        cy.get("#mx_RightPanel .mx_UserInfo_profile h2").should("contain", "Usman");
        cy.get(".mx_RightPanel .mx_Spinner").should("not.exist"); // wait for spinners to finish
        cy.get(".mx_RightPanel").percySnapshotElement("User View", {
            // Hide the MXID field as it'll vary on each test
            percyCSS: ".mx_UserInfo_profile_mxid { visibility: hidden !important; }",
            widths: [260, 500],
        });
    });
});
