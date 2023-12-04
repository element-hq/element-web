/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

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

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { UserCredentials } from "../../support/login";
import { waitForRoom } from "../utils";
import { Filter } from "../../support/settings";

describe("Knock Into Room", () => {
    let homeserver: HomeserverInstance;
    let user: UserCredentials;
    let bot: MatrixClient;

    let roomId;

    beforeEach(() => {
        cy.enableLabsFeature("feature_ask_to_join");

        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Alice").then((_user) => {
                user = _user;
            });

            cy.getBot(homeserver, { displayName: "Bob" }).then(async (_bot) => {
                bot = _bot;

                const { room_id: newRoomId } = await bot.createRoom({
                    name: "Cybersecurity",
                    initial_state: [
                        {
                            type: "m.room.join_rules",
                            content: {
                                join_rule: "knock",
                            },
                            state_key: "",
                        },
                    ],
                });

                roomId = newRoomId;
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should knock into the room then knock is approved and user joins the room then user is kicked and joins again", () => {
        cy.viewRoomById(roomId);

        cy.get(".mx_RoomPreviewBar").within(() => {
            cy.findByRole("button", { name: "Join the discussion" }).click();

            cy.findByRole("heading", { name: "Ask to join?" });
            cy.findByRole("textbox");
            cy.findByRole("button", { name: "Request access" }).click();

            cy.findByRole("heading", { name: "Request to join sent" });
        });

        // Knocked room should appear in Rooms
        cy.findByRole("group", { name: "Rooms" }).findByRole("treeitem", { name: "Cybersecurity" });

        cy.window().then(async (win) => {
            // bot waits for knock request from Alice
            await waitForRoom(win, bot, roomId, (room) => {
                const events = room.getLiveTimeline().getEvents();
                return events.some(
                    (e) =>
                        e.getType() === "m.room.member" &&
                        e.getContent()?.membership === "knock" &&
                        e.getContent()?.displayname === "Alice",
                );
            });

            // bot invites Alice
            await bot.invite(roomId, user.userId);
        });

        cy.findByRole("group", { name: "Invites" }).findByRole("treeitem", { name: "Cybersecurity" });

        // Alice have to accept invitation in order to join the room.
        // It will be not needed when homeserver implements auto accept knock requests.
        cy.get(".mx_RoomView").findByRole("button", { name: "Accept" }).click();

        cy.findByRole("group", { name: "Rooms" }).findByRole("treeitem", { name: "Cybersecurity" });

        cy.findByText("Alice joined the room").should("exist");

        cy.window().then(async (win) => {
            // bot kicks Alice
            await bot.kick(roomId, user.userId);
        });

        cy.get(".mx_RoomPreviewBar").within(() => {
            cy.findByRole("button", { name: "Re-join" }).click();

            cy.findByRole("heading", { name: "Ask to join Cybersecurity?" });
            cy.findByRole("button", { name: "Request access" }).click();
        });

        cy.window().then(async (win) => {
            // bot waits for knock request from Alice
            await waitForRoom(win, bot, roomId, (room) => {
                const events = room.getLiveTimeline().getEvents();
                return events.some(
                    (e) =>
                        e.getType() === "m.room.member" &&
                        e.getContent()?.membership === "knock" &&
                        e.getContent()?.displayname === "Alice",
                );
            });

            // bot invites Alice
            await bot.invite(roomId, user.userId);
        });

        // Alice have to accept invitation in order to join the room.
        // It will be not needed when homeserver implements auto accept knock requests.
        cy.get(".mx_RoomView").findByRole("button", { name: "Accept" }).click();

        cy.findByText("Alice was invited, joined, was removed, was invited, and joined").should("exist");
    });

    it("should knock into the room then knock is approved and user joins the room then user is banned/unbanned and joins again", () => {
        cy.viewRoomById(roomId);

        cy.get(".mx_RoomPreviewBar").within(() => {
            cy.findByRole("button", { name: "Join the discussion" }).click();

            cy.findByRole("heading", { name: "Ask to join?" });
            cy.findByRole("textbox");
            cy.findByRole("button", { name: "Request access" }).click();

            cy.findByRole("heading", { name: "Request to join sent" });
        });

        // Knocked room should appear in Rooms
        cy.findByRole("group", { name: "Rooms" }).findByRole("treeitem", { name: "Cybersecurity" });

        cy.window().then(async (win) => {
            // bot waits for knock request from Alice
            await waitForRoom(win, bot, roomId, (room) => {
                const events = room.getLiveTimeline().getEvents();
                return events.some(
                    (e) =>
                        e.getType() === "m.room.member" &&
                        e.getContent()?.membership === "knock" &&
                        e.getContent()?.displayname === "Alice",
                );
            });

            // bot invites Alice
            await bot.invite(roomId, user.userId);
        });

        cy.findByRole("group", { name: "Invites" }).findByRole("treeitem", { name: "Cybersecurity" });

        // Alice have to accept invitation in order to join the room.
        // It will be not needed when homeserver implements auto accept knock requests.
        cy.get(".mx_RoomView").findByRole("button", { name: "Accept" }).click();

        cy.findByRole("group", { name: "Rooms" }).findByRole("treeitem", { name: "Cybersecurity" });

        cy.findByText("Alice joined the room").should("exist");

        cy.window().then(async (win) => {
            // bot bans Alice
            await bot.ban(roomId, user.userId);
        });

        cy.get(".mx_RoomPreviewBar").findByText("You were banned from Cybersecurity by Bob").should("exist");

        cy.window().then(async (win) => {
            // bot unbans Alice
            await bot.unban(roomId, user.userId);
        });

        cy.get(".mx_RoomPreviewBar").within(() => {
            cy.findByRole("button", { name: "Re-join" }).click();

            cy.findByRole("heading", { name: "Ask to join Cybersecurity?" });
            cy.findByRole("button", { name: "Request access" }).click();
        });

        cy.window().then(async (win) => {
            // bot waits for knock request from Alice
            await waitForRoom(win, bot, roomId, (room) => {
                const events = room.getLiveTimeline().getEvents();
                return events.some(
                    (e) =>
                        e.getType() === "m.room.member" &&
                        e.getContent()?.membership === "knock" &&
                        e.getContent()?.displayname === "Alice",
                );
            });

            // bot invites Alice
            await bot.invite(roomId, user.userId);
        });

        // Alice have to accept invitation in order to join the room.
        // It will be not needed when homeserver implements auto accept knock requests.
        cy.get(".mx_RoomView").findByRole("button", { name: "Accept" }).click();

        cy.findByText("Alice was invited, joined, was banned, was unbanned, was invited, and joined").should("exist");
    });

    it("should knock into the room and knock is cancelled by user himself", () => {
        cy.viewRoomById(roomId);

        cy.get(".mx_RoomPreviewBar").within(() => {
            cy.findByRole("button", { name: "Join the discussion" }).click();

            cy.findByRole("heading", { name: "Ask to join?" });
            cy.findByRole("textbox");
            cy.findByRole("button", { name: "Request access" }).click();

            cy.findByRole("heading", { name: "Request to join sent" });
        });

        // Knocked room should appear in Rooms
        cy.findByRole("group", { name: "Rooms" }).findByRole("treeitem", { name: "Cybersecurity" });

        cy.get(".mx_RoomPreviewBar").within(() => {
            cy.findByRole("button", { name: "Cancel request" }).click();

            cy.findByRole("heading", { name: "Ask to join Cybersecurity?" });
            cy.findByRole("button", { name: "Request access" });
        });

        cy.findByRole("group", { name: "Historical" }).findByRole("treeitem", { name: "Cybersecurity" });
    });

    it("should knock into the room then knock is cancelled by another user and room is forgotten", () => {
        cy.viewRoomById(roomId);

        cy.get(".mx_RoomPreviewBar").within(() => {
            cy.findByRole("button", { name: "Join the discussion" }).click();

            cy.findByRole("heading", { name: "Ask to join?" });
            cy.findByRole("textbox");
            cy.findByRole("button", { name: "Request access" }).click();

            cy.findByRole("heading", { name: "Request to join sent" });
        });

        // Knocked room should appear in Rooms
        cy.findByRole("group", { name: "Rooms" }).findByRole("treeitem", { name: "Cybersecurity" });

        cy.window().then(async (win) => {
            // bot waits for knock request from Alice
            await waitForRoom(win, bot, roomId, (room) => {
                const events = room.getLiveTimeline().getEvents();
                return events.some(
                    (e) =>
                        e.getType() === "m.room.member" &&
                        e.getContent()?.membership === "knock" &&
                        e.getContent()?.displayname === "Alice",
                );
            });

            // bot kicks Alice
            await bot.kick(roomId, user.userId);
        });

        // Room should stay in Rooms and have red badge when knock is denied
        cy.findByRole("group", { name: "Rooms" }).findByRole("treeitem", { name: "Cybersecurity" }).should("not.exist");
        cy.findByRole("group", { name: "Rooms" }).findByRole("treeitem", { name: "Cybersecurity 1 unread mention." });

        cy.get(".mx_RoomPreviewBar").within(() => {
            cy.findByRole("heading", { name: "You have been denied access" });
            cy.findByRole("button", { name: "Forget this room" }).click();
        });

        // Room should disappear from the list completely when forgotten
        // Should be enabled when issue is fixed: https://github.com/vector-im/element-web/issues/26195
        // cy.findByRole("treeitem", { name: /Cybersecurity/ }).should("not.exist");
    });

    it("should knock into the public knock room via spotlight", () => {
        cy.window().then((win) => {
            bot.setRoomDirectoryVisibility(roomId, win.matrixcs.Visibility.Public);
        });

        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.PublicRooms);
            cy.spotlightResults().eq(0).should("contain", "Cybersecurity");
            cy.spotlightResults().eq(0).click();
        });

        cy.get(".mx_RoomPreviewBar").within(() => {
            cy.findByRole("heading", { name: "Ask to join?" });
            cy.findByRole("textbox");
            cy.findByRole("button", { name: "Request access" }).click();

            cy.findByRole("heading", { name: "Request to join sent" });
        });
    });
});
