/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSHandle, type Locator, type Page } from "@playwright/test";

import type { MatrixEvent, IContent, Room } from "matrix-js-sdk/src/matrix";
import { test as base, expect } from "../../../element-web-test";
import { type Bot } from "../../../pages/bot";
import { type Client } from "../../../pages/client";
import { type ElementAppPage } from "../../../pages/ElementAppPage";
import { type Credentials } from "../../../plugins/homeserver";

type RoomRef = { name: string; roomId: string };

/**
 * Set up for a read receipt test:
 * - Create a user with the supplied name
 * - As that user, create two rooms with the supplied names
 * - Create a bot with the supplied name
 * - Invite the bot to both rooms and ensure that it has joined
 */
export const test = base.extend<{
    room1Name?: string;
    room1: { name: string; roomId: string };
    room2Name?: string;
    room2: { name: string; roomId: string };
    msg: MessageBuilder;
    util: Helpers;
}>({
    displayName: "Mae",
    botCreateOpts: { displayName: "Other User" },

    room1Name: "Room 1",
    room1: async ({ room1Name: name, app, user, bot }, use) => {
        const roomId = await app.client.createRoom({ name, invite: [bot.credentials.userId] });
        await bot.awaitRoomMembership(roomId);
        await use({ name, roomId });
    },
    room2Name: "Room 2",
    room2: async ({ room2Name: name, app, user, bot }, use) => {
        const roomId = await app.client.createRoom({ name, invite: [bot.credentials.userId] });
        await bot.awaitRoomMembership(roomId);
        await use({ name, roomId });
    },
    msg: async ({ page, app, util }, use) => {
        await use(new MessageBuilder(page, app, util));
    },
    util: async ({ room1, room2, page, app, bot }, use) => {
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
     * MessageContentSpec to send a threaded response into a room
     * @param rootMessage - the body of the thread root message to send a response to
     * @param newMessage - the message body to send into the thread response or an object with the message content
     */
    threadedOff(rootMessage: string, newMessage: string | IContent): MessageContentSpec {
        return new (class extends MessageContentSpec {
            public async getContent(room: JSHandle<Room>): Promise<Record<string, unknown>> {
                const ev = await this.messageFinder.getMessage(room, rootMessage);
                return ev.evaluate((ev, newMessage) => {
                    if (typeof newMessage === "string") {
                        return {
                            "msgtype": "m.text",
                            "body": newMessage,
                            "m.relates_to": {
                                event_id: ev.getId(),
                                is_falling_back: true,
                                rel_type: "m.thread",
                            },
                        };
                    } else {
                        return {
                            "msgtype": "m.text",
                            "m.relates_to": {
                                event_id: ev.getId(),
                                is_falling_back: true,
                                rel_type: "m.thread",
                            },
                            ...newMessage,
                        };
                    }
                }, newMessage);
            }
        })(this);
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
 * Something that we will turn into a message or event when we pass it in to
 * e.g. receiveMessages.
 */
export type Message = string | MessageContentSpec;

export class Helpers {
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
     * Click the thread with the supplied content in the thread root to open it in
     * the Threads panel.
     */
    async openThread(rootMessage: string) {
        const tile = this.page.locator(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]", { hasText: rootMessage });
        await tile.hover();
        await tile.getByRole("button", { name: "Reply in thread" }).click();
        await expect(this.page.locator(".mx_ThreadView_timelinePanelWrapper")).toBeVisible();
    }

    async findRoomById(roomId: string): Promise<JSHandle<Room | undefined>> {
        return this.app.client.evaluateHandle((cli, roomId) => {
            return cli.getRooms().find((r) => r.roomId === roomId);
        }, roomId);
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
     * Get the threads activity centre button
     * @private
     */
    private getTacButton(): Locator {
        return this.page.getByRole("navigation", { name: "Spaces" }).getByLabel("Threads");
    }

    /**
     * Return the threads activity centre panel
     */
    getTacPanel() {
        return this.page.getByRole("menu", { name: "Threads" });
    }

    /**
     * Open the Threads Activity Centre
     */
    openTac() {
        return this.getTacButton().click();
    }

    /**
     * Hover over the Threads Activity Centre button
     */
    hoverTacButton() {
        return this.getTacButton().hover();
    }

    /**
     * Click on a room in the Threads Activity Centre
     * @param name - room name
     */
    clickRoomInTac(name: string) {
        return this.getTacPanel().getByRole("menuitem", { name }).click();
    }

    /**
     * Assert that the threads activity centre button has no indicator
     */
    async assertNoTacIndicator() {
        // Assert by checking neither of the known indicators are visible first. This will wait
        // if it takes a little time to disappear, but the screenshot comparison won't.
        await expect(this.getTacButton().locator("[data-indicator='success']")).not.toBeVisible();
        await expect(this.getTacButton().locator("[data-indicator='critical']")).not.toBeVisible();
        await expect(this.getTacButton()).toMatchScreenshot("tac-no-indicator.png");
    }

    /**
     * Assert that the threads activity centre button has a notification indicator
     */
    assertNotificationTac() {
        return expect(this.getTacButton().locator("[data-indicator='success']")).toBeVisible();
    }

    /**
     * Assert that the threads activity centre button has a highlight indicator
     */
    assertHighlightIndicator() {
        return expect(this.getTacButton().locator("[data-indicator='critical']")).toBeVisible();
    }

    /**
     * Assert that the threads activity centre panel has the expected rooms
     * @param content - the expected rooms and their notification levels
     */
    async assertRoomsInTac(content: Array<{ room: string; notificationLevel: "highlight" | "notification" }>) {
        const getBadgeClass = (notificationLevel: "highlight" | "notification") =>
            notificationLevel === "highlight"
                ? "mx_NotificationBadge_level_highlight"
                : "mx_NotificationBadge_level_notification";

        // Ensure that we have the right number of rooms
        await expect(this.getTacPanel().getByRole("menuitem")).toHaveCount(content.length);

        // Ensure that each room is present in the correct order and has the correct notification level
        const roomsLocator = this.getTacPanel().getByRole("menuitem");
        for (const [index, { room, notificationLevel }] of content.entries()) {
            const roomLocator = roomsLocator.nth(index);
            // Ensure that the room name are correct
            await expect(roomLocator).toHaveText(new RegExp(room));
            // There is no accessibility marker for the StatelessNotificationBadge
            await expect(roomLocator.locator(`.${getBadgeClass(notificationLevel)}`)).toBeVisible();
        }
    }

    /**
     * Assert that the thread panel is opened
     */
    assertThreadPanelIsOpened() {
        return expect(this.page.locator(".mx_ThreadPanel")).toBeVisible();
    }

    /**
     * Populate the rooms with messages and threads
     * @param room1
     * @param room2
     * @param msg - MessageBuilder
     * @param user - the user to mention in the first message
     * @param hasMention - whether to include a mention in the first message
     */
    async populateThreads(
        room1: { name: string; roomId: string },
        room2: { name: string; roomId: string },
        msg: MessageBuilder,
        user: Credentials,
        hasMention = true,
    ) {
        if (hasMention) {
            await this.receiveMessages(room2, [
                "Msg1",
                msg.threadedOff("Msg1", {
                    "body": "User",
                    "format": "org.matrix.custom.html",
                    "formatted_body": `<a href="https://matrix.to/#/${user.userId}">User</a>`,
                    "m.mentions": {
                        user_ids: [user.userId],
                    },
                }),
            ]);
        }
        await this.receiveMessages(room2, ["Msg2", msg.threadedOff("Msg2", "Resp2")]);
        await this.receiveMessages(room1, ["Msg3", msg.threadedOff("Msg3", "Resp3")]);
    }

    /**
     * Get the space panel
     */
    getSpacePanel() {
        return this.page.getByRole("navigation", { name: "Spaces" });
    }

    /**
     * Expand the space panel
     */
    expandSpacePanel() {
        return this.page.getByRole("button", { name: "Expand" }).click();
    }

    /**
     * Clicks the button to mark all threads as read in the current room
     */
    clickMarkAllThreadsRead() {
        return this.page.locator("#thread-panel").getByRole("button", { name: "Mark all as read" }).click();
    }
}

export { expect };
