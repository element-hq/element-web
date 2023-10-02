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

import type { MatrixClient, MatrixEvent, Room, IndexedDBStore } from "matrix-js-sdk/src/matrix";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import Chainable = Cypress.Chainable;

/**
 * Set up for a read receipt test:
 * - Create a user with the supplied name
 * - As that user, create two rooms with the supplied names
 * - Create a bot with the supplied name
 * - Invite the bot to both rooms and ensure that it has joined
 */
export class ReadReceiptSetup {
    roomAlpha: string;
    roomBeta: string;
    alphaRoomId: string;
    betaRoomId: string;
    bot: MatrixClient;

    constructor(
        homeserver: HomeserverInstance,
        userName: string,
        botName: string,
        roomAlpha: string,
        roomBeta: string,
    ) {
        this.roomAlpha = roomAlpha;
        this.roomBeta = roomBeta;

        // Create a user
        cy.initTestUser(homeserver, userName)
            // Create 2 rooms
            .then(() => {
                cy.createRoom({ name: roomAlpha }).then((createdRoomId) => {
                    this.alphaRoomId = createdRoomId;
                });
            })
            .then(() => {
                cy.createRoom({ name: roomBeta }).then((createdRoomId) => {
                    this.betaRoomId = createdRoomId;
                });
            })
            // Create a bot
            .then(() => {
                cy.getBot(homeserver, { displayName: botName }).then((botClient) => {
                    this.bot = botClient;
                });
            })
            // Invite the bot to both rooms
            .then(() => {
                cy.inviteUser(this.alphaRoomId, this.bot.getUserId());
                cy.viewRoomById(this.alphaRoomId);
                cy.get(".mx_LegacyRoomHeader").within(() => cy.findByTitle(roomAlpha).should("exist"));
                cy.findByText(botName + " joined the room").should("exist");

                cy.inviteUser(this.betaRoomId, this.bot.getUserId());
                cy.viewRoomById(this.betaRoomId);
                cy.get(".mx_LegacyRoomHeader").within(() => cy.findByTitle(roomBeta).should("exist"));
                cy.findByText(botName + " joined the room").should("exist");
            });
    }
}

/**
 * A utility that is able to find messages based on their content, by looking
 * inside the `timeline` objects in the object model.
 *
 * Crucially, we hold on to references to events that have been edited or
 * redacted, so we can still look them up by their old content.
 *
 * Provides utilities that build on the ability to find messages, e.g. replyTo,
 * which finds a message and then constructs a reply to it.
 */
export class MessageFinder {
    /**
     * Map of message content -> event.
     */
    messages = new Map<String, MatrixEvent>();

    /**
     * Utility to find a MatrixEvent by its body content
     * @param room - the room to search for the event in
     * @param message - the body of the event to search for
     * @param includeThreads - whether to search within threads too
     */
    async getMessage(room: Room, message: string, includeThreads = false): Promise<MatrixEvent> {
        const cached = this.messages.get(message);
        if (cached) {
            return cached;
        }

        let ev = room.timeline.find((e) => e.getContent().body === message);
        if (!ev && includeThreads) {
            for (const thread of room.getThreads()) {
                ev = thread.timeline.find((e) => e.getContent().body === message);
                if (ev) break;
            }
        }

        if (ev) {
            this.messages.set(message, ev);
            return ev;
        }

        return new Promise((resolve) => {
            room.on("Room.timeline" as any, (ev: MatrixEvent) => {
                if (ev.getContent().body === message) {
                    this.messages.set(message, ev);
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
    editOf(originalMessage: string, newMessage: string): MessageContentSpec {
        return new (class extends MessageContentSpec {
            public async getContent(room: Room): Promise<Record<string, unknown>> {
                const ev = await this.messageFinder?.getMessage(room, originalMessage, true);

                // If this event has been redacted, its msgtype will be
                // undefined. In that case, we guess msgtype as m.text.
                const msgtype = ev.getContent().msgtype ?? "m.text";
                return {
                    "msgtype": msgtype,
                    "body": `* ${newMessage}`,
                    "m.new_content": {
                        msgtype: msgtype,
                        body: newMessage,
                    },
                    "m.relates_to": {
                        rel_type: "m.replace",
                        event_id: ev.getId(),
                    },
                };
            }
        })(this);
    }

    /**
     * MessageContentSpec to send a reply into a room
     * @param targetMessage - the body of the message to reply to
     * @param newMessage - the message body to send into the reply
     */
    replyTo(targetMessage: string, newMessage: string): MessageContentSpec {
        return new (class extends MessageContentSpec {
            public async getContent(room: Room): Promise<Record<string, unknown>> {
                const ev = await this.messageFinder.getMessage(room, targetMessage, true);

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
        })(this);
    }

    /**
     * MessageContentSpec to send a threaded response into a room
     * @param rootMessage - the body of the thread root message to send a response to
     * @param newMessage - the message body to send into the thread response
     */
    threadedOff(rootMessage: string, newMessage: string): MessageContentSpec {
        return new (class extends MessageContentSpec {
            public async getContent(room: Room): Promise<Record<string, unknown>> {
                const ev = await this.messageFinder.getMessage(room, rootMessage);

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
        })(this);
    }

    /**
     * Generate MessageContentSpecs to send multiple threaded responses into a room.
     *
     * @param rootMessage - the body of the thread root message to send a response to
     * @param newMessages - the contents of the messages
     */
    manyThreadedOff(rootMessage: string, newMessages: Array<string>): Array<MessageContentSpec> {
        return newMessages.map((body) => this.threadedOff(rootMessage, body));
    }

    /**
     * BotActionSpec to send a reaction to an existing event into a room
     * @param targetMessage - the body of the message to send a reaction to
     * @param reaction - the key of the reaction to send into the room
     */
    reactionTo(targetMessage: string, reaction: string): BotActionSpec {
        return new (class extends BotActionSpec {
            public async performAction(cli: MatrixClient, room: Room): Promise<void> {
                const ev = await this.messageFinder.getMessage(room, targetMessage, true);
                const threadId = !ev.isThreadRoot ? ev.threadRootId : undefined;
                await cli.sendEvent(room.roomId, threadId ?? null, "m.reaction", {
                    "m.relates_to": {
                        rel_type: "m.annotation",
                        event_id: ev.getId(),
                        key: reaction,
                    },
                });
            }
        })(this);
    }

    /**
     * BotActionSpec to send a redaction into a room
     * @param messageFinder - used to find the existing event
     * @param targetMessage - the body of the message to send a redaction to
     */
    redactionOf(targetMessage: string): BotActionSpec {
        return new (class extends BotActionSpec {
            public async performAction(cli: MatrixClient, room: Room): Promise<void> {
                const ev = await this.messageFinder.getMessage(room, targetMessage, true);
                await cli.redactEvent(room.roomId, ev.threadRootId, ev.getId());
            }
        })(this);
    }

    /**
     * Find and display a message.
     *
     * @param room the name of the room to look inside
     * @param message the content of the message to fine
     * @param includeThreads look for messages inside threads, not just the main timeline
     */
    jumpTo(room: string, message: string, includeThreads = false) {
        cy.log("Jump to message", room, message, includeThreads);
        cy.getClient().then((cli) => {
            findRoomByName(room).then(async ({ roomId }) => {
                const roomObject = cli.getRoom(roomId);
                const foundMessage = await this.getMessage(roomObject, message, includeThreads);
                cy.visit(`/#/room/${roomId}/${foundMessage.getId()}`);
            });
        });
    }
}

/**
 * Something that can provide the content of a message.
 *
 * For example, we return and instance of this from {@link
 * MessageFinder.replyTo} which creates a reply based on a previous message.
 */
export abstract class MessageContentSpec {
    messageFinder: MessageFinder | null;

    constructor(messageFinder: MessageFinder = null) {
        this.messageFinder = messageFinder;
    }

    public abstract getContent(room: Room): Promise<Record<string, unknown>>;
}

/**
 * Something that can perform an action at the time we would usually send a
 * message.
 *
 * For example, we return an instance of this from {@link
 * MessageFinder.redactionOf} which redacts the message we are referring to.
 */
export abstract class BotActionSpec {
    messageFinder: MessageFinder | null;

    constructor(messageFinder: MessageFinder = null) {
        this.messageFinder = messageFinder;
    }

    public abstract performAction(cli: MatrixClient, room: Room): Promise<void>;
}

/**
 * Something that we will turn into a message or event when we pass it in to
 * e.g. receiveMessages.
 */
export type Message = string | MessageContentSpec | BotActionSpec;

/**
 * Use the supplied client to send messages or perform actions as specified by
 * the supplied {@link Message} items.
 */
export function sendMessageAsClient(cli: MatrixClient, room: string, messages: Message[]) {
    const roomIdFinder = findRoomByName(room);
    for (const message of messages) {
        roomIdFinder.then(async (room) => {
            if (typeof message === "string") {
                await cli.sendTextMessage(room.roomId, message);
            } else if (message instanceof MessageContentSpec) {
                await cli.sendMessage(room.roomId, await message.getContent(room));
            } else {
                await message.performAction(cli, room);
            }
        });
        // TODO: without this wait, some tests that send lots of messages flake
        // from time to time. I (andyb) have done some investigation, but it
        // needs more work to figure out. The messages do arrive over sync, but
        // they never appear in the timeline, and they never fire a
        // Room.timeline event. I think this only happens with events that refer
        // to other events (e.g. replies), so it might be caused by the
        // referring event arriving before the referred-to event.
        cy.wait(200);
    }
}

/**
 * Open the room with the supplied name.
 */
export function goTo(room: string) {
    cy.viewRoomByName(room);
}

function findRoomByName(room: string): Chainable<Room> {
    return cy.getClient().then((cli) => {
        return cli.getRooms().find((r) => r.name === room);
    });
}

/**
 * Click the thread with the supplied content in the thread root to open it in
 * the Threads panel.
 */
export function openThread(rootMessage: string) {
    cy.log("Open thread", rootMessage);
    cy.get(".mx_RoomView_body", { log: false }).within(() => {
        cy.findAllByText(rootMessage)
            .filter(".mx_EventTile_body")
            .parents(".mx_EventTile[data-scroll-tokens]")
            .realHover()
            .findByRole("button", { name: "Reply in thread", log: false })
            .click();
    });
    cy.get(".mx_ThreadView_timelinePanelWrapper", { log: false }).should("have.length", 1);
}

/**
 * Close the threads panel. (Actually, close any right panel, but for these
 * tests we only open the threads panel.)
 */
export function closeThreadsPanel() {
    cy.log("Close threads panel");
    cy.get(".mx_RightPanel").findByTitle("Close").click();
    cy.get(".mx_RightPanel").should("not.exist");
}

/**
 * Return to the list of threads, given we are viewing a single thread.
 */
export function backToThreadsList() {
    cy.log("Back to threads list");
    cy.get(".mx_RightPanel").findByTitle("Threads").click();
}

/**
 * BotActionSpec to send a custom event
 * @param eventType - the type of the event to send
 * @param content - the event content to send
 */
export function customEvent(eventType: string, content: Record<string, any>): BotActionSpec {
    return new (class extends BotActionSpec {
        public async performAction(cli: MatrixClient, room: Room): Promise<void> {
            await cli.sendEvent(room.roomId, null, eventType, content);
        }
    })();
}

function getRoomListTile(room: string) {
    return cy.findByRole("treeitem", { name: new RegExp("^" + room), log: false });
}

/**
 * Assert that the message containing the supplied text is visible in the UI.
 * Note: matches part of the message content as well as the whole of it.
 */
export function assertMessageLoaded(messagePart: string) {
    cy.get(".mx_EventTile_body").contains(messagePart).should("exist");
}

/**
 * Assert that the message containing the supplied text is not visible in the UI.
 * Note: matches part of the message content as well as the whole of it.
 */
export function assertMessageNotLoaded(messagePart: string) {
    cy.get(".mx_EventTile_body").contains(messagePart).should("not.exist");
}

/**
 * Scroll the messages panel up 1000 pixels.
 */
export function pageUp() {
    cy.get(".mx_RoomView_messagePanel").then((refs) =>
        refs.each((_, messagePanel) => {
            messagePanel.scrollTop -= 1000;
        }),
    );
}

/**
 * Generate strings with the supplied prefix, suffixed with numbers.
 *
 * @param prefix the prefix of each string
 * @param howMany the number of strings to generate
 */
export function many(prefix: string, howMany: number): Array<string> {
    return Array.from(Array(howMany).keys()).map((i) => prefix + i.toString().padStart(4, "0"));
}

/**
 * Click the "Mark as Read" context menu item on the room with the supplied name
 * in the room list.
 */
export function markAsRead(room: string) {
    cy.log("Marking room as read", room);
    getRoomListTile(room).rightclick();
    cy.findByText("Mark as read").click();
}

/**
 * Assert that the room with the supplied name is "read" in the room list - i.g.
 * has not dot or count of unread messages.
 */
export function assertRead(room: string) {
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
export function assertStillRead(room: string) {
    cy.wait(200);
    assertRead(room);
}

/**
 * Assert a given room is marked as unread (via the room list tile)
 * @param room - the name of the room to check
 * @param count - the numeric count to assert, or if "." specified then a bold/dot (no count) state is asserted
 */
export function assertUnread(room: string, count: number | ".") {
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
export function assertUnreadLessThan(room: string, lessThan: number) {
    cy.log("Assert unread less than", room, lessThan);
    return getRoomListTile(room).within(() => {
        cy.get(".mx_NotificationBadge_count").should(($count) =>
            expect(parseInt($count.get(0).textContent, 10)).to.be.lessThan(lessThan),
        );
    });
}

/**
 * Assert a given room is marked as unread, and the number of unread
 * messages is greater than the supplied count.
 *
 * @param room - the name of the room to check
 * @param greaterThan - the number of unread messages that is too few
 */
export function assertUnreadGreaterThan(room: string, greaterThan: number) {
    cy.log("Assert unread greater than", room, greaterThan);
    return getRoomListTile(room).within(() => {
        cy.get(".mx_NotificationBadge_count").should(($count) =>
            expect(parseInt($count.get(0).textContent, 10)).to.be.greaterThan(greaterThan),
        );
    });
}

/**
 * Click the "Threads" or "Back" button if needed to get to the threads list.
 */
export function openThreadList() {
    cy.log("Open threads list");

    // If we've just entered the room, the threads panel takes a while to decide
    // whether it's open or not - wait here to give it a chance to settle.
    cy.wait(200);

    cy.findByTestId("threadsButton", { log: false }).then(($button) => {
        if ($button?.attr("aria-current") !== "true") {
            cy.findByTestId("threadsButton", { log: false }).click();
        }
    });

    cy.get(".mx_ThreadPanel", { log: false })
        .should("exist")
        .then(($panel) => {
            const $button = $panel.find('.mx_BaseCard_back[title="Threads"]');
            // If the Threads back button is present then click it - the
            // threads button can open either threads list or thread panel
            if ($button.length) {
                $button.trigger("click");
            }
        });
}

function getThreadListTile(rootMessage: string) {
    openThreadList();
    return cy.contains(".mx_ThreadPanel .mx_EventTile_body", rootMessage, { log: false }).closest("li");
}

/**
 * Assert that the thread with the supplied content in its root message is shown
 * as read in the Threads list.
 */
export function assertReadThread(rootMessage: string) {
    cy.log("Assert thread read", rootMessage);
    return getThreadListTile(rootMessage).within(() => {
        cy.get(".mx_NotificationBadge", { log: false }).should("not.exist");
    });
}

/**
 * Assert that the thread with the supplied content in its root message is shown
 * as unread in the Threads list.
 */
export function assertUnreadThread(rootMessage: string) {
    cy.log("Assert unread thread", rootMessage);
    return getThreadListTile(rootMessage).within(() => {
        cy.get(".mx_NotificationBadge").should("exist");
    });
}

/**
 * Save our indexeddb information and then refresh the page.
 */
export function saveAndReload() {
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
