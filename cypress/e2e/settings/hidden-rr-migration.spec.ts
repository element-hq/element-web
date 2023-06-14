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

import { HomeserverInstance } from "../../plugins/utils/homeserver";

function seedLabs(homeserver: HomeserverInstance, labsVal: boolean | null): void {
    cy.initTestUser(homeserver, "Sally", () => {
        // seed labs flag
        cy.window({ log: false }).then((win) => {
            if (typeof labsVal === "boolean") {
                // stringify boolean
                win.localStorage.setItem("mx_labs_feature_feature_hidden_read_receipts", `${labsVal}`);
            }
        });
    });
}

function testForVal(settingVal: boolean | null): void {
    const testRoomName = "READ RECEIPTS";
    cy.createRoom({ name: testRoomName }).as("roomId");
    cy.all([cy.get<string>("@roomId")]).then(() => {
        cy.viewRoomByName(testRoomName).then(() => {
            // if we can see the room, then sync is working for us. It's time to see if the
            // migration even ran.

            cy.getSettingValue("sendReadReceipts", null, true).should("satisfy", (val) => {
                if (typeof settingVal === "boolean") {
                    return val === settingVal;
                } else {
                    return !val; // falsy - we don't actually care if it's undefined, null, or a literal false
                }
            });
        });
    });
}

describe("Hidden Read Receipts Setting Migration", () => {
    // We run this as a full-blown end-to-end test to ensure it works in an integration
    // sense. If we unit tested it, we'd be testing that the code works but not that the
    // migration actually runs.
    //
    // Here, we get to test that not only the code works but also that it gets run. Most
    // of our interactions are with the JS console as we're honestly just checking that
    // things got set correctly.
    //
    // For a security-sensitive feature like hidden read receipts, it's absolutely vital
    // that we migrate the setting appropriately.

    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should not migrate the lack of a labs flag", () => {
        seedLabs(homeserver, null);
        testForVal(null);
    });

    it("should migrate labsHiddenRR=false as sendRR=true", () => {
        seedLabs(homeserver, false);
        testForVal(true);
    });

    it("should migrate labsHiddenRR=true as sendRR=false", () => {
        seedLabs(homeserver, true);
        testForVal(false);
    });
});
