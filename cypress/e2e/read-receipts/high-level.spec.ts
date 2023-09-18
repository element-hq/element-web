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

    before(() => {
        // Note: unusually for the Cypress tests in this repo, we share a single
        // Synapse between all the tests in this file.
        //
        // Stopping and starting Synapse costs about 0.25 seconds per test, so
        // for most suites this is worth the cost for the extra assurance that
        // each test is independent.
        //
        // Because there are so many tests in this file, and because sharing a
        // Synapse should have no effect (because we create new rooms and users
        // for each test), we share it here, saving ~30 seconds per run at time
        // of writing.

        cy.startHomeserver("default").then((data) => {
            homeserver = data;
        });
    });

    beforeEach(() => {
        // Create 2 rooms: Alpha & Beta. We join the bot to both of them
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

    after(() => {
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

    function backToThreadsList() {
        cy.log("Back to threads list");
        cy.get(".mx_RightPanel").findByTitle("Threads").click();
    }

    /**
     * Find and display a message.
     *
     * @param room the name of the room to look inside
     * @param message the content of the message to fine
     * @param includeThreads look for messages inside threads, not just the main timeline
     */
    function jumpTo(room: string, message: string, includeThreads = false) {
        cy.log("Jump to message", room, message, includeThreads);
        cy.getClient().then((cli) => {
            findRoomByName(room).then(async ({ roomId }) => {
                const roomObject = cli.getRoom(roomId);
                const foundMessage = await getMessage(roomObject, message, includeThreads);
                cy.visit(`/#/room/${roomId}/${foundMessage.getId()}`);
            });
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
                    "m.relates_to": {
                        rel_type: "m.replace",
                        event_id: ev.getId(),
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
     * Generate MessageContentSpecs to send multiple threaded responses into a room.
     *
     * @param rootMessage - the body of the thread root message to send a response to
     * @param newMessages - the contents of the messages
     */
    function manyThreadedOff(rootMessage: string, newMessages: Array<string>): Array<MessageContentSpec> {
        return newMessages.map((body) => threadedOff(rootMessage, body));
    }

    /**
     * Generate strings with the supplied prefix, suffixed with numbers.
     *
     * @param prefix the prefix of each string
     * @param howMany the number of strings to generate
     */
    function many(prefix: string, howMany: number): Array<string> {
        return Array.from(Array(howMany).keys()).map((i) => prefix + i.toFixed());
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
     * Assert that this room remains read, when it was previously read.
     * (In practice, this just waits a short while to allow any unread marker to
     * appear, and then asserts that the room is read.)
     */
    function assertStillRead(room: string) {
        cy.wait(200);
        assertRead(room);
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

    /**
     * Assert a given room is marked as unread, and the number of unread
     * messages is less than the supplied count.
     *
     * @param room - the name of the room to check
     * @param lessThan - the number of unread messages that is too many
     */
    function assertUnreadLessThan(room: string, lessThan: number) {
        cy.log("Assert room some unread", room);
        return getRoomListTile(room).within(() => {
            cy.get(".mx_NotificationBadge_count").should(($count) =>
                expect(parseInt($count.get(0).textContent, 10)).to.be.lessThan(lessThan),
            );
        });
    }

    function openThreadList() {
        cy.log("Open threads list");
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
                // Given I am in a different room
                goTo(room1);
                assertRead(room2);

                // When I receive some messages
                receiveMessages(room2, ["Msg1"]);

                // Then the room is marked as unread
                assertUnread(room2, 1);
            });
            it("Reading latest message makes the room read", () => {
                // Given I have some unread messages
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I read the main timeline
                goTo(room2);

                // Then the room becomes read
                assertRead(room2);
            });
            // XXX: fails (sometimes!) because the unread count stays high
            it.skip("Reading an older message leaves the room unread", () => {
                // Given there are lots of messages in a room
                goTo(room1);
                receiveMessages(room2, many("Msg", 30));
                assertUnread(room2, 30);

                // When I jump to one of the older messages
                jumpTo(room2, "Msg1");

                // Then the room is still unread, but some messages were read
                assertUnreadLessThan(room2, 30);
            });
            it("Marking a room as read makes it read", () => {
                // Given I have some unread messages
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I mark the room as read
                markAsRead(room2);

                // Then it is read
                assertRead(room2);
            });
            it("Receiving a new message after marking as read makes it unread", () => {
                // Given I have marked my messages as read
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);
                assertRead(room2);

                // When I receive a new message
                receiveMessages(room2, ["Msg2"]);

                // Then the room is unread
                assertUnread(room2, 1);
            });
            it("A room with a new message is still unread after restart", () => {
                // Given I have an unread message
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I restart
                saveAndReload();

                // Then I still have an unread message
                assertUnread(room2, 1);
            });
            it("A room where all messages are read is still read after restart", () => {
                // Given I have read all messages
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                goTo(room2);
                assertRead(room2);

                // When I restart
                saveAndReload();

                // Then all messages are still read
                assertRead(room2);
            });
            it("A room that was marked as read is still read after restart", () => {
                // Given I have marked all messages as read
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);
                assertRead(room2);

                // When I restart
                saveAndReload();

                // Then all messages are still read
                assertRead(room2);
            });
            // XXX: fails because the room remains unread even though I sent a message
            it.skip("Me sending a message from a different client marks room as read", () => {
                // Given I have unread messages
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I send a new message from a different client
                sendMessages(room2, ["Msg2"]);

                // Then this room is marked as read
                assertRead(room2);
            });
        });

        describe("in threads", () => {
            it("Receiving a message makes a room unread", () => {
                // Given a message arrived and is read
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When I receive a threaded message
                receiveMessages(room2, [threadedOff("Msg1", "Resp1")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            it("Reading the last threaded message makes the room read", () => {
                // Given a thread exists and is not read
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                goTo(room2);

                // When I read it
                openThread("Msg1");

                // The room becomes read
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
            it("Reading an older thread message leaves the thread unread", () => {
                // Given there are many messages in a thread
                goTo(room1);
                receiveMessages(room2, ["ThreadRoot", ...manyThreadedOff("ThreadRoot", many("InThread", 20))]);
                assertUnread(room2, 21);

                // When I read an older message in the thread
                jumpTo(room2, "InThread1", true);
                assertUnreadLessThan(room2, 21);
                // TODO: for some reason, we can't find the first message
                // "InThread0", so I am using the second here. Also, they appear
                // out of order, with "InThread2" before "InThread1". Might be a
                // clue to the sporadic reports we have had of messages going
                // missing in threads?

                // Then the thread is still marked as unread
                backToThreadsList();
                assertUnreadThread("ThreadRoot");
            });
            it("Reading only one thread's message does not make the room read", () => {
                // Given two threads are unread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), "Msg2", threadedOff("Msg2", "Resp2")]);
                assertUnread(room2, 4);
                goTo(room2);
                assertUnread(room2, 2);

                // When I only read one of them
                openThread("Msg1");

                // The room is still unread
                assertUnread(room2, 1);
            });
            it("Reading only one thread's message makes that thread read but not others", () => {
                // Given I have unread threads
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2", threadedOff("Msg1", "Resp1"), threadedOff("Msg2", "Resp2")]);
                assertUnread(room2, 4); // (Sanity)
                goTo(room2);
                assertUnread(room2, 2);
                assertUnreadThread("Msg1");
                assertUnreadThread("Msg2");

                // When I read one of them
                openThread("Msg1");

                // Then that one is read, but the other is not
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
                // Given I have an unread thread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                // When I mark the room as read
                markAsRead(room2);

                // Then the room is read
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
                // Given I have read all the threads
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)
                goTo(room2);
                assertUnread(room2, 2);
                openThread("Msg1");
                assertRead(room2);

                // When I restart
                saveAndReload();

                // Then the room is still read
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
            // XXX: fails because we jump to the wrong place in the timeline
            it.skip("Reading a thread root within the thread view marks it as read in the main timeline", () => {
                // Given lots of messages are on the main timeline, and one has a thread off it
                goTo(room1);
                receiveMessages(room2, [
                    ...many("beforeThread", 30),
                    "ThreadRoot",
                    threadedOff("ThreadRoot", "InThread"),
                    ...many("afterThread", 30),
                ]);
                assertUnread(room2, 62); // Sanity

                // When I jump to an old message and read the thread
                jumpTo(room2, "beforeThread0");
                openThread("ThreadRoot");

                // Then the thread root is marked as read in the main timeline,
                // so there are only 30 left - the ones after the thread root.
                assertUnread(room2, 30);
            });
            it("Creating a new thread based on a reply makes the room unread", () => {
                // Given a message and reply exist and are read
                goTo(room1);
                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1")]);
                goTo(room2);
                assertRead(room2);
                goTo(room1);
                assertRead(room2);

                // When I receive a thread message created on the reply
                receiveMessages(room2, [threadedOff("Reply1", "Resp1")]);

                // Then the room is unread
                assertUnread(room2, 1);
            });
            it("Reading a thread whose root is a reply makes the room read", () => {
                // Given an unread thread off a reply exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1"), threadedOff("Reply1", "Resp1")]);
                assertUnread(room2, 3);
                goTo(room2);
                assertUnread(room2, 1);
                assertUnreadThread("Reply1");

                // When I read the thread
                openThread("Reply1");

                // Then the room and thread are read
                assertRead(room2);
                assertReadThread("Reply1");
            });
        });
    });

    describe("editing messages", () => {
        describe("in the main timeline", () => {
            // TODO: this passes but we think this should fail, because we think edits should not cause unreads.
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Editing a message makes a room unread", () => {
                // Given I am not looking at the room
                goTo(room1);

                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When an edit appears in the room
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Reading an edit makes the room read", () => {
                // Given an edit is making the room unread
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
                // Given an edit is making a room unread
                goTo(room2);
                receiveMessages(room2, ["Msg1"]);
                assertRead(room2);
                goTo(room1);
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);
                assertUnread(room2, 1);

                // When I mark it as read
                markAsRead(room2);

                // Then the room becomes read
                assertRead(room2);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Editing a message after marking as read makes the room unread", () => {
                // Given the room is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);
                assertRead(room2);

                // When a message is edited
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Editing a reply after reading it makes the room unread", () => {
                // Given the room is all read
                goTo(room1);

                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1")]);
                assertUnread(room2, 2);

                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When a message is edited
                receiveMessages(room2, [editOf("Reply1", "Reply1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Editing a reply after marking as read makes the room unread", () => {
                // Given a reply is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1")]);
                assertUnread(room2, 2);
                markAsRead(room2);
                assertRead(room2);

                // When the reply is edited
                receiveMessages(room2, [editOf("Reply1", "Reply1 Edit1")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("A room with an edit is still unread after restart", () => {
                // Given a message is marked as read
                goTo(room2);
                receiveMessages(room2, ["Msg1"]);
                assertRead(room2);
                goTo(room1);

                // When an edit appears in the room
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);

                // And remains so after a reload
                saveAndReload();
                assertUnread(room2, 1);
            });
            it("An edited message becomes read if it happens while I am looking", () => {
                // Given a message is marked as read
                goTo(room2);
                receiveMessages(room2, ["Msg1"]);
                assertRead(room2);

                // When I see an edit appear in the room I am looking at
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes read
                assertRead(room2);
            });
            it("A room where all edits are read is still read after restart", () => {
                // Given an edit made the room unread
                goTo(room2);
                receiveMessages(room2, ["Msg1"]);
                assertRead(room2);
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
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("An edit of a threaded message makes the room unread", () => {
                // Given we have read the thread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                backToThreadsList();
                goTo(room1);

                // When a message inside it is edited
                receiveMessages(room2, [editOf("Resp1", "Edit1")]);

                // Then the room and thread are unread
                assertUnread(room2, 1);
                goTo(room2);
                assertUnreadThread("Msg1");
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Reading an edit of a threaded message makes the room read", () => {
                // Given an edited thread message is making the room unread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                backToThreadsList();
                goTo(room1);
                receiveMessages(room2, [editOf("Resp1", "Edit1")]);
                assertUnread(room2, 1);

                // When I read it
                goTo(room2);
                openThread("Msg1");

                // Then the room and thread are read
                assertRead(room2);
                assertReadThread("Msg1");
            });
            // XXX: fails because the room is still "bold" even though the notification counts all disappear
            it.skip("Marking a room as read after an edit in a thread makes it read", () => {
                // Given an edit in a thread is making the room unread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), editOf("Resp1", "Edit1")]);
                assertUnread(room2, 3); // TODO: the edit counts as a message!

                // When I mark the room as read
                markAsRead(room2);

                // Then it is read
                assertRead(room2);
            });
            // XXX: fails because the unread dot remains after marking as read
            it.skip("Editing a thread message after marking as read makes the room unread", () => {
                // Given a room is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                markAsRead(room2);
                assertRead(room2);

                // When a message is edited
                receiveMessages(room2, [editOf("Resp1", "Edit1")]);

                // Then the room becomes unread
                assertUnread(room2, 1); // TODO: should this edit make us unread?
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("A room with an edited threaded message is still unread after restart", () => {
                // Given an edit in a thread is making a room unread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                markAsRead(room2);
                receiveMessages(room2, [editOf("Resp1", "Edit1")]);
                assertUnread(room2, 1);

                // When I restart
                saveAndReload();

                // Then is it still unread
                assertUnread(room2, 1);
            });
            it("A room where all threaded edits are read is still read after restart", () => {
                goTo(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), editOf("Resp1", "Edit1")]);
                assertUnread(room2, 2);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1); // Make sure we are looking at room1 after reload
                assertRead(room2);

                saveAndReload();
                assertRead(room2);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("A room where all threaded edits are marked as read is still read after restart", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), editOf("Resp1", "Edit1")]);
                assertUnread(room2, 3);
                markAsRead(room2);
                assertRead(room2);

                // When I restart
                saveAndReload();

                // It is still read
                assertRead(room2);
            });
        });

        describe("thread roots", () => {
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("An edit of a thread root makes the room unread", () => {
                // Given I have read a thread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                backToThreadsList();
                assertRead(room2);
                goTo(room1);

                // When the thread root is edited
                receiveMessages(room2, [editOf("Msg1", "Edit1")]);

                // Then the room is unread
                assertUnread(room2, 1);

                // But the thread is read
                goTo(room2);
                assertRead(room2);
                assertReadThread("Edit1");
            });
            it("Reading an edit of a thread root makes the room read", () => {
                // Given a fully-read thread exists
                goTo(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                openThread("Msg1");
                assertRead(room2);
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
            // XXX: fails because it shows a dot instead of unread count
            it.skip("Editing a thread root after reading makes the room unread", () => {
                // Given a fully-read thread exists
                goTo(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);

                // When the thread root is edited
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because the room has an unread dot after I marked it as read
            it.skip("Marking a room as read after an edit of a thread root makes it read", () => {
                // Given a fully-read thread exists
                goTo(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);
                assertRead(room2);

                // When the thread root is edited
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // And I mark the room as read
                markAsRead(room2);

                // Then the room becomes read and stays read
                assertRead(room2);
                goTo(room1);
                assertRead(room2);
            });
            // XXX: fails because the room has an unread dot after I marked it as read
            it.skip("Editing a thread root that is a reply after marking as read makes the room unread but not the thread", () => {
                // Given a thread based on a reply exists and is read because it is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg", replyTo("Msg", "Reply"), threadedOff("Reply", "InThread")]);
                assertUnread(room2, 3);
                markAsRead(room2);
                assertRead(room2);

                // When I edit the thread root
                receiveMessages(room1, [editOf("Reply", "Edited Reply")]);

                // Then the room is unread
                assertUnread(room2, 1);
                goTo(room2);

                // But the thread is still read (because the root is not part of the thread)
                assertReadThread("EditedReply");
            });
            // XXX: fails because the room has an unread dot after I marked it as read
            it.skip("Marking a room as read after an edit of a thread root that is a reply makes it read", () => {
                // Given a thread based on a reply exists and the reply has been edited
                goTo(room1);
                receiveMessages(room2, ["Msg", replyTo("Msg", "Reply"), threadedOff("Reply", "InThread")]);
                receiveMessages(room2, [editOf("Reply", "Edited Reply")]);
                assertUnread(room2, 3);

                // When I mark the room as read
                markAsRead(room2);

                // Then the room and thread are read
                assertRead(room2);
                goTo(room2);
                assertReadThread("Edited Reply");
            });
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
                // Given a read thread root exists
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);

                // When someone reacts to it
                goTo(room1);
                receiveMessages(room2, [reactionTo("Msg1", "🪿")]);
                cy.wait(200);

                // Then the room is still read
                assertRead(room2);
            });
            it("Reading a reaction to a thread root leaves the room read", () => {
                // Given a read thread root exists
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);

                // And the reaction to it does not make us unread
                goTo(room1);
                receiveMessages(room2, [reactionTo("Msg1", "🪿")]);
                assertRead(room2);

                // When we read the reaction and go away again
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);
                cy.wait(200);

                // Then the room is still read
                assertRead(room2);
            });
            // XXX: fails because the room is still "bold" even though the notification counts all disappear
            it.skip("Reacting to a thread root after marking as read makes the room unread but not the thread", () => {
                // Given a thread root exists
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);

                // And we have marked the room as read
                markAsRead(room2);
                assertRead(room2);

                // When someone reacts to it
                receiveMessages(room2, [reactionTo("Msg1", "🪿")]);
                cy.wait(200);

                // Then the room is still read
                assertRead(room2);
            });
        });
    });

    describe("redactions", () => {
        describe("in the main timeline", () => {
            it("Redacting the message pointed to by my receipt leaves the room read", () => {
                // Given I have read the messages in a room
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When the latest message is redacted
                receiveMessages(room2, [redactionOf("Msg2")]);

                // Then the room remains read
                assertStillRead(room2);
            });

            it("Reading an unread room after a redaction of the latest message makes it read", () => {
                // Given an unread room
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                // And the latest message has been redacted
                receiveMessages(room2, [redactionOf("Msg2")]);

                // When I read the room
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // Then it becomes read
                assertStillRead(room2);
            });
            it("Reading an unread room after a redaction of an older message makes it read", () => {
                // Given an unread room with an earlier redaction
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg1")]);

                // When I read the room
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // Then it becomes read
                assertStillRead(room2);
            });
            it("Marking an unread room as read after a redaction makes it read", () => {
                // Given an unread room where latest message is redacted
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);

                // When I mark it as read
                markAsRead(room2);

                // Then it becomes read
                assertRead(room2);
            });
            it("Sending and redacting a message after marking the room as read makes it read", () => {
                // Given a room that is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                markAsRead(room2);
                assertRead(room2);

                // When a message is sent and then redacted
                receiveMessages(room2, ["Msg3"]);
                assertUnread(room2, 1);
                receiveMessages(room2, [redactionOf("Msg3")]);

                // Then the room is read
                assertRead(room2);
            });
            it("Redacting a message after marking the room as read leaves it read", () => {
                // Given a room that is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2", "Msg3"]);
                assertUnread(room2, 3);
                markAsRead(room2);
                assertRead(room2);

                // When we redact some messages
                receiveMessages(room2, [redactionOf("Msg3")]);
                receiveMessages(room2, [redactionOf("Msg1")]);

                // Then it is still read
                assertStillRead(room2);
            });
            it("Redacting one of the unread messages reduces the unread count", () => {
                // Given an unread room
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2", "Msg3"]);
                assertUnread(room2, 3);

                // When I redact a non-latest message
                receiveMessages(room2, [redactionOf("Msg2")]);

                // Then the unread count goes down
                assertUnread(room2, 2);

                // And when I redact the latest message
                receiveMessages(room2, [redactionOf("Msg3")]);

                // Then the unread count goes down again
                assertUnread(room2, 1);
            });
            it("Redacting one of the unread messages reduces the unread count after restart", () => {
                // Given unread count was reduced by redacting messages
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2", "Msg3"]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg3")]);
                assertUnread(room2, 1);

                // When I restart
                saveAndReload();

                // Then the unread count is still reduced
                assertUnread(room2, 1);
            });
            it("Redacting all unread messages makes the room read", () => {
                // Given an unread room
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                // When I redact all the unread messages
                receiveMessages(room2, [redactionOf("Msg2")]);
                receiveMessages(room2, [redactionOf("Msg1")]);

                // Then the room is back to being read
                assertRead(room2);
            });
            it("Redacting all unread messages makes the room read after restart", () => {
                // Given all unread messages were redacted
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg2")]);
                receiveMessages(room2, [redactionOf("Msg1")]);
                assertRead(room2);

                // When I restart
                saveAndReload();

                // Then the room is still read
                assertRead(room2);
            });
            // TODO: Doesn't work because the test setup can't (yet) find the ID of a redacted message
            it.skip("Reacting to a redacted message leaves the room read", () => {
                // Given a redacted message exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);

                // And the room is read
                goTo(room2);
                assertRead(room2);
                cy.wait(200);
                goTo(room1);

                // When I react to the redacted message
                // TODO: doesn't work yet because we need to be able to look up
                // the ID of Msg2 even though it has now disappeared from the
                // timeline.
                receiveMessages(room2, [reactionTo("Msg2", "🪿")]);

                // Then the room is still read
                assertStillRead(room2);
            });
            // TODO: Doesn't work because the test setup can't (yet) find the ID of a redacted message
            it.skip("Editing a redacted message leaves the room read", () => {
                // Given a redacted message exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);

                // And the room is read
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When I attempt to edit the redacted message
                // TODO: doesn't work yet because we need to be able to look up
                // the ID of Msg2 even though it has now disappeared from the
                // timeline.
                receiveMessages(room2, [editOf("Msg2", "Msg2 is BACK")]);

                // Then the room is still read
                assertStillRead(room2);
            });
            // TODO: Doesn't work because the test setup can't (yet) find the ID of a redacted message
            it.skip("A reply to a redacted message makes the room unread", () => {
                // Given a message was redacted
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);

                // And the room is read
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When I receive a reply to the redacted message
                // TODO: doesn't work yet because we need to be able to look up
                // the ID of Msg2 even though it has now disappeared from the
                // timeline.
                receiveMessages(room2, [replyTo("Msg2", "Reply to Msg2")]);

                // Then the room is unread
                assertUnread(room2, 1);
            });
            // TODO: Doesn't work because the test setup can't (yet) find the ID of a redacted message
            it.skip("Reading a reply to a redacted message marks the room as read", () => {
                // Given someone replied to a redacted message
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);
                goTo(room2);
                assertRead(room2);
                goTo(room1);
                // TODO: doesn't work yet because we need to be able to look up
                // the ID of Msg2 even though it has now disappeared from the
                // timeline.
                receiveMessages(room2, [replyTo("Msg2", "Reply to Msg2")]);
                assertUnread(room2, 1);

                // When I read the reply
                goTo(room2);
                assertRead(room2);

                // Then the room is unread
                goTo(room1);
                assertStillRead(room2);
            });
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
            assertRead(room2);

            receiveMessages(room2, [customEvent("org.custom.event", { body: "foobar" })]);
            assertRead(room2);
        });
        it("Sending an important event after unimportant ones makes the room unread", () => {
            goTo(room1);
            assertRead(room2);
            receiveMessages(room2, ["Msg1", "Msg2"]);
            assertUnread(room2, 2);

            markAsRead(room2);
            assertRead(room2);

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
