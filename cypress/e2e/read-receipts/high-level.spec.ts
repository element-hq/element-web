/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import type { MatrixClient, MatrixEvent, Room, IndexedDBStore } from "matrix-js-sdk/src/matrix";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import Chainable = Cypress.Chainable;

describe("Read receipts", () => {
    const userName = "Mae";
    const botName = "Other User";
    const roomAlpha = "Room Alpha";
    const roomBeta = "Room Beta";

    let homeserver: HomeserverInstance;
    let betaRoomId: string;
    let alphaRoomId: string;
    let bot: MatrixClient | undefined;

    beforeEach(() => {
        // Create 2 rooms: Alpha & Beta. We join the bot to both of them
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, userName)
                .then(() => {
                    cy.createRoom({ name: roomAlpha }).then((createdRoomId) => {
                        alphaRoomId = createdRoomId;
                    });
                })
                .then(() => {
                    cy.createRoom({ name: roomBeta }).then((createdRoomId) => {
                        betaRoomId = createdRoomId;
                    });
                })
                .then(() => {
                    cy.getBot(homeserver, { displayName: botName }).then((botClient) => {
                        bot = botClient;
                    });
                })
                .then(() => {
                    // Invite the bot to both rooms
                    cy.inviteUser(alphaRoomId, bot.getUserId());
                    cy.viewRoomById(alphaRoomId);
                    cy.findByText(botName + " joined the room").should("exist");

                    cy.inviteUser(betaRoomId, bot.getUserId());
                    cy.viewRoomById(betaRoomId);
                    cy.findByText(botName + " joined the room").should("exist");
                });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    abstract class MessageContentSpec {
        public abstract getContent(room: Room): Promise<Record<string, unknown>>;
    }

    abstract class BotActionSpec {
        public abstract performAction(cli: MatrixClient, room: Room): Promise<void>;
    }

    type Message = string | MessageContentSpec | BotActionSpec;

    function goTo(room: string) {
        cy.viewRoomByName(room);
    }

    function findRoomByName(room: string): Chainable<Room> {
        return cy.getClient().then((cli) => {
            return cli.getRooms().find((r) => r.name === room);
        });
    }

    function openThread(rootMessage: string) {
        cy.log("Open thread", rootMessage);
        cy.get(".mx_RoomView_body", { log: false }).within(() => {
            cy.contains(".mx_EventTile[data-scroll-tokens]", rootMessage, { log: false })
                .realHover()
                .findByRole("button", { name: "Reply in thread", log: false })
                .click();
        });
        cy.get(".mx_ThreadView_timelinePanelWrapper", { log: false }).should("have.length", 1);
    }

    function sendMessageAsClient(cli: MatrixClient, room: string, messages: Message[]) {
        findRoomByName(room).then(async ({ roomId }) => {
            const room = cli.getRoom(roomId);
            for (const message of messages) {
                if (typeof message === "string") {
                    await cli.sendTextMessage(roomId, message);
                } else if (message instanceof MessageContentSpec) {
                    await cli.sendMessage(roomId, await message.getContent(room));
                } else {
                    await message.performAction(cli, room);
                }
            }
        });
    }

    /**
     * Sends messages into given room as a bot
     * @param room - the name of the room to send messages into
     * @param messages - the list of messages to send, these can be strings or implementations of MessageSpec like `editOf`
     */
    function receiveMessages(room: string, messages: Message[]) {
        sendMessageAsClient(bot, room, messages);
    }

    /**
     * Sends messages into given room as the currently logged-in user
     * @param room - the name of the room to send messages into
     * @param messages - the list of messages to send, these can be strings or implementations of MessageSpec like `editOf`
     */
    function sendMessages(room: string, messages: Message[]) {
        cy.getClient().then((cli) => sendMessageAsClient(cli, room, messages));
    }

    /**
     * Utility to find a MatrixEvent by its body content
     * @param room - the room to search for the event in
     * @param message - the body of the event to search for
     * @param includeThreads - whether to search within threads too
     */
    async function getMessage(room: Room, message: string, includeThreads = false): Promise<MatrixEvent> {
        let ev = room.timeline.find((e) => e.getContent().body === message);
        if (!ev && includeThreads) {
            for (const thread of room.getThreads()) {
                ev = thread.timeline.find((e) => e.getContent().body === message);
                if (ev) break;
            }
        }

        if (ev) return ev;

        return new Promise((resolve) => {
            room.on("Room.timeline" as any, (ev: MatrixEvent) => {
                if (ev.getContent().body === message) {
                    resolve(ev);
                }
            });
        });
    }

    /**
     * MessageContentSpec to send an edit into a room
     * @param originalMessage - the body of the message to edit
     * @param newMessage - the message body to send in the edit
     */
    function editOf(originalMessage: string, newMessage: string): MessageContentSpec {
        return new (class extends MessageContentSpec {
            public async getContent(room: Room): Promise<Record<string, unknown>> {
                const ev = await getMessage(room, originalMessage, true);

                const content = ev.getContent();
                return {
                    "msgtype": content.msgtype,
                    "body": `* ${newMessage}`,
                    "m.new_content": {
                        msgtype: content.msgtype,
                        body: newMessage,
                    },
                };
            }
        })();
    }

    /**
     * MessageContentSpec to send a reply into a room
     * @param targetMessage - the body of the message to reply to
     * @param newMessage - the message body to send into the reply
     */
    function replyTo(targetMessage: string, newMessage: string): MessageContentSpec {
        return new (class extends MessageContentSpec {
            public async getContent(room: Room): Promise<Record<string, unknown>> {
                const ev = await getMessage(room, targetMessage);

                return {
                    "msgtype": "m.text",
                    "body": newMessage,
                    "m.relates_to": {
                        "m.in_reply_to": {
                            event_id: ev.getId(),
                        },
                    },
                };
            }
        })();
    }

    /**
     * MessageContentSpec to send a threaded response into a room
     * @param rootMessage - the body of the thread root message to send a response to
     * @param newMessage - the message body to send into the thread response
     */
    function threadedOff(rootMessage: string, newMessage: string): MessageContentSpec {
        return new (class extends MessageContentSpec {
            public async getContent(room: Room): Promise<Record<string, unknown>> {
                const ev = await getMessage(room, rootMessage);

                return {
                    "msgtype": "m.text",
                    "body": newMessage,
                    "m.relates_to": {
                        event_id: ev.getId(),
                        is_falling_back: true,
                        rel_type: "m.thread",
                    },
                };
            }
        })();
    }

    /**
     * BotActionSpec to send a reaction to an existing event into a room
     * @param targetMessage - the body of the message to send a reaction to
     * @param reaction - the key of the reaction to send into the room
     */
    function reactionTo(targetMessage: string, reaction: string): BotActionSpec {
        return new (class extends BotActionSpec {
            public async performAction(cli: MatrixClient, room: Room): Promise<void> {
                const ev = await getMessage(room, targetMessage, true);
                const threadId = !ev.isThreadRoot ? ev.threadRootId : undefined;
                await cli.sendEvent(room.roomId, threadId ?? null, "m.reaction", {
                    "m.relates_to": {
                        rel_type: "m.annotation",
                        event_id: ev.getId(),
                        key: reaction,
                    },
                });
            }
        })();
    }

    /**
     * BotActionSpec to send a custom event
     * @param eventType - the type of the event to send
     * @param content - the event content to send
     */
    function customEvent(eventType: string, content: Record<string, any>): BotActionSpec {
        return new (class extends BotActionSpec {
            public async performAction(cli: MatrixClient, room: Room): Promise<void> {
                await cli.sendEvent(room.roomId, null, eventType, content);
            }
        })();
    }

    /**
     * BotActionSpec to send a redaction into a room
     * @param targetMessage - the body of the message to send a redaction to
     */
    function redactionOf(targetMessage: string): BotActionSpec {
        return new (class extends BotActionSpec {
            public async performAction(cli: MatrixClient, room: Room): Promise<void> {
                const ev = await getMessage(room, targetMessage, true);
                await cli.redactEvent(room.roomId, ev.threadRootId, ev.getId());
            }
        })();
    }

    function getRoomListTile(room: string) {
        return cy.findByRole("treeitem", { name: new RegExp("^" + room), log: false });
    }

    function markAsRead(room: string) {
        cy.log("Marking room as read", room);
        getRoomListTile(room).rightclick();
        cy.findByText("Mark as read").click();
    }

    function assertRead(room: string) {
        cy.log("Assert room read", room);
        return getRoomListTile(room).within(() => {
            cy.get(".mx_NotificationBadge_dot").should("not.exist");
            cy.get(".mx_NotificationBadge_count").should("not.exist");
        });
    }

    /**
     * Assert a given room is marked as unread (via the room list tile)
     * @param room - the name of the room to check
     * @param count - the numeric count to assert, or if "." specified then a bold/dot (no count) state is asserted
     */
    function assertUnread(room: string, count: number | ".") {
        cy.log("Assert room unread", room, count);
        return getRoomListTile(room).within(() => {
            if (count === ".") {
                cy.get(".mx_NotificationBadge_dot").should("exist");
            } else {
                cy.get(".mx_NotificationBadge_count").should("have.text", count);
            }
        });
    }

    function openThreadList() {
        cy.log("Open thread list");
        cy.findByTestId("threadsButton", { log: false }).then(($button) => {
            if ($button?.attr("aria-current") !== "true") {
                cy.findByTestId("threadsButton", { log: false }).click();
            }
        });

        cy.get(".mx_ThreadPanel", { log: false })
            .should("exist")
            .then(($panel) => {
                const $button = $panel.find('.mx_BaseCard_back[title="Threads"]');
                // If the Threads back button is present then click it, the threads button can open either threads list or thread panel
                if ($button.length) {
                    $button.trigger("click");
                }
            });
    }

    function getThreadListTile(rootMessage: string) {
        openThreadList();
        return cy.contains(".mx_ThreadPanel .mx_EventTile_body", rootMessage, { log: false }).closest("li");
    }

    function assertReadThread(rootMessage: string) {
        return getThreadListTile(rootMessage).within(() => {
            cy.get(".mx_NotificationBadge", { log: false }).should("not.exist");
        });
    }

    function assertUnreadThread(rootMessage: string) {
        cy.log("Assert unread thread", rootMessage);
        return getThreadListTile(rootMessage).within(() => {
            cy.get(".mx_NotificationBadge").should("exist");
        });
    }

    function saveAndReload() {
        cy.log("Save and reload");
        cy.getClient().then((cli) => {
            // @ts-ignore
            return (cli.store as IndexedDBStore).reallySave();
        });
        cy.reload();
        // Wait for the app to reload
        cy.log("Waiting for app to reload");
        cy.get(".mx_RoomView", { log: false, timeout: 20000 }).should("exist");
    }

    const room1 = roomAlpha;
    const room2 = roomBeta;

    describe("new messages", () => {
        describe("in the main timeline", () => {
            it("Receiving a message makes a room unread", () => {
                goTo(room1);
                assertRead(room2);

                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
            });
            it("Reading latest message makes the room read", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I read the main timeline
                goTo(room2);
                assertRead(room2);
            });
            it.skip("Reading an older message leaves the room unread", () => {});
            it("Marking a room as read makes it read", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                markAsRead(room2);
                assertRead(room2);
            });
            it("Receiving a new message after marking as read makes it unread", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                markAsRead(room2);
                assertRead(room2);

                receiveMessages(room2, ["Msg2"]);
                assertUnread(room2, 1);
            });
            it("A room with a new message is still unread after restart", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                saveAndReload();
                assertUnread(room2, 1);
            });
            it("A room where all messages are read is still read after restart", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                markAsRead(room2);
                assertRead(room2);

                saveAndReload();
                assertRead(room2);
            });
            it.skip("Sending a message from a different client marks room as read", () => {
                goTo(room1);
                assertRead(room2);

                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                sendMessages(room2, ["Msg2"]);
                assertRead(room2);
            });
        });

        describe("in threads", () => {
            it("Sending a message makes a room unread", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                goTo(room2);

                assertRead(room2);
                goTo(room1);

                receiveMessages(room2, [threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 1);
            });
            it("Reading the last threaded message makes the room read", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                goTo(room2);

                openThread("Msg1");
                assertRead(room2);
            });
            it("Reading a thread message makes the thread read", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                goTo(room2);

                // Then room does appear unread
                assertUnread(room2, 2);

                // Until we open the thread
                openThread("Msg1");
                assertReadThread("Msg1");
                assertRead(room2);
            });
            it.skip("Reading an older thread message (via permalink) leaves the thread unread", () => {});
            it("Reading only one thread's message does not make the room read", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), "Msg2", threadedOff("Msg2", "Resp2")]);
                assertUnread(room2, 4);
                goTo(room2);
                assertUnread(room2, 2);

                openThread("Msg1");
                assertUnread(room2, 1);
            });
            it("Reading only one thread's message makes that thread read but not others", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2", threadedOff("Msg1", "Resp1"), threadedOff("Msg2", "Resp2")]);
                assertUnread(room2, 4); // (Sanity)

                // When I read the main timeline
                goTo(room2);

                assertUnread(room2, 2);
                assertUnreadThread("Msg1");
                assertUnreadThread("Msg2");

                openThread("Msg1");
                assertReadThread("Msg1");
                assertUnreadThread("Msg2");
            });
            it("Reading the main timeline does not mark a thread message as read", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                goTo(room2);

                assertUnread(room2, 2);
                // Then thread does appear unread
                assertUnreadThread("Msg1");
            });
            // XXX: fails because the room is still "bold" even though the notification counts all disappear
            it.skip("Marking a room with unread threads as read makes it read", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                markAsRead(room2);
                assertRead(room2);
            });
            // XXX: fails for the same reason as "Marking a room with unread threads as read makes it read"
            it.skip("Sending a new thread message after marking as read makes it unread", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);

                // When I mark the room as read
                markAsRead(room2);
                assertRead(room2);

                // Then another message appears in the thread
                receiveMessages(room2, [threadedOff("Msg1", "Resp3")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails for the same reason as "Marking a room with unread threads as read makes it read"
            it.skip("Sending a new different-thread message after marking as read makes it unread", () => {
                // Given 2 threads exist, and Thread2 has the latest message in it
                goTo(room1);
                receiveMessages(room2, ["Thread1", "Thread2", threadedOff("Thread1", "t1a")]);
                assertUnread(room2, 3);
                receiveMessages(room2, [threadedOff("Thread2", "t2a")]);

                // When I mark the room as read (making an unthreaded receipt for t2a)
                markAsRead(room2);
                assertRead(room2);

                // Then another message appears in the other thread
                receiveMessages(room2, [threadedOff("Thread1", "t1b")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            it("A room with a new threaded message is still unread after restart", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                goTo(room2);

                // Then room does appear unread
                assertUnread(room2, 2);

                saveAndReload();
                assertUnread(room2, 2);

                // Until we open the thread
                openThread("Msg1");
                assertRead(room2);
            });
            it("A room where all threaded messages are read is still read after restart", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                goTo(room2);

                // Then room does appear unread
                assertUnread(room2, 2);

                // Until we open the thread
                openThread("Msg1");
                assertRead(room2);

                saveAndReload();
                assertRead(room2);
            });
        });

        describe("thread roots", () => {
            it("Reading a thread root does not mark the thread as read", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2); // (Sanity)

                // When I read the main timeline
                goTo(room2);

                // Then room does appear unread
                assertUnread(room2, 1);
                assertUnreadThread("Msg1");
            });
            it.skip("Reading a thread root within the thread view marks it as read in the main timeline", () => {});
            it("Creating a new thread based on a reply makes the room unread", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1"), threadedOff("Reply1", "Resp1")]);
                assertUnread(room2, 3);
            });
            it("Reading a thread whose root is a reply makes the room read", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1"), threadedOff("Reply1", "Resp1")]);
                assertUnread(room2, 3);

                goTo(room2);
                assertUnread(room2, 1);
                assertUnreadThread("Reply1");

                openThread("Reply1");
                assertRead(room2);
            });
        });
    });

    describe("editing messages", () => {
        describe("in the main timeline", () => {
            it("Editing a message makes a room unread", () => {
                // Given I am not looking at the room
                goTo(room1);

                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);

                // When an edit appears in the room
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);
            });
            it("Reading an edit makes the room read", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                goTo(room2);
                assertRead(room2);
                goTo(room1);

                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);
                assertUnread(room2, 1);

                // When I read it
                goTo(room2);

                // Then the room becomes read and stays read
                assertRead(room2);
                goTo(room1);
                assertRead(room2);
            });
            it("Marking a room as read after an edit makes it read", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);
                assertUnread(room2, 1);

                // When I mark it as read
                markAsRead(room2);

                // Then the room becomes read
                assertRead(room2);
            });
            it("Editing a message after marking as read makes the room unread", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I mark it as read
                markAsRead(room2);

                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            it("Editing a reply after reading it makes the room unread", () => {
                // Given I am not looking at the room
                goTo(room1);

                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1")]);
                assertUnread(room2, 2);

                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When an edit appears in the room
                receiveMessages(room2, [editOf("Reply1", "Reply1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);
            });
            it("Editing a reply after marking as read makes the room unread", () => {
                // Given I am not looking at the room
                goTo(room1);

                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1")]);
                assertUnread(room2, 2);
                markAsRead(room2);

                // When an edit appears in the room
                receiveMessages(room2, [editOf("Reply1", "Reply1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);
            });
            it("A room with an edit is still unread after restart", () => {
                // Given I am not looking at the room
                goTo(room1);

                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);

                // When an edit appears in the room
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);

                // And remains so after a reload
                saveAndReload();
                assertUnread(room2, 1);
            });
            it("A room where all edits are read is still read after restart", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);
                assertUnread(room2, 1);

                // When I mark it as read
                markAsRead(room2);

                // Then the room becomes read
                assertRead(room2);

                // And remains so after a reload
                saveAndReload();
                assertRead(room2);
            });
        });

        describe("in threads", () => {
            it("An edit of a threaded message makes the room unread", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);

                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);

                receiveMessages(room2, [editOf("Resp1", "Edit1")]);
                assertUnread(room2, 1);
            });
            it("Reading an edit of a threaded message makes the room read", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);

                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);

                receiveMessages(room2, [editOf("Resp1", "Edit1")]);
                assertUnread(room2, 1);

                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
            });
            it("Marking a room as read after an edit in a thread makes it read", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), editOf("Resp1", "Edit1")]);
                assertUnread(room2, 3); // TODO: the edit counts as a message!

                markAsRead(room2);
                assertRead(room2);
            });
            it.skip("Editing a thread message after marking as read makes the room unread", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);

                markAsRead(room2);
                assertRead(room2);

                receiveMessages(room2, [editOf("Resp1", "Edit1")]);
                assertUnread(room2, 1); // TODO: should this edit make us unread?
            });
            it("A room with an edited threaded message is still unread after restart", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), editOf("Resp1", "Edit1")]);
                assertUnread(room2, 3);

                saveAndReload();
                assertUnread(room2, 3);
            });
            it("A room where all threaded edits are read is still read after restart", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), editOf("Resp1", "Edit1")]);
                assertUnread(room2, 3);

                markAsRead(room2);
                assertRead(room2);

                saveAndReload();
                assertRead(room2);
            });
        });

        describe("thread roots", () => {
            it("An edit of a thread root makes the room unread", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);

                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);

                receiveMessages(room2, [editOf("Msg1", "Edit1")]);
                assertUnread(room2, 1);
            });
            it.skip("Reading an edit of a thread root makes the room read", () => {
                // Given a fully-read thread exists
                goTo(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                openThread("Msg1");
                goTo(room1);
                assertRead(room2);

                // When the thread root is edited
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // And I read that edit
                goTo(room2);

                // Then the room becomes read and stays read
                assertRead(room2);
                goTo(room1);
                assertRead(room2);
            });
            it.skip("Marking a room as read after an edit of a thread root makes it read", () => {});
            it.skip("Editing a thread root after marking as read makes the room unread", () => {});
            it.skip("Marking a room as read after an edit of a thread root that is a reply makes it read", () => {});
            it.skip("Editing a thread root that is a reply after marking as read makes the room unread but not the thread", () => {});
        });
    });

    describe("reactions", () => {
        describe("in the main timeline", () => {
            it("Receiving a reaction to a message does not make a room unread", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                // When I read the main timeline
                goTo(room2);
                assertRead(room2);

                goTo(room1);
                receiveMessages(room2, [reactionTo("Msg2", "🪿")]);
                assertRead(room2);
            });
            it("Reacting to a message after marking as read does not make the room unread", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                markAsRead(room2);
                assertRead(room2);

                receiveMessages(room2, [reactionTo("Msg2", "🪿")]);
                assertRead(room2);
            });
            it("A room with an unread reaction is still read after restart", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                markAsRead(room2);
                assertRead(room2);

                receiveMessages(room2, [reactionTo("Msg2", "🪿")]);
                assertRead(room2);

                saveAndReload();
                assertRead(room2);
            });
            it("A room where all reactions are read is still read after restart", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", "Msg2", reactionTo("Msg2", "🪿")]);
                assertUnread(room2, 2);

                markAsRead(room2);
                assertRead(room2);

                saveAndReload();
                assertRead(room2);
            });
        });

        describe("in threads", () => {
            it("A reaction to a threaded message does not make the room unread", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);

                goTo(room2);
                openThread("Msg1");
                assertRead(room2);

                goTo(room1);
                receiveMessages(room2, [reactionTo("Reply1", "🪿")]);

                assertRead(room2);
            });
            it.skip("Marking a room as read after a reaction in a thread makes it read", () => {});
            it.skip("Reacting to a thread message after marking as read makes the room unread", () => {});
            it.skip("A room with a reaction to a threaded message is still unread after restart", () => {});
            it.skip("A room where all reactions in threads are read is still read after restart", () => {});
        });

        describe("thread roots", () => {
            it("A reaction to a thread root does not make the room unread", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);

                goTo(room2);
                openThread("Msg1");
                assertRead(room2);

                goTo(room1);
                receiveMessages(room2, [reactionTo("Msg1", "🪿")]);

                assertRead(room2);
            });
            it.skip("Reading a reaction to a thread root makes the room read", () => {});
            it.skip("Marking a room as read after a reaction to a thread root makes it read", () => {});
            it.skip("Reacting to a thread root after marking as read makes the room unread but not the thread", () => {});
        });
    });

    describe("redactions", () => {
        describe("in the main timeline", () => {
            it("Redacting the message pointed to by my receipt leaves the room read", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                // When I read the main timeline
                goTo(room2);
                assertRead(room2);

                goTo(room1);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertRead(room2);
            });

            it.skip("Reading an unread room after a redaction of the latest message makes it read", () => {});
            it.skip("Reading an unread room after a redaction of an older message makes it read", () => {});
            it.skip("Marking an unread room as read after a redaction makes it read", () => {});
            it.skip("Sending and redacting a message after marking the room as read makes it unread", () => {});
            it.skip("?? Redacting a message after marking the room as read makes it unread", () => {});
            it.skip("Reacting to a redacted message leaves the room read", () => {});
            it.skip("Editing a redacted message leaves the room read", () => {});

            it.skip("?? Reading a reaction to a redacted message marks the room as read", () => {});
            it.skip("?? Reading an edit of a redacted message marks the room as read", () => {});
            it.skip("Reading a reply to a redacted message marks the room as read", () => {});

            it.skip("A room with an unread redaction is still unread after restart", () => {});
            it.skip("A room with a read redaction is still read after restart", () => {});
        });

        describe("in threads", () => {
            // One of the following two must be right:
            it.skip("Redacting the threaded message pointed to by my receipt leaves the room read", () => {});
            it.skip("Redacting a threaded message after it was read makes the room unread", () => {});

            it.skip("Reading an unread thread after a redaction of the latest message makes it read", () => {});
            it.skip("Reading an unread thread after a redaction of an older message makes it read", () => {});
            it.skip("Marking an unread thread as read after a redaction makes it read", () => {});
            it.skip("Sending and redacting a message after marking the thread as read makes it unread", () => {});
            it.skip("?? Redacting a message after marking the thread as read makes it unread", () => {});
            it.skip("Reacting to a redacted message leaves the thread read", () => {});
            it.skip("Editing a redacted message leaves the thread read", () => {});

            it.skip("?? Reading a reaction to a redacted message marks the thread as read", () => {});
            it.skip("?? Reading an edit of a redacted message marks the thread as read", () => {});
            it.skip("Reading a reply to a redacted message marks the thread as read", () => {});

            it.skip("A thread with an unread redaction is still unread after restart", () => {});
            it.skip("A thread with a read redaction is still read after restart", () => {});
            it.skip("A thread with an unread reply to a redacted message is still unread after restart", () => {});
            it.skip("A thread with a read replt to a redacted message is still read after restart", () => {});
        });

        describe("thread roots", () => {
            // One of the following two must be right:
            it.skip("Redacting a thread root after it was read leaves the room read", () => {});
            it.skip("Redacting a thread root after it was read makes the room unread", () => {});

            it.skip("Redacting the root of an unread thread makes the room read", () => {});
            it.skip("Sending a threaded message onto a redacted thread root leaves the room read", () => {});
            it.skip("Reacting to a redacted thread root leaves the room read", () => {});
            it.skip("Editing a redacted thread root leaves the room read", () => {});
            it.skip("Replying to a redacted thread root makes the room unread", () => {});
            it.skip("Reading a reply to a redacted thread root makes the room read", () => {});
        });
    });

    describe("messages with missing referents", () => {
        it.skip("A message in an unknown thread is not visible and the room is read", () => {});
        it.skip("When a message's thread root appears later the thread appears and the room is unread", () => {});
        it.skip("An edit of an unknown message is not visible and the room is read", () => {});
        it.skip("When an edit's message appears later the edited version appears and the room is unread", () => {});
        it.skip("A reaction to an unknown message is not visible and the room is read", () => {});
        it.skip("When an reactions's message appears later it appears and the room is unread", () => {});
        // Harder: validate that we request the messages we are missing?
    });

    describe("receipts with missing events", () => {
        // Later: when we have order in receipts, we can change these tests to
        // make receipts still work, even when their message is not found.
        it.skip("A receipt for an unknown message does not change the state of an unread room", () => {});
        it.skip("A receipt for an unknown message does not change the state of a read room", () => {});
        it.skip("A threaded receipt for an unknown message does not change the state of an unread thread", () => {});
        it.skip("A threaded receipt for an unknown message does not change the state of a read thread", () => {});
        it.skip("A threaded receipt for an unknown thread does not change the state of an unread thread", () => {});
        it.skip("A threaded receipt for an unknown thread does not change the state of a read thread", () => {});
        it.skip("A threaded receipt for a message on main does not change the state of an unread room", () => {});
        it.skip("A threaded receipt for a message on main does not change the state of a read room", () => {});
        it.skip("A main receipt for a message on a thread does not change the state of an unread room", () => {});
        it.skip("A main receipt for a message on a thread does not change the state of a read room", () => {});
        it.skip("A threaded receipt for a thread root does not mark it as read", () => {});
        // Harder: validate that we request the messages we are missing?
    });

    describe("Message ordering", () => {
        describe("in the main timeline", () => {
            it.skip("A receipt for the last event in sync order (even with wrong ts) marks a room as read", () => {});
            it.skip("A receipt for a non-last event in sync order (even when ts makes it last) leaves room unread", () => {});
        });

        describe("in threads", () => {
            // These don't pass yet - we need MSC4033 - we don't even know the Sync order yet
            it.skip("A receipt for the last event in sync order (even with wrong ts) marks a thread as read", () => {});
            it.skip("A receipt for a non-last event in sync order (even when ts makes it last) leaves thread unread", () => {});

            // These pass now and should not later - we should use order from MSC4033 instead of ts
            // These are broken out
            it.skip("A receipt for last threaded event in ts order (even when it was received non-last) marks a thread as read", () => {});
            it.skip("A receipt for non-last threaded event in ts order (even when it was received last) leaves thread unread", () => {});
            it.skip("A receipt for last threaded edit in ts order (even when it was received non-last) marks a thread as read", () => {});
            it.skip("A receipt for non-last threaded edit in ts order (even when it was received last) leaves thread unread", () => {});
            it.skip("A receipt for last threaded reaction in ts order (even when it was received non-last) marks a thread as read", () => {});
            it.skip("A receipt for non-last threaded reaction in ts order (even when it was received last) leaves thread unread", () => {});
        });

        describe("thread roots", () => {
            it.skip("A receipt for last reaction to thread root in sync order (even when ts makes it last) marks room as read", () => {});
            it.skip("A receipt for non-last reaction to thread root in sync order (even when ts makes it last) leaves room unread", () => {});
            it.skip("A receipt for last edit to thread root in sync order (even when ts makes it last) marks room as read", () => {});
            it.skip("A receipt for non-last edit to thread root in sync order (even when ts makes it last) leaves room unread", () => {});
        });
    });

    describe("Ignored events", () => {
        it("If all events after receipt are unimportant, the room is read", () => {
            goTo(room1);
            assertRead(room2);
            receiveMessages(room2, ["Msg1", "Msg2"]);
            assertUnread(room2, 2);

            markAsRead(room2);

            receiveMessages(room2, [customEvent("org.custom.event", { body: "foobar" })]);
            assertRead(room2);
        });
        it("Sending an important event after unimportant ones makes the room unread", () => {
            goTo(room1);
            assertRead(room2);
            receiveMessages(room2, ["Msg1", "Msg2"]);
            assertUnread(room2, 2);

            markAsRead(room2);

            receiveMessages(room2, [customEvent("org.custom.event", { body: "foobar" })]);
            assertRead(room2);

            receiveMessages(room2, ["Hello"]);
            assertUnread(room2, 1);
        });
        it.skip("A receipt for the last unimportant event makes the room read, even if all are unimportant", () => {});
    });

    describe("Paging up", () => {
        it.skip("Paging up through old messages after a room is read leaves the room read", () => {});
        it.skip("Paging up through old messages of an unread room leaves the room unread", () => {});
        it.skip("Paging up to find old threads that were previously read leaves the room read", () => {});
        it.skip("?? Paging up to find old threads that were never read marks the room unread", () => {});
        it.skip("After marking room as read, paging up to find old threads that were never read leaves the room read", () => {});
    });

    describe("Room list order", () => {
        it.skip("Rooms with unread threads appear at the top of room list if 'unread first' is selected", () => {});
    });

    describe("Notifications", () => {
        describe("in the main timeline", () => {
            it.skip("A new message that mentions me shows a notification", () => {});
            it.skip("Reading a notifying message reduces the notification count in the room list, space and tab", () => {});
            it.skip("Reading the last notifying message removes the notification marker from room list, space and tab", () => {});
            it.skip("Editing a message to mentions me shows a notification", () => {});
            it.skip("Reading the last notifying edited message removes the notification marker", () => {});
            it.skip("Redacting a notifying message removes the notification marker", () => {});
        });

        describe("in threads", () => {
            it.skip("A new threaded message that mentions me shows a notification", () => {});
            it.skip("Reading a notifying threaded message removes the notification count", () => {});
            it.skip("Notification count remains steady when reading threads that contain seen notifications", () => {});
            it.skip("Notification count remains steady when paging up thread view even when threads contain seen notifications", () => {});
            it.skip("Notification count remains steady when paging up thread view after mark as unread even if older threads contain notifications", () => {});
            it.skip("Redacting a notifying threaded message removes the notification marker", () => {});
        });
    });
});
