/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { JSHandle, Locator, Page } from "@playwright/test";

import type { MatrixEvent, IContent, Room } from "matrix-js-sdk/src/matrix";
import { test as base, expect } from "../../../element-web-test";
import { Bot } from "../../../pages/bot";
import { Client } from "../../../pages/client";
import { ElementAppPage } from "../../../pages/ElementAppPage";

/**
 * Set up for a read receipt test:
 * - Create a user with the supplied name
 * - As that user, create two rooms with the supplied names
 * - Create a bot with the supplied name
 * - Invite the bot to both rooms and ensure that it has joined
 */
export const test = base.extend<{
    roomAlphaName?: string;
    roomAlpha: { name: string; roomId: string };
    roomBetaName?: string;
    roomBeta: { name: string; roomId: string };
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
    messages = new Map<String, Promise<JSHandle<MatrixEvent>>>();

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
    async sendMessageAsClient(cli: Client, roomName: string | { name: string }, messages: Message[]) {
        const room = await this.findRoomByName(typeof roomName === "string" ? roomName : roomName.name);
        const roomId = await room.evaluate((room) => room.roomId);

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
    async goTo(room: string | { name: string }) {
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

    async findRoomByName(roomName: string): Promise<JSHandle<Room>> {
        return this.app.client.evaluateHandle((cli, roomName) => {
            return cli.getRooms().find((r) => r.name === roomName);
        }, roomName);
    }

    /**
     * Sends messages into given room as a bot
     * @param room - the name of the room to send messages into
     * @param messages - the list of messages to send, these can be strings or implementations of MessageSpec like `editOf`
     */
    async receiveMessages(room: string | { name: string }, messages: Message[]) {
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
    assertNoTacIndicator() {
        return expect(this.getTacButton()).toMatchScreenshot("tac-no-indicator.png");
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
     */
    async populateThreads(
        room1: { name: string; roomId: string },
        room2: { name: string; roomId: string },
        msg: MessageBuilder,
    ) {
        await this.receiveMessages(room2, [
            "Msg1",
            msg.threadedOff("Msg1", {
                "body": "User",
                "format": "org.matrix.custom.html",
                "formatted_body": "<a href='https://matrix.to/#/@user:localhost'>User</a>",
                "m.mentions": {
                    user_ids: ["@user:localhost"],
                },
            }),
        ]);
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
}

export { expect };
