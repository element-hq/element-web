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
import { SettingLevel } from "../../../src/settings/SettingLevel";

describe("Composer", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    describe("CIDER", () => {
        beforeEach(() => {
            cy.initTestUser(homeserver, "Janet").then(() => {
                cy.createRoom({ name: "Composing Room" });
            });
            cy.viewRoomByName("Composing Room");
        });

        it("sends a message when you click send or press Enter", () => {
            // Type a message
            cy.findByRole("textbox", { name: "Send a message…" }).type("my message 0");
            // It has not been sent yet
            cy.contains(".mx_EventTile_body", "my message 0").should("not.exist");

            // Click send
            cy.findByRole("button", { name: "Send message" }).click();
            // It has been sent
            cy.get(".mx_EventTile_last .mx_EventTile_body").within(() => {
                cy.findByText("my message 0").should("exist");
            });

            // Type another and press Enter afterwards
            cy.findByRole("textbox", { name: "Send a message…" }).type("my message 1{enter}");
            // It was sent
            cy.get(".mx_EventTile_last .mx_EventTile_body").within(() => {
                cy.findByText("my message 1").should("exist");
            });
        });

        it("can write formatted text", () => {
            cy.findByRole("textbox", { name: "Send a message…" }).type("my bold{ctrl+b} message");
            cy.findByRole("button", { name: "Send message" }).click();
            // Note: both "bold" and "message" are bold, which is probably surprising
            cy.get(".mx_EventTile_body strong").within(() => {
                cy.findByText("bold message").should("exist");
            });
        });

        it("should allow user to input emoji via graphical picker", () => {
            cy.getComposer(false).within(() => {
                cy.findByRole("button", { name: "Emoji" }).click();
            });

            cy.findByTestId("mx_EmojiPicker").within(() => {
                cy.contains(".mx_EmojiPicker_item", "😇").click();
            });

            cy.get(".mx_ContextualMenu_background").click(); // Close emoji picker
            cy.findByRole("textbox", { name: "Send a message…" }).type("{enter}"); // Send message

            cy.get(".mx_EventTile_body").within(() => {
                cy.findByText("😇");
            });
        });

        describe("when Ctrl+Enter is required to send", () => {
            beforeEach(() => {
                cy.setSettingValue("MessageComposerInput.ctrlEnterToSend", null, SettingLevel.ACCOUNT, true);
            });

            it("only sends when you press Ctrl+Enter", () => {
                // Type a message and press Enter
                cy.findByRole("textbox", { name: "Send a message…" }).type("my message 3{enter}");
                // It has not been sent yet
                cy.contains(".mx_EventTile_body", "my message 3").should("not.exist");

                // Press Ctrl+Enter
                cy.findByRole("textbox", { name: "Send a message…" }).type("{ctrl+enter}");
                // It was sent
                cy.get(".mx_EventTile_last .mx_EventTile_body").within(() => {
                    cy.findByText("my message 3").should("exist");
                });
            });
        });
    });

    describe("Rich text editor", () => {
        beforeEach(() => {
            cy.enableLabsFeature("feature_wysiwyg_composer");
            cy.initTestUser(homeserver, "Janet").then(() => {
                cy.createRoom({ name: "Composing Room" });
            });
            cy.viewRoomByName("Composing Room");
        });

        it("sends a message when you click send or press Enter", () => {
            // Type a message
            cy.get("div[contenteditable=true]").type("my message 0");
            // It has not been sent yet
            cy.contains(".mx_EventTile_body", "my message 0").should("not.exist");

            // Click send
            cy.findByRole("button", { name: "Send message" }).click();
            // It has been sent
            cy.get(".mx_EventTile_last .mx_EventTile_body").within(() => {
                cy.findByText("my message 0").should("exist");
            });

            // Type another
            cy.get("div[contenteditable=true]").type("my message 1");
            // Send message
            cy.get("div[contenteditable=true]").type("{enter}");
            // It was sent
            cy.get(".mx_EventTile_last .mx_EventTile_body").within(() => {
                cy.findByText("my message 1").should("exist");
            });
        });

        it("sends only one message when you press Enter multiple times", () => {
            // Type a message
            cy.get("div[contenteditable=true]").type("my message 0");
            // It has not been sent yet
            cy.contains(".mx_EventTile_body", "my message 0").should("not.exist");

            // Click send
            cy.get("div[contenteditable=true]").type("{enter}");
            cy.get("div[contenteditable=true]").type("{enter}");
            cy.get("div[contenteditable=true]").type("{enter}");
            // It has been sent
            cy.get(".mx_EventTile_last .mx_EventTile_body").within(() => {
                cy.findByText("my message 0").should("exist");
            });
            cy.get(".mx_EventTile_last .mx_EventTile_body").should("have.length", 1);
        });

        it("can write formatted text", () => {
            cy.get("div[contenteditable=true]").type("my {ctrl+b}bold{ctrl+b} message");
            cy.findByRole("button", { name: "Send message" }).click();
            cy.get(".mx_EventTile_body strong").within(() => {
                cy.findByText("bold").should("exist");
            });
        });

        describe("when Ctrl+Enter is required to send", () => {
            beforeEach(() => {
                cy.setSettingValue("MessageComposerInput.ctrlEnterToSend", null, SettingLevel.ACCOUNT, true);
            });

            it("only sends when you press Ctrl+Enter", () => {
                // Type a message and press Enter
                cy.get("div[contenteditable=true]").type("my message 3");
                cy.get("div[contenteditable=true]").type("{enter}");
                // It has not been sent yet
                cy.contains(".mx_EventTile_body", "my message 3").should("not.exist");

                // Press Ctrl+Enter
                cy.get("div[contenteditable=true]").type("{ctrl+enter}");
                // It was sent
                cy.get(".mx_EventTile_last .mx_EventTile_body").within(() => {
                    cy.findByText("my message 3").should("exist");
                });
            });
        });

        describe("links", () => {
            it("create link with a forward selection", () => {
                // Type a message
                cy.get("div[contenteditable=true]").type("my message 0{selectAll}");

                // Open link modal
                cy.findByRole("button", { name: "Link" }).click();
                // Fill the link field
                cy.findByRole("textbox", { name: "Link" }).type("https://matrix.org/");
                // Click on save
                cy.findByRole("button", { name: "Save" }).click();
                // Send the message
                cy.findByRole("button", { name: "Send message" }).click();

                // It was sent
                cy.get(".mx_EventTile_body a").within(() => {
                    cy.findByText("my message 0").should("exist");
                });
                cy.get(".mx_EventTile_body a").should("have.attr", "href").and("include", "https://matrix.org/");
            });
        });
    });
});
