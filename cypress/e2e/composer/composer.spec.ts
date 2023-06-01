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
import { EventType } from "matrix-js-sdk/src/@types/event";

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { MatrixClient } from "../../global";

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

        describe("Commands", () => {
            // TODO add tests for rich text mode

            describe("Plain text mode", () => {
                it("autocomplete behaviour tests", () => {
                    // Select plain text mode after composer is ready
                    cy.get("div[contenteditable=true]").should("exist");
                    cy.findByRole("button", { name: "Hide formatting" }).click();

                    // Typing a single / displays the autocomplete menu and contents
                    cy.findByRole("textbox").type("/");

                    // Check that the autocomplete options are visible and there are more than 0 items
                    cy.findByTestId("autocomplete-wrapper").should("not.be.empty");

                    // Entering `//` or `/ ` hides the autocomplete contents
                    // Add an extra slash for `//`
                    cy.findByRole("textbox").type("/");
                    cy.findByTestId("autocomplete-wrapper").should("be.empty");
                    // Remove the extra slash to go back to `/`
                    cy.findByRole("textbox").type("{Backspace}");
                    cy.findByTestId("autocomplete-wrapper").should("not.be.empty");
                    // Add a trailing space for `/ `
                    cy.findByRole("textbox").type(" ");
                    cy.findByTestId("autocomplete-wrapper").should("be.empty");

                    // Typing a command that takes no arguments (/devtools) and selecting by click works
                    cy.findByRole("textbox").type("{Backspace}dev");
                    cy.findByTestId("autocomplete-wrapper").within(() => {
                        cy.findByText("/devtools").click();
                    });
                    // Check it has closed the autocomplete and put the text into the composer
                    cy.findByTestId("autocomplete-wrapper").should("not.be.visible");
                    cy.findByRole("textbox").within(() => {
                        cy.findByText("/devtools").should("exist");
                    });
                    // Send the message and check the devtools dialog appeared, then close it
                    cy.findByRole("button", { name: "Send message" }).click();
                    cy.findByRole("dialog").within(() => {
                        cy.findByText("Developer Tools").should("exist");
                    });
                    cy.findByRole("button", { name: "Close dialog" }).click();

                    // Typing a command that takes arguments (/spoiler) and selecting with enter works
                    cy.findByRole("textbox").type("/spoil");
                    cy.findByTestId("autocomplete-wrapper").within(() => {
                        cy.findByText("/spoiler").should("exist");
                    });
                    cy.findByRole("textbox").type("{Enter}");
                    // Check it has closed the autocomplete and put the text into the composer
                    cy.findByTestId("autocomplete-wrapper").should("not.be.visible");
                    cy.findByRole("textbox").within(() => {
                        cy.findByText("/spoiler").should("exist");
                    });
                    // Enter some more text, then send the message
                    cy.findByRole("textbox").type("this is the spoiler text ");
                    cy.findByRole("button", { name: "Send message" }).click();
                    // Check that a spoiler item has appeared in the timeline and contains the spoiler command text
                    cy.get("span.mx_EventTile_spoiler").should("exist");
                    cy.findByText("this is the spoiler text").should("exist");
                });
            });
        });

        describe("Mentions", () => {
            // TODO add tests for rich text mode

            describe("Plain text mode", () => {
                it("autocomplete behaviour tests", () => {
                    // Setup a private room so we have another user to mention
                    const otherUserName = "Bob";
                    let bobClient: MatrixClient;
                    cy.getBot(homeserver, {
                        displayName: otherUserName,
                    }).then((bob) => {
                        bobClient = bob;
                    });
                    // create DM with bob
                    cy.getClient().then(async (cli) => {
                        const bobRoom = await cli.createRoom({ is_direct: true });
                        await cli.invite(bobRoom.room_id, bobClient.getUserId());
                        await cli.setAccountData("m.direct" as EventType, {
                            [bobClient.getUserId()]: [bobRoom.room_id],
                        });
                    });

                    cy.viewRoomByName("Bob");

                    // Select plain text mode after composer is ready
                    cy.get("div[contenteditable=true]").should("exist");
                    cy.findByRole("button", { name: "Hide formatting" }).click();

                    // Typing a single @ does not display the autocomplete menu and contents
                    cy.findByRole("textbox").type("@");
                    cy.findByTestId("autocomplete-wrapper").should("be.empty");

                    // Entering the first letter of the other user's name opens the autocomplete...
                    cy.findByRole("textbox").type(otherUserName.slice(0, 1));
                    cy.findByTestId("autocomplete-wrapper")
                        .should("not.be.empty")
                        .within(() => {
                            // ...with the other user name visible, and clicking that username...
                            cy.findByText(otherUserName).should("exist").click();
                        });
                    // ...inserts the username into the composer
                    cy.findByRole("textbox").within(() => {
                        cy.findByText(otherUserName, { exact: false })
                            .should("exist")
                            .should("have.attr", "contenteditable", "false")
                            .should("have.attr", "data-mention-type", "user");
                    });

                    // Send the message to clear the composer
                    cy.findByRole("button", { name: "Send message" }).click();

                    // Typing an @, then other user's name, then trailing space closes the autocomplete
                    cy.findByRole("textbox").type(`@${otherUserName} `);
                    cy.findByTestId("autocomplete-wrapper").should("be.empty");

                    // Send the message to clear the composer
                    cy.findByRole("button", { name: "Send message" }).click();

                    // Moving the cursor back to an "incomplete" mention opens the autocomplete
                    cy.findByRole("textbox").type(`initial text @${otherUserName.slice(0, 1)} abc`);
                    cy.findByTestId("autocomplete-wrapper").should("be.empty");
                    // Move the cursor left by 4 to put it to: `@B| abc`, check autocomplete displays
                    cy.findByRole("textbox").type(`${"{leftArrow}".repeat(4)}`);
                    cy.findByTestId("autocomplete-wrapper").should("not.be.empty");

                    // Selecting the autocomplete option using Enter inserts it into the composer
                    cy.findByRole("textbox").type(`{Enter}`);
                    cy.findByRole("textbox").within(() => {
                        cy.findByText(otherUserName, { exact: false })
                            .should("exist")
                            .should("have.attr", "contenteditable", "false")
                            .should("have.attr", "data-mention-type", "user");
                    });
                });
            });
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
