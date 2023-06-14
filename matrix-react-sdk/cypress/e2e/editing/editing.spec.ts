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

import type { EventType, MsgType } from "matrix-js-sdk/src/@types/event";
import type { ISendEventResponse } from "matrix-js-sdk/src/@types/requests";
import type { IContent } from "matrix-js-sdk/src/models/event";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import Chainable = Cypress.Chainable;

const sendEvent = (roomId: string): Chainable<ISendEventResponse> => {
    return cy.sendEvent(roomId, null, "m.room.message" as EventType, {
        msgtype: "m.text" as MsgType,
        body: "Message",
    });
};

/** generate a message event which will take up some room on the page. */
function mkPadding(n: number): IContent {
    return {
        msgtype: "m.text" as MsgType,
        body: `padding ${n}`,
        format: "org.matrix.custom.html",
        formatted_body: `<h3>Test event ${n}</h3>\n`.repeat(10),
    };
}

describe("Editing", () => {
    let homeserver: HomeserverInstance;
    let roomId: string;

    // Edit "Message"
    const editLastMessage = (edit: string) => {
        cy.get(".mx_EventTile_last").realHover().findByRole("button", { name: "Edit" }).click();
        cy.findByRole("textbox", { name: "Edit message" }).type(`{selectAll}{del}${edit}{enter}`);
    };

    const clickEditedMessage = (edited: string) => {
        // Assert that the message was edited
        cy.contains(".mx_EventTile", edited)
            .should("exist")
            .within(() => {
                // Click to display the message edit history dialog
                cy.contains(".mx_EventTile_edited", "(edited)").click();
            });
    };

    const clickButtonViewSource = () => {
        // Assert that "View Source" button is rendered and click it
        cy.get(".mx_EventTile .mx_EventTile_line").realHover().findByRole("button", { name: "View Source" }).click();
    };

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Edith").then(() => {
                cy.createRoom({ name: "Test room" }).then((_room1Id) => {
                    roomId = _room1Id;
                }),
                    cy.injectAxe();
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should render and interact with the message edit history dialog", () => {
        // Click the "Remove" button on the message edit history dialog
        const clickButtonRemove = () => {
            cy.get(".mx_EventTile_line").realHover().findByRole("button", { name: "Remove" }).click();
        };

        cy.visit("/#/room/" + roomId);

        // Send "Message"
        sendEvent(roomId);

        cy.get(".mx_RoomView_MessageList").within(() => {
            // Edit "Message" to "Massage"
            editLastMessage("Massage");

            // Assert that the edit label is visible
            cy.get(".mx_EventTile_edited").should("be.visible");

            clickEditedMessage("Massage");
        });

        cy.get(".mx_Dialog").within(() => {
            // Assert that the message edit history dialog is rendered
            cy.get(".mx_MessageEditHistoryDialog").within(() => {
                // Assert CSS styles which are difficult or cannot be detected with snapshots are applied as expected
                cy.get("li").should("have.css", "clear", "both");
                cy.get(".mx_EventTile .mx_MessageTimestamp")
                    .should("have.css", "position", "absolute")
                    .should("have.css", "inset-inline-start", "0px")
                    .should("have.css", "text-align", "center");
                // Assert that monospace characters can fill the content line as expected
                cy.get(".mx_EventTile .mx_EventTile_content").should("have.css", "margin-inline-end", "0px");

                // Assert that zero block start padding is applied to mx_EventTile as expected
                // See: .mx_EventTile on _EventTile.pcss
                cy.get(".mx_EventTile").should("have.css", "padding-block-start", "0px");

                // Assert that the date separator is rendered at the top
                cy.get("li:nth-child(1) .mx_DateSeparator").within(() => {
                    cy.get("h2").within(() => {
                        cy.findByText("Today");
                    });
                });

                // Assert that the edited message is rendered under the date separator
                cy.get("li:nth-child(2) .mx_EventTile").within(() => {
                    // Assert that the edited message body consists of both deleted character and inserted character
                    // Above the first "e" of "Message" was replaced with "a"
                    cy.get(".mx_EventTile_content .mx_EventTile_body").should("have.text", "Meassage");

                    cy.get(".mx_EventTile_content .mx_EventTile_body").within(() => {
                        cy.get(".mx_EditHistoryMessage_deletion").within(() => {
                            cy.findByText("e");
                        });
                        cy.get(".mx_EditHistoryMessage_insertion").within(() => {
                            cy.findByText("a");
                        });
                    });
                });

                // Assert that the original message is rendered at the bottom
                cy.get("li:nth-child(3) .mx_EventTile").within(() => {
                    cy.get(".mx_EventTile_content .mx_EventTile_body").within(() => {
                        cy.findByText("Message");
                    });
                });
            });
        });

        // Exclude timestamps from a snapshot
        const percyCSS = ".mx_MessageTimestamp { visibility: hidden !important; }";

        // Take a snapshot of the dialog
        cy.get(".mx_Dialog_wrapper").percySnapshotElement("Message edit history dialog", { percyCSS });

        cy.get(".mx_Dialog").within(() => {
            cy.get(".mx_MessageEditHistoryDialog li:nth-child(2) .mx_EventTile").within(() => {
                cy.get(".mx_EventTile_content .mx_EventTile_body").should("have.text", "Meassage");

                // Click the "Remove" button again
                clickButtonRemove();
            });

            // Do nothing and close the dialog to confirm that the message edit history dialog is rendered
            cy.get(".mx_TextInputDialog").closeDialog();

            // Assert that the message edit history dialog is rendered again after it was closed
            cy.get(".mx_MessageEditHistoryDialog li:nth-child(2) .mx_EventTile").within(() => {
                cy.get(".mx_EventTile_content .mx_EventTile_body").should("have.text", "Meassage");

                // Click the "Remove" button again
                clickButtonRemove();
            });

            // This time remove the message really
            cy.get(".mx_TextInputDialog").within(() => {
                cy.findByRole("textbox", { name: "Reason (optional)" }).type("This is a test."); // Reason
                cy.findByRole("button", { name: "Remove" }).click();
            });

            // Assert that the message edit history dialog is rendered again
            cy.get(".mx_MessageEditHistoryDialog").within(() => {
                // Assert that the date is rendered
                cy.get("li:nth-child(1) .mx_DateSeparator").within(() => {
                    cy.get("h2").within(() => {
                        cy.findByText("Today");
                    });
                });

                // Assert that the original message is rendered under the date on the dialog
                cy.get("li:nth-child(2) .mx_EventTile").within(() => {
                    cy.get(".mx_EventTile_content .mx_EventTile_body").within(() => {
                        cy.findByText("Message");
                    });
                });

                // Assert that the edited message is gone
                cy.contains(".mx_EventTile_content .mx_EventTile_body", "Meassage").should("not.exist");

                cy.closeDialog();
            });
        });

        // Assert that the main timeline is rendered
        cy.get(".mx_RoomView_MessageList").within(() => {
            cy.get(".mx_EventTile_last .mx_RedactedBody").within(() => {
                // Assert that the placeholder is rendered
                cy.findByText("Message deleted");
            });
        });
    });

    it("should render 'View Source' button in developer mode on the message edit history dialog", () => {
        cy.visit("/#/room/" + roomId);

        // Send "Message"
        sendEvent(roomId);

        cy.get(".mx_RoomView_MessageList").within(() => {
            // Edit "Message" to "Massage"
            editLastMessage("Massage");

            // Assert that the edit label is visible
            cy.get(".mx_EventTile_edited").should("be.visible");

            clickEditedMessage("Massage");
        });

        cy.get(".mx_Dialog").within(() => {
            // Assert that the original message is rendered
            cy.get(".mx_MessageEditHistoryDialog li:nth-child(3)").within(() => {
                // Assert that "View Source" is not rendered
                cy.get(".mx_EventTile .mx_EventTile_line")
                    .realHover()
                    .findByRole("button", { name: "View Source" })
                    .should("not.exist");
            });

            cy.closeDialog();
        });

        // Enable developer mode
        cy.setSettingValue("developerMode", null, SettingLevel.ACCOUNT, true);

        cy.get(".mx_RoomView_MessageList").within(() => {
            clickEditedMessage("Massage");
        });

        cy.get(".mx_Dialog").within(() => {
            // Assert that the edited message is rendered
            cy.get(".mx_MessageEditHistoryDialog li:nth-child(2)").within(() => {
                // Assert that "Remove" button for the original message is rendered
                cy.get(".mx_EventTile .mx_EventTile_line").realHover().findByRole("button", { name: "Remove" });

                clickButtonViewSource();
            });

            // Assert that view source dialog is rendered and close the dialog
            cy.get(".mx_ViewSource").closeDialog();

            // Assert that the original message is rendered
            cy.get(".mx_MessageEditHistoryDialog li:nth-child(3)").within(() => {
                // Assert that "Remove" button for the original message does not exist
                cy.get(".mx_EventTile .mx_EventTile_line")
                    .realHover()
                    .findByRole("button", { name: "Remove" })
                    .should("not.exist");

                clickButtonViewSource();
            });

            // Assert that view source dialog is rendered and close the dialog
            cy.get(".mx_ViewSource").closeDialog();
        });
    });

    it("should close the composer when clicking save after making a change and undoing it", () => {
        cy.visit("/#/room/" + roomId);

        sendEvent(roomId);

        // Edit message
        cy.get(".mx_RoomView_body .mx_EventTile").within(() => {
            cy.findByText("Message");
            cy.get(".mx_EventTile_line").realHover().findByRole("button", { name: "Edit" }).click().checkA11y();
            cy.get(".mx_EventTile_line")
                .findByRole("textbox", { name: "Edit message" })
                .type("Foo{backspace}{backspace}{backspace}{enter}")
                .checkA11y();
        });
        cy.get(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]").within(() => {
            cy.findByText("Message");
        });

        // Assert that the edit composer has gone away
        cy.findByRole("textbox", { name: "Edit message" }).should("not.exist");
    });

    it("should correctly display events which are edited, where we lack the edit event", () => {
        // This tests the behaviour when a message has been edited some time after it has been sent, and we
        // jump back in room history to view the event, but do not have the actual edit event.
        //
        // In that scenario, we rely on the server to replace the content (pre-MSC3925), or do it ourselves based on
        // the bundled edit event (post-MSC3925).
        //
        // To test it, we need to have a room with lots of events in, so we can jump around the timeline without
        // paginating in the event itself. Hence, we create a bot user which creates the room and populates it before
        // we join.

        let testRoomId: string;
        let originalEventId: string;
        let editEventId: string;

        // create a second user
        const bobChainable = cy.getBot(homeserver, { displayName: "Bob", userIdPrefix: "bob_" });

        cy.all([cy.window({ log: false }), bobChainable]).then(async ([win, bob]) => {
            // "bob" now creates the room, and sends a load of events in it. Note that all of this happens via calls on
            // the js-sdk rather than Cypress commands, so uses regular async/await.

            const room = await bob.createRoom({ name: "TestRoom", visibility: win.matrixcs.Visibility.Public });
            testRoomId = room.room_id;
            cy.log(`Bot user created room ${room.room_id}`);

            originalEventId = (await bob.sendMessage(room.room_id, { body: "original", msgtype: "m.text" })).event_id;
            cy.log(`Bot user sent original event ${originalEventId}`);

            // send a load of padding events. We make them large, so that they fill the whole screen
            // and the client doesn't end up paginating into the event we want.
            let i = 0;
            while (i < 10) {
                await bob.sendMessage(room.room_id, mkPadding(i++));
            }

            // ... then the edit ...
            editEventId = (
                await bob.sendMessage(room.room_id, {
                    "m.new_content": { body: "Edited body", msgtype: "m.text" },
                    "m.relates_to": {
                        rel_type: "m.replace",
                        event_id: originalEventId,
                    },
                    "body": "* edited",
                    "msgtype": "m.text",
                })
            ).event_id;
            cy.log(`Bot user sent edit event ${editEventId}`);

            // ... then a load more padding ...
            while (i < 20) {
                await bob.sendMessage(room.room_id, mkPadding(i++));
            }
        });

        cy.getClient().then((cli) => {
            // now have the cypress user join the room, jump to the original event, and wait for the event to be
            // visible
            cy.joinRoom(testRoomId);
            cy.viewRoomByName("TestRoom");
            cy.visit(`#/room/${testRoomId}/${originalEventId}`);
            cy.get(`[data-event-id="${originalEventId}"]`).should((messageTile) => {
                // at this point, the edit event should still be unknown
                expect(cli.getRoom(testRoomId).getTimelineForEvent(editEventId)).to.be.null;

                // nevertheless, the event should be updated
                expect(messageTile.find(".mx_EventTile_body").text()).to.eq("Edited body");
                expect(messageTile.find(".mx_EventTile_edited")).to.exist;
            });
        });
    });
});
