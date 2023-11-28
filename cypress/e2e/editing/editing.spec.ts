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

import type { MsgType, IContent } from "matrix-js-sdk/src/matrix";
import { HomeserverInstance } from "../../plugins/utils/homeserver";

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

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Edith").then(() => {
                cy.createRoom({ name: "Test room" });
                cy.injectAxe();
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
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
