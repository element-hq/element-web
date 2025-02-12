/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { JSHandle, Page } from "@playwright/test";
import type { MatrixEvent, Room, IndexedDBStore, ReceiptType } from "matrix-js-sdk/src/matrix";
import { test as base, expect } from "../../element-web-test";
import { type Bot } from "../../pages/bot";
import { type Client } from "../../pages/client";
import { type ElementAppPage } from "../../pages/ElementAppPage";

type RoomRef = { name: string; roomId: string };

/**
 * Set up for a read receipt test:
 * - Create a user with the supplied name
 * - As that user, create two rooms with the supplied names
 * - Create a bot with the supplied name
 * - Invite the bot to both rooms and ensure that it has joined
 */
export const test = base.extend<{
    roomAlphaName?: string;
    roomAlpha: RoomRef;
    roomBetaName?: string;
    roomBeta: RoomRef;
    msg: MessageBuilder;
    util: Helpers;
}>({
    displayName: "Mae",
    botCreateOpts: { displayName: "Other User" },

    roomAlphaName: "Room Alpha",
    roomAlpha: async ({ roomAlphaName: name, app, user, bot }, use) => {
        const roomId = await app.client.createRoom({ name, invite: [bot.credentials.userId] });
        await use({ name, roomId });
    },
    roomBetaName: "Room Beta",
    roomBeta: async ({ roomBetaName: name, app, user, bot }, use) => {
        const roomId = await app.client.createRoom({ name, invite: [bot.credentials.userId] });
        await use({ name, roomId });
    },
    msg: async ({ page, app, util }, use) => {
        await use(new MessageBuilder(page, app, util));
    },
    util: async ({ roomAlpha, roomBeta, page, app, bot }, use) => {
        await use(new Helpers(page, app, bot));
    },
});

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
export class MessageBuilder {
    constructor(
        private page: Page,
        private app: ElementAppPage,
        private helpers: Helpers,
    ) {}

    /**
     * Map of message content -> event.
     */
    messages = new Map<string, Promise<JSHandle<MatrixEvent>>>();

    /**
     * Utility to find a MatrixEvent by its body content
     * @param room - the room to search for the event in
     * @param message - the body of the event to search for
     * @param includeThreads - whether to search within threads too
     */
    async getMessage(room: JSHandle<Room>, message: string, includeThreads = false): Promise<JSHandle<MatrixEvent>> {
        const cached = this.messages.get(message);
        if (cached) {
            return cached;
        }

        const promise = room.evaluateHandle(
            async (room, { message, includeThreads }) => {
                let ev = room.timeline.find((e) => e.getContent().body === message);
                if (!ev && includeThreads) {
                    for (const thread of room.getThreads()) {
                        ev = thread.timeline.find((e) => e.getContent().body === message);
                        if (ev) break;
                    }
                }

                if (ev) return ev;

                return new Promise<MatrixEvent>((resolve) => {
                    room.on("Room.timeline" as any, (ev: MatrixEvent) => {
                        if (ev.getContent().body === message) {
                            resolve(ev);
                        }
                    });
                });
            },
            { message, includeThreads },
        );

        this.messages.set(message, promise);
        return promise;
    }

    /**
     * MessageContentSpec to send an edit into a room
     * @param originalMessage - the body of the message to edit
     * @param newMessage - the message body to send in the edit
     */
    editOf(originalMessage: string, newMessage: string): MessageContentSpec {
        return new (class extends MessageContentSpec {
            public async getContent(room: JSHandle<Room>): Promise<Record<string, unknown>> {
                const ev = await this.messageFinder.getMessage(room, originalMessage, true);

                return ev.evaluate((ev, newMessage) => {
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
                }, newMessage);
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
            public async getContent(room: JSHandle<Room>): Promise<Record<string, unknown>> {
                const ev = await this.messageFinder.getMessage(room, targetMessage, true);
                return ev.evaluate((ev, newMessage) => {
                    const threadRel =
                        ev.getRelation()?.rel_type === "m.thread"
                            ? {
                                  rel_type: "m.thread",
                                  event_id: ev.getRelation().event_id,
                              }
                            : {};

                    return {
                        "msgtype": "m.text",
                        "body": newMessage,
                        "m.relates_to": {
                            ...threadRel,
                            "m.in_reply_to": {
                                event_id: ev.getId(),
                            },
                        },
                    };
                }, newMessage);
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
            public async getContent(room: JSHandle<Room>): Promise<Record<string, unknown>> {
                const ev = await this.messageFinder.getMessage(room, rootMessage);
                return ev.evaluate((ev, newMessage) => {
                    return {
                        "msgtype": "m.text",
                        "body": newMessage,
                        "m.relates_to": {
                            event_id: ev.getId(),
                            is_falling_back: true,
                            rel_type: "m.thread",
                        },
                    };
                }, newMessage);
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
            public async performAction(bot: Bot, room: JSHandle<Room>): Promise<void> {
                const ev = await this.messageFinder.getMessage(room, targetMessage, true);
                const { id, threadId } = await ev.evaluate((ev) => ({
                    id: ev.getId(),
                    threadId: !ev.isThreadRoot ? ev.threadRootId : undefined,
                }));
                const roomId = await room.evaluate((room) => room.roomId);
                await bot.reactToMessage(roomId, threadId, id, reaction);
            }
        })(this);
    }

    /**
     * BotActionSpec to send a redaction into a room
     * @param targetMessage - the body of the message to send a redaction to
     */
    redactionOf(targetMessage: string): BotActionSpec {
        return new (class extends BotActionSpec {
            public async performAction(bot: Bot, room: JSHandle<Room>): Promise<void> {
                const ev = await this.messageFinder.getMessage(room, targetMessage, true);
                const { id, threadId } = await ev.evaluate((ev) => ({
                    id: ev.getId(),
                    threadId: !ev.isThreadRoot ? ev.threadRootId : undefined,
                }));
                const roomId = await room.evaluate((room) => room.roomId);
                await bot.redactEvent(roomId, threadId, id);
            }
        })(this);
    }

    /**
     * Find and display a message.
     *
     * @param roomRef the ref of the room to look inside
     * @param message the content of the message to fine
     * @param includeThreads look for messages inside threads, not just the main timeline
     */
    async jumpTo(roomRef: RoomRef, message: string, includeThreads = false) {
        const room = await this.helpers.findRoomById(roomRef.roomId);
        expect(room).toBeTruthy();
        const foundMessage = await this.getMessage(room, message, includeThreads);
        const roomId = await room.evaluate((room) => room.roomId);
        const foundMessageId = await foundMessage.evaluate((ev) => ev.getId());
        await this.page.goto(`/#/room/${roomId}/${foundMessageId}`);
    }

    async sendThreadedReadReceipt(room: JSHandle<Room>, targetMessage: string) {
        const event = await this.getMessage(room, targetMessage, true);

        await this.app.client.evaluate(
            (client, { event }) => {
                return client.sendReadReceipt(event);
            },
            { event },
        );
    }

    async sendUnthreadedReadReceipt(room: JSHandle<Room>, targetMessage: string) {
        const event = await this.getMessage(room, targetMessage, true);

        await this.app.client.evaluate(
            (client, { event }) => {
                return client.sendReadReceipt(event, "m.read" as any as ReceiptType, true);
            },
            { event },
        );
    }
}

/**
 * Something that can provide the content of a message.
 *
 * For example, we return and instance of this from {@link
 * MessageBuilder.replyTo} which creates a reply based on a previous message.
 */
export abstract class MessageContentSpec {
    messageFinder: MessageBuilder | null;

    constructor(messageFinder: MessageBuilder = null) {
        this.messageFinder = messageFinder;
    }

    public abstract getContent(room: JSHandle<Room>): Promise<Record<string, unknown>>;
}

/**
 * Something that can perform an action at the time we would usually send a
 * message.
 *
 * For example, we return an instance of this from {@link
 * MessageBuilder.redactionOf} which redacts the message we are referring to.
 */
export abstract class BotActionSpec {
    messageFinder: MessageBuilder | null;

    constructor(messageFinder: MessageBuilder = null) {
        this.messageFinder = messageFinder;
    }

    public abstract performAction(client: Client, room: JSHandle<Room>): Promise<void>;
}

/**
 * Something that we will turn into a message or event when we pass it in to
 * e.g. receiveMessages.
 */
export type Message = string | MessageContentSpec | BotActionSpec;

class Helpers {
    constructor(
        private page: Page,
        private app: ElementAppPage,
        private bot: Bot,
    ) {}

    /**
     * Use the supplied client to send messages or perform actions as specified by
     * the supplied {@link Message} items.
     */
    async sendMessageAsClient(cli: Client, roomRef: RoomRef, messages: Message[]) {
        const roomId = roomRef.roomId;
        const room = await this.findRoomById(roomId);
        expect(room).toBeTruthy();

        for (const message of messages) {
            if (typeof message === "string") {
                await cli.sendMessage(roomId, { body: message, msgtype: "m.text" });
            } else if (message instanceof MessageContentSpec) {
                await cli.sendMessage(roomId, await message.getContent(room));
            } else {
                await message.performAction(cli, room);
            }
            // TODO: without this wait, some tests that send lots of messages flake
            // from time to time. I (andyb) have done some investigation, but it
            // needs more work to figure out. The messages do arrive over sync, but
            // they never appear in the timeline, and they never fire a
            // Room.timeline event. I think this only happens with events that refer
            // to other events (e.g. replies), so it might be caused by the
            // referring event arriving before the referred-to event.
            await this.page.waitForTimeout(100);
        }
    }

    /**
     * Open the room with the supplied name.
     */
    async goTo(room: RoomRef) {
        await this.app.viewRoomByName(typeof room === "string" ? room : room.name);
    }

    /**
     * Expand the message with the supplied index in the timeline.
     * @param index
     */
    async openCollapsedMessage(index: number) {
        const button = this.page.locator(".mx_GenericEventListSummary_toggle");
        await button.nth(index).click();
    }

    /**
     * Click the thread with the supplied content in the thread root to open it in
     * the Threads panel.
     */
    async openThread(rootMessage: string) {
        const tile = this.page.locator(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]", { hasText: rootMessage });
        await tile.hover();
        await tile.getByRole("button", { name: "Reply in thread" }).click();
        await expect(this.page.locator(".mx_ThreadView_timelinePanelWrapper")).toBeVisible();
    }

    /**
     * Close the threads panel.
     */
    async closeThreadsPanel() {
        await this.page.locator(".mx_RightPanel").getByTestId("base-card-close-button").click();
        await expect(this.page.locator(".mx_RightPanel")).not.toBeVisible();
    }

    /**
     * Return to the list of threads, given we are viewing a single thread.
     */
    async backToThreadsList() {
        await this.page.locator(".mx_RoomHeader").getByLabel("Threads").click();
    }

    /**
     * Assert that the message containing the supplied text is visible in the UI.
     * Note: matches part of the message content as well as the whole of it.
     */
    async assertMessageLoaded(messagePart: string) {
        await expect(this.page.locator(".mx_EventTile_body").getByText(messagePart)).toBeVisible();
    }

    /**
     * Assert that the message containing the supplied text is not visible in the UI.
     * Note: matches part of the message content as well as the whole of it.
     */
    async assertMessageNotLoaded(messagePart: string) {
        await expect(this.page.locator(".mx_EventTile_body").getByText(messagePart)).not.toBeVisible();
    }

    /**
     * Scroll the messages panel up 1000 pixels.
     */
    async pageUp() {
        await this.page.locator(".mx_RoomView_messagePanel").evaluateAll((messagePanels) => {
            messagePanels.forEach((messagePanel) => (messagePanel.scrollTop -= 1000));
        });
    }

    getRoomListTile(label: string) {
        return this.page.getByRole("treeitem", { name: new RegExp("^" + label) });
    }

    /**
     * Click the "Mark as Read" context menu item on the room with the supplied name
     * in the room list.
     */
    async markAsRead(room: RoomRef) {
        await this.getRoomListTile(room.name).click({ button: "right" });
        await this.page.getByText("Mark as read").click();
    }

    /**
     * Assert that the room with the supplied name is "read" in the room list - i.g.
     * has not dot or count of unread messages.
     */
    async assertRead(room: RoomRef) {
        const tile = this.getRoomListTile(room.name);
        await expect(tile.locator(".mx_NotificationBadge_dot")).not.toBeVisible();
        await expect(tile.locator(".mx_NotificationBadge_count")).not.toBeVisible();
    }

    /**
     * Assert that this room remains read, when it was previously read.
     * (In practice, this just waits a short while to allow any unread marker to
     * appear, and then asserts that the room is read.)
     */
    async assertStillRead(room: RoomRef) {
        await this.page.waitForTimeout(200);
        await this.assertRead(room);
    }

    /**
     * Assert a given room is marked as unread (via the room list tile)
     * @param room - the name of the room to check
     * @param count - the numeric count to assert, or if "." specified then a bold/dot (no count) state is asserted
     */
    async assertUnread(room: RoomRef, count: number | ".") {
        const tile = this.getRoomListTile(room.name);
        if (count === ".") {
            await expect(tile.locator(".mx_NotificationBadge_dot")).toBeVisible();
        } else {
            await expect(tile.locator(".mx_NotificationBadge_count")).toHaveText(count.toString());
        }
    }

    /**
     * Assert a given room is marked as unread, and the number of unread
     * messages is less than the supplied count.
     *
     * @param room - the name of the room to check
     * @param lessThan - the number of unread messages that is too many
     */
    async assertUnreadLessThan(room: RoomRef, lessThan: number) {
        const tile = this.getRoomListTile(room.name);
        // https://playwright.dev/docs/test-assertions#expectpoll
        // .toBeLessThan doesn't have a retry mechanism, so we use .poll
        await expect
            .poll(async () => {
                return parseInt(await tile.locator(".mx_NotificationBadge_count").textContent(), 10);
            })
            .toBeLessThan(lessThan);
    }

    /**
     * Assert a given room is marked as unread, and the number of unread
     * messages is greater than the supplied count.
     *
     * @param room - the name of the room to check
     * @param greaterThan - the number of unread messages that is too few
     */
    async assertUnreadGreaterThan(room: RoomRef, greaterThan: number) {
        const tile = this.getRoomListTile(room.name);
        // https://playwright.dev/docs/test-assertions#expectpoll
        // .toBeGreaterThan doesn't have a retry mechanism, so we use .poll
        await expect
            .poll(async () => {
                return parseInt(await tile.locator(".mx_NotificationBadge_count").textContent(), 10);
            })
            .toBeGreaterThan(greaterThan);
    }

    /**
     * Click the "Threads" or "Back" button if needed to get to the threads list.
     */
    async openThreadList() {
        // If we've just entered the room, the threads panel takes a while to decide
        // whether it's open or not - wait here to give it a chance to settle.
        await this.page.waitForTimeout(200);

        const threadPanel = this.page.locator(".mx_ThreadPanel");
        const isThreadPanelOpen = (await threadPanel.count()) !== 0;
        if (!isThreadPanelOpen) {
            await this.page.locator(".mx_RoomHeader").getByLabel("Threads").click();
        }
        await expect(threadPanel).toBeVisible();
        await threadPanel.evaluate(($panel) => {
            const $button = $panel.querySelector<HTMLElement>('[data-testid="base-card-back-button"]');
            const title = $panel.querySelector<HTMLElement>(".mx_BaseCard_header_title")?.textContent;
            // If the Threads back button is present then click it - the
            // threads button can open either threads list or thread panel
            if ($button && title !== "Threads") {
                $button.click();
            }
        });
    }

    async findRoomById(roomId: string): Promise<JSHandle<Room>> {
        return this.app.client.evaluateHandle((cli, roomId) => {
            return cli.getRooms().find((r) => r.roomId === roomId);
        }, roomId);
    }

    private async getThreadListTile(rootMessage: string) {
        await this.openThreadList();
        return this.page.locator(".mx_ThreadPanel li", { hasText: rootMessage });
    }

    /**
     * Assert that the thread with the supplied content in its root message is shown
     * as read in the Threads list.
     */
    async assertReadThread(rootMessage: string) {
        const tile = await this.getThreadListTile(rootMessage);
        await expect(tile.locator(".mx_NotificationBadge")).not.toBeVisible();
    }

    /**
     * Assert that the thread with the supplied content in its root message is shown
     * as unread in the Threads list.
     */
    async assertUnreadThread(rootMessage: string) {
        const tile = await this.getThreadListTile(rootMessage);
        await expect(tile.locator(".mx_NotificationBadge")).toBeVisible();
    }

    /**
     * Save our indexeddb information and then refresh the page.
     */
    async saveAndReload() {
        await this.app.client.evaluate((cli) => {
            // @ts-ignore
            return (cli.store as IndexedDBStore).reallySave();
        });
        await this.page.reload();
        // Wait for the app to reload
        await expect(this.page.locator(".mx_RoomView")).toBeVisible();
    }

    /**
     * Sends messages into given room as a bot
     * @param room - the name of the room to send messages into
     * @param messages - the list of messages to send, these can be strings or implementations of MessageSpec like `editOf`
     */
    async receiveMessages(room: RoomRef, messages: Message[]) {
        await this.sendMessageAsClient(this.bot, room, messages);
    }

    /**
     * Open the room list menu
     */
    async toggleRoomListMenu() {
        const tile = this.getRoomListTile("Rooms");
        await tile.hover();
        const button = tile.getByLabel("List options");
        await button.click();
    }

    /**
     * Toggle the `Show rooms with unread messages first` option for the room list
     */
    async toggleRoomUnreadOrder() {
        await this.toggleRoomListMenu();
        await this.page.getByText("Show rooms with unread messages first").click();
        // Close contextual menu
        await this.page.locator(".mx_ContextualMenu_background").click();
    }

    /**
     * Assert that the room list is ordered as expected
     * @param rooms
     */
    async assertRoomListOrder(rooms: Array<{ name: string }>) {
        const roomList = this.page.locator(".mx_RoomTile_title");
        for (const [i, room] of rooms.entries()) {
            await expect(roomList.nth(i)).toHaveText(room.name);
        }
    }
}

/**
 * BotActionSpec to send a custom event
 * @param eventType - the type of the event to send
 * @param content - the event content to send
 */
export function customEvent(eventType: string, content: Record<string, any>): BotActionSpec {
    return new (class extends BotActionSpec {
        public async performAction(cli: Client, room: JSHandle<Room>): Promise<void> {
            const roomId = await room.evaluate((room) => room.roomId);
            await cli.sendEvent(roomId, null, eventType, content);
        }
    })();
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

export { expect };
