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

import { MatrixClient } from "../../global";
import { HomeserverInstance } from "../../plugins/utils/homeserver";

describe("User Onboarding (new user)", () => {
    let homeserver: HomeserverInstance;

    const bot1Name = "BotBob";
    let bot1: MatrixClient;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Jane Doe");
            cy.window({ log: false }).then((win) => {
                win.localStorage.setItem("mx_registration_time", "1656633601");
            });
            cy.reload().then(() => {
                // wait for the app to load
                return cy.get(".mx_MatrixChat", { timeout: 15000 });
            });
            cy.getBot(homeserver, { displayName: bot1Name }).then((_bot1) => {
                bot1 = _bot1;
            });
            cy.get(".mx_UserOnboardingPage").should("exist");
            cy.findByRole("button", { name: "Welcome" }).should("exist");
            cy.get(".mx_UserOnboardingList")
                .should("exist")
                .should(($list) => {
                    const list = $list.get(0);
                    expect(getComputedStyle(list).opacity).to.be.eq("1");
                });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("page is shown and preference exists", () => {
        cy.get(".mx_UserOnboardingPage").percySnapshotElement("User onboarding page");
        cy.openUserSettings("Preferences");
        cy.findByText("Show shortcut to welcome checklist above the room list").should("exist");
    });

    it("app download dialog", () => {
        cy.findByRole("button", { name: "Download apps" }).click();
        cy.get("[role=dialog]").get("#mx_BaseDialog_title").findByText("Download Element").should("exist");
        cy.get("[role=dialog]").percySnapshotElement("App download dialog", {
            widths: [640],
        });
    });

    it("using find friends action should increase progress", () => {
        cy.get(".mx_ProgressBar")
            .invoke("val")
            .then((oldProgress) => {
                const findPeopleAction = cy.findByRole("button", { name: "Find friends" });
                expect(findPeopleAction).to.exist;
                findPeopleAction.click();
                cy.get(".mx_InviteDialog_editor").findByRole("textbox").type(bot1.getUserId());
                cy.findByRole("button", { name: "Go" }).click();
                cy.get(".mx_InviteDialog_buttonAndSpinner").should("not.exist");
                const message = "Hi!";
                cy.findByRole("textbox", { name: "Send a message…" }).type(`${message}{enter}`);
                cy.get(".mx_MTextBody.mx_EventTile_content").findByText(message);
                cy.visit("/#/home");
                cy.get(".mx_UserOnboardingPage").should("exist");
                cy.findByRole("button", { name: "Welcome" }).should("exist");
                cy.get(".mx_UserOnboardingList")
                    .should("exist")
                    .should(($list) => {
                        const list = $list.get(0);
                        expect(getComputedStyle(list).opacity).to.be.eq("1");
                    });
                cy.get(".mx_ProgressBar").invoke("val").should("be.greaterThan", oldProgress);
            });
    });
});
