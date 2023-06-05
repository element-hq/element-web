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

import _ from "lodash";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { Interception } from "cypress/types/net-stubbing";

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { ProxyInstance } from "../../plugins/sliding-sync";

describe("Sliding Sync", () => {
    beforeEach(() => {
        cy.startHomeserver("default")
            .as("homeserver")
            .then((homeserver) => {
                cy.startProxy(homeserver).as("proxy");
            });

        cy.all([cy.get<HomeserverInstance>("@homeserver"), cy.get<ProxyInstance>("@proxy")]).then(
            ([homeserver, proxy]) => {
                cy.enableLabsFeature("feature_sliding_sync");

                cy.intercept("/config.json?cachebuster=*", (req) => {
                    return req.continue((res) => {
                        res.send(200, {
                            ...res.body,
                            setting_defaults: {
                                feature_sliding_sync_proxy_url: `http://localhost:${proxy.port}`,
                            },
                        });
                    });
                });

                cy.initTestUser(homeserver, "Sloth").then(() => {
                    return cy.window({ log: false }).then(() => {
                        cy.createRoom({ name: "Test Room" }).as("roomId");
                    });
                });
            },
        );
    });

    afterEach(() => {
        cy.get<HomeserverInstance>("@homeserver").then(cy.stopHomeserver);
        cy.get<ProxyInstance>("@proxy").then(cy.stopProxy);
    });

    // assert order
    const checkOrder = (wantOrder: string[]) => {
        cy.findByRole("group", { name: "Rooms" })
            .find(".mx_RoomTile_title")
            .should((elements) => {
                expect(
                    _.map(elements, (e) => {
                        return e.textContent;
                    }),
                    "rooms are sorted",
                ).to.deep.equal(wantOrder);
            });
    };
    const bumpRoom = (alias: string) => {
        // Send a message into the given room, this should bump the room to the top
        cy.get<string>(alias).then((roomId) => {
            return cy.sendEvent(roomId, null, "m.room.message", {
                body: "Hello world",
                msgtype: "m.text",
            });
        });
    };
    const createAndJoinBob = () => {
        // create a Bob user
        cy.get<HomeserverInstance>("@homeserver").then((homeserver) => {
            return cy
                .getBot(homeserver, {
                    displayName: "Bob",
                })
                .as("bob");
        });

        // invite Bob to Test Room and accept then send a message.
        cy.all([cy.get<string>("@roomId"), cy.get<MatrixClient>("@bob")]).then(([roomId, bob]) => {
            return cy.inviteUser(roomId, bob.getUserId()).then(() => {
                return bob.joinRoom(roomId);
            });
        });
    };

    it.skip("should render the Rooms list in reverse chronological order by default and allowing sorting A-Z", () => {
        // create rooms and check room names are correct
        cy.createRoom({ name: "Apple" }).then(() => cy.findByRole("treeitem", { name: "Apple" }));
        cy.createRoom({ name: "Pineapple" }).then(() => cy.findByRole("treeitem", { name: "Pineapple" }));
        cy.createRoom({ name: "Orange" }).then(() => cy.findByRole("treeitem", { name: "Orange" }));

        cy.get(".mx_RoomSublist_tiles").within(() => {
            cy.findAllByRole("treeitem").should("have.length", 4); // due to the Test Room in beforeEach
        });

        checkOrder(["Orange", "Pineapple", "Apple", "Test Room"]);

        cy.findByRole("group", { name: "Rooms" }).within(() => {
            cy.get(".mx_RoomSublist_headerContainer")
                .realHover()
                .findByRole("button", { name: "List options" })
                .click();
        });

        // force click as the radio button's size is zero
        cy.findByRole("menuitemradio", { name: "A-Z" }).click({ force: true });

        // Assert that the radio button is checked
        cy.get(".mx_StyledRadioButton_checked").within(() => {
            cy.findByText("A-Z").should("exist");
        });

        checkOrder(["Apple", "Orange", "Pineapple", "Test Room"]);
    });

    it.skip("should move rooms around as new events arrive", () => {
        // create rooms and check room names are correct
        cy.createRoom({ name: "Apple" })
            .as("roomA")
            .then(() => cy.findByRole("treeitem", { name: "Apple" }));
        cy.createRoom({ name: "Pineapple" })
            .as("roomP")
            .then(() => cy.findByRole("treeitem", { name: "Pineapple" }));
        cy.createRoom({ name: "Orange" })
            .as("roomO")
            .then(() => cy.findByRole("treeitem", { name: "Orange" }));

        // Select the Test Room
        cy.findByRole("treeitem", { name: "Test Room" }).click();

        checkOrder(["Orange", "Pineapple", "Apple", "Test Room"]);
        bumpRoom("@roomA");
        checkOrder(["Apple", "Orange", "Pineapple", "Test Room"]);
        bumpRoom("@roomO");
        checkOrder(["Orange", "Apple", "Pineapple", "Test Room"]);
        bumpRoom("@roomO");
        checkOrder(["Orange", "Apple", "Pineapple", "Test Room"]);
        bumpRoom("@roomP");
        checkOrder(["Pineapple", "Orange", "Apple", "Test Room"]);
    });

    it.skip("should not move the selected room: it should be sticky", () => {
        // create rooms and check room names are correct
        cy.createRoom({ name: "Apple" })
            .as("roomA")
            .then(() => cy.findByRole("treeitem", { name: "Apple" }));
        cy.createRoom({ name: "Pineapple" })
            .as("roomP")
            .then(() => cy.findByRole("treeitem", { name: "Pineapple" }));
        cy.createRoom({ name: "Orange" })
            .as("roomO")
            .then(() => cy.findByRole("treeitem", { name: "Orange" }));

        // Given a list of Orange, Pineapple, Apple - if Pineapple is active and a message is sent in Apple, the list should
        // turn into Apple, Pineapple, Orange - the index position of Pineapple never changes even though the list should technically
        // be Apple, Orange Pineapple - only when you click on a different room do things reshuffle.

        // Select the Pineapple room
        cy.findByRole("treeitem", { name: "Pineapple" }).click();
        checkOrder(["Orange", "Pineapple", "Apple", "Test Room"]);

        // Move Apple
        bumpRoom("@roomA");
        checkOrder(["Apple", "Pineapple", "Orange", "Test Room"]);

        // Select the Test Room
        cy.findByRole("treeitem", { name: "Test Room" }).click();

        // the rooms reshuffle to match reality
        checkOrder(["Apple", "Orange", "Pineapple", "Test Room"]);
    });

    it.skip("should show the right unread notifications", () => {
        createAndJoinBob();

        // send a message in the test room: unread notif count shoould increment
        cy.all([cy.get<string>("@roomId"), cy.get<MatrixClient>("@bob")]).then(([roomId, bob]) => {
            return bob.sendTextMessage(roomId, "Hello World");
        });

        // check that there is an unread notification (grey) as 1
        cy.findByRole("treeitem", { name: "Test Room 1 unread message." }).contains(".mx_NotificationBadge_count", "1");
        cy.get(".mx_NotificationBadge").should("not.have.class", "mx_NotificationBadge_highlighted");

        // send an @mention: highlight count (red) should be 2.
        cy.all([cy.get<string>("@roomId"), cy.get<MatrixClient>("@bob")]).then(([roomId, bob]) => {
            return bob.sendTextMessage(roomId, "Hello Sloth");
        });
        cy.findByRole("treeitem", { name: "Test Room 2 unread messages including mentions." }).contains(
            ".mx_NotificationBadge_count",
            "2",
        );
        cy.get(".mx_NotificationBadge").should("have.class", "mx_NotificationBadge_highlighted");

        // click on the room, the notif counts should disappear
        cy.findByRole("treeitem", { name: "Test Room 2 unread messages including mentions." }).click();
        cy.findByRole("treeitem", { name: "Test Room" }).should("not.have.class", "mx_NotificationBadge_count");
    });

    it.skip("should not show unread indicators", () => {
        // TODO: for now. Later we should.
        createAndJoinBob();

        // disable notifs in this room (TODO: CS API call?)
        cy.findByRole("treeitem", { name: "Test Room" })
            .realHover()
            .findByRole("button", { name: "Notification options" })
            .click();
        cy.findByRole("menuitemradio", { name: "Mute room" }).click();

        // create a new room so we know when the message has been received as it'll re-shuffle the room list
        cy.createRoom({
            name: "Dummy",
        });
        checkOrder(["Dummy", "Test Room"]);

        cy.all([cy.get<string>("@roomId"), cy.get<MatrixClient>("@bob")]).then(([roomId, bob]) => {
            return bob.sendTextMessage(roomId, "Do you read me?");
        });
        // wait for this message to arrive, tell by the room list resorting
        checkOrder(["Test Room", "Dummy"]);

        cy.findByRole("treeitem", { name: "Test Room" }).get(".mx_NotificationBadge").should("not.exist");
    });

    it("should update user settings promptly", () => {
        cy.openUserSettings("Preferences");
        cy.contains(".mx_SettingsFlag", "Show timestamps in 12 hour format")
            .should("exist")
            .find(".mx_ToggleSwitch_on")
            .should("not.exist");
        cy.contains(".mx_SettingsFlag", "Show timestamps in 12 hour format")
            .should("exist")
            .find(".mx_ToggleSwitch_ball")
            .click();
        cy.contains(".mx_SettingsFlag", "Show timestamps in 12 hour format", { timeout: 2000 })
            .should("exist")
            .find(".mx_ToggleSwitch_on", { timeout: 2000 })
            .should("exist");
    });

    it.skip("should show and be able to accept/reject/rescind invites", () => {
        createAndJoinBob();

        let clientUserId;
        cy.getClient().then((cli) => {
            clientUserId = cli.getUserId();
        });

        // invite Sloth into 3 rooms:
        // - roomJoin: will join this room
        // - roomReject: will reject the invite
        // - roomRescind: will make Bob rescind the invite
        let roomJoin;
        let roomReject;
        let roomRescind;
        let bobClient;
        cy.get<MatrixClient>("@bob")
            .then((bob) => {
                bobClient = bob;
                return Promise.all([
                    bob.createRoom({ name: "Room to Join" }),
                    bob.createRoom({ name: "Room to Reject" }),
                    bob.createRoom({ name: "Room to Rescind" }),
                ]);
            })
            .then(([join, reject, rescind]) => {
                roomJoin = join.room_id;
                roomReject = reject.room_id;
                roomRescind = rescind.room_id;
                return Promise.all([
                    bobClient.invite(roomJoin, clientUserId),
                    bobClient.invite(roomReject, clientUserId),
                    bobClient.invite(roomRescind, clientUserId),
                ]);
            });

        cy.findByRole("group", { name: "Invites" }).within(() => {
            // Exclude headerText
            cy.get(".mx_RoomSublist_tiles").within(() => {
                // Wait for them all to be on the UI
                cy.findAllByRole("treeitem").should("have.length", 3);
            });
        });

        // Select the room to join
        cy.findByRole("treeitem", { name: "Room to Join" }).click();

        cy.get(".mx_RoomView").within(() => {
            // Accept the invite
            cy.findByRole("button", { name: "Accept" }).click();
        });

        checkOrder(["Room to Join", "Test Room"]);

        // Select the room to reject
        cy.findByRole("treeitem", { name: "Room to Reject" }).click();

        cy.get(".mx_RoomView").within(() => {
            // Reject the invite
            cy.findByRole("button", { name: "Reject" }).click();
        });

        cy.findByRole("group", { name: "Invites" }).within(() => {
            // Exclude headerText
            cy.get(".mx_RoomSublist_tiles").within(() => {
                // Wait for the rejected room to disappear
                cy.findAllByRole("treeitem").should("have.length", 2);
            });
        });

        // check the lists are correct
        checkOrder(["Room to Join", "Test Room"]);

        cy.findByRole("group", { name: "Invites" })
            .find(".mx_RoomTile_title")
            .should((elements) => {
                expect(
                    _.map(elements, (e) => {
                        return e.textContent;
                    }),
                    "rooms are sorted",
                ).to.deep.equal(["Room to Rescind"]);
            });

        // now rescind the invite
        cy.get<MatrixClient>("@bob").then((bob) => {
            return bob.kick(roomRescind, clientUserId);
        });

        cy.findByRole("group", { name: "Rooms" }).within(() => {
            // Exclude headerText
            cy.get(".mx_RoomSublist_tiles").within(() => {
                // Wait for the rescind to take effect and check the joined list once more
                cy.findAllByRole("treeitem").should("have.length", 2);
            });
        });

        checkOrder(["Room to Join", "Test Room"]);
    });

    it("should show a favourite DM only in the favourite sublist", () => {
        cy.createRoom({
            name: "Favourite DM",
            is_direct: true,
        })
            .as("room")
            .then((roomId) => {
                cy.getClient().then((cli) => cli.setRoomTag(roomId, "m.favourite", { order: 0.5 }));
            });

        cy.findByRole("group", { name: "Favourites" }).findByText("Favourite DM").should("exist");
        cy.findByRole("group", { name: "People" }).findByText("Favourite DM").should("not.exist");
    });

    // Regression test for a bug in SS mode, but would be useful to have in non-SS mode too.
    // This ensures we are setting RoomViewStore state correctly.
    it.skip("should clear the reply to field when swapping rooms", () => {
        cy.createRoom({ name: "Other Room" })
            .as("roomA")
            .then(() => cy.findByRole("treeitem", { name: "Other Room" }));
        cy.get<string>("@roomId").then((roomId) => {
            return cy.sendEvent(roomId, null, "m.room.message", {
                body: "Hello world",
                msgtype: "m.text",
            });
        });
        // select the room
        cy.findByRole("treeitem", { name: "Test Room" }).click();
        cy.get(".mx_ReplyPreview").should("not.exist");
        // click reply-to on the Hello World message
        cy.get(".mx_EventTile_last")
            .within(() => {
                cy.findByText("Hello world", { timeout: 1000 });
            })
            .realHover()
            .findByRole("button", { name: "Reply" })
            .click();
        // check it's visible
        cy.get(".mx_ReplyPreview").should("exist");
        // now click Other Room
        cy.findByRole("treeitem", { name: "Other Room" }).click();
        // ensure the reply-to disappears
        cy.get(".mx_ReplyPreview").should("not.exist");
        // click back
        cy.findByRole("treeitem", { name: "Test Room" }).click();
        // ensure the reply-to reappears
        cy.get(".mx_ReplyPreview").should("exist");
    });

    // Regression test for https://github.com/vector-im/element-web/issues/21462
    it.skip("should not cancel replies when permalinks are clicked", () => {
        cy.get<string>("@roomId").then((roomId) => {
            // we require a first message as you cannot click the permalink text with the avatar in the way
            return cy
                .sendEvent(roomId, null, "m.room.message", {
                    body: "First message",
                    msgtype: "m.text",
                })
                .then(() => {
                    return cy.sendEvent(roomId, null, "m.room.message", {
                        body: "Permalink me",
                        msgtype: "m.text",
                    });
                })
                .then(() => {
                    cy.sendEvent(roomId, null, "m.room.message", {
                        body: "Reply to me",
                        msgtype: "m.text",
                    });
                });
        });
        // select the room
        cy.findByRole("treeitem", { name: "Test Room" }).click();
        cy.get(".mx_ReplyPreview").should("not.exist");
        // click reply-to on the Reply to me message
        cy.get(".mx_EventTile")
            .last()
            .within(() => {
                cy.findByText("Reply to me");
            })
            .realHover()
            .findByRole("button", { name: "Reply" })
            .click();
        // check it's visible
        cy.get(".mx_ReplyPreview").should("exist");
        // now click on the permalink for Permalink me
        cy.contains(".mx_EventTile", "Permalink me").find("a").click({ force: true });
        // make sure it is now selected with the little green |
        cy.contains(".mx_EventTile_selected", "Permalink me").should("exist");
        // ensure the reply-to does not disappear
        cy.get(".mx_ReplyPreview").should("exist");
    });

    it.skip("should send unsubscribe_rooms for every room switch", () => {
        let roomAId: string;
        let roomPId: string;
        // create rooms and check room names are correct
        cy.createRoom({ name: "Apple" })
            .as("roomA")
            .then((roomId) => (roomAId = roomId))
            .then(() => cy.findByRole("treeitem", { name: "Apple" }));

        cy.createRoom({ name: "Pineapple" })
            .as("roomP")
            .then((roomId) => (roomPId = roomId))
            .then(() => cy.findByRole("treeitem", { name: "Pineapple" }));
        cy.createRoom({ name: "Orange" })
            .as("roomO")
            .then(() => cy.findByRole("treeitem", { name: "Orange" }));

        // Intercept all calls to /sync
        cy.intercept({ method: "POST", url: "**/sync*" }).as("syncRequest");

        const assertUnsubExists = (interception: Interception, subRoomId: string, unsubRoomId: string) => {
            const body = interception.request.body;
            // There may be a request without a txn_id, ignore it, as there won't be any subscription changes
            if (body.txn_id === undefined) {
                return;
            }
            expect(body.unsubscribe_rooms).eql([unsubRoomId]);
            expect(body.room_subscriptions).to.not.have.property(unsubRoomId);
            expect(body.room_subscriptions).to.have.property(subRoomId);
        };

        // Select the Test Room
        cy.findByRole("treeitem", { name: "Apple" }).click();

        // and wait for cypress to get the result as alias
        cy.wait("@syncRequest").then((interception) => {
            // This is the first switch, so no unsubscriptions yet.
            assert.isObject(interception.request.body.room_subscriptions, "room_subscriptions is object");
        });

        // Switch to another room
        cy.findByRole("treeitem", { name: "Pineapple" }).click();
        cy.wait("@syncRequest").then((interception) => assertUnsubExists(interception, roomPId, roomAId));

        // And switch to even another room
        cy.findByRole("treeitem", { name: "Apple" }).click();
        cy.wait("@syncRequest").then((interception) => assertUnsubExists(interception, roomPId, roomAId));

        // TODO: Add tests for encrypted rooms
    });
});
