/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { JSHandle } from "@playwright/test";
import type { MatrixEvent, ISendEventResponse, ReceiptType } from "matrix-js-sdk/src/matrix";
import { expect } from "../../element-web-test";
import { type ElementAppPage } from "../../pages/ElementAppPage";
import { type Bot } from "../../pages/bot";
import { test } from ".";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Read receipts", { tag: "@mergequeue" }, () => {
    test.skip(isDendrite, "due to Dendrite bug https://github.com/element-hq/dendrite/issues/2970");
    test.use({
        displayName: "Mae",
        botCreateOpts: { displayName: "Other User" },
    });

    const selectedRoomName = "Selected Room";
    const otherRoomName = "Other Room";

    let otherRoomId: string;
    let selectedRoomId: string;

    const sendMessage = async (bot: Bot, no = 1): Promise<ISendEventResponse> => {
        return bot.sendMessage(otherRoomId, { body: `Message ${no}`, msgtype: "m.text" });
    };

    const botSendThreadMessage = (bot: Bot, threadId: string): Promise<ISendEventResponse> => {
        return bot.sendEvent(otherRoomId, threadId, "m.room.message", { body: "Message", msgtype: "m.text" });
    };

    const fakeEventFromSent = (
        app: ElementAppPage,
        eventResponse: ISendEventResponse,
        threadRootId: string | undefined,
    ): Promise<JSHandle<MatrixEvent>> => {
        return app.client.evaluateHandle(
            (client, { otherRoomId, eventResponse, threadRootId }) => {
                return {
                    getRoomId: () => otherRoomId,
                    getId: () => eventResponse.event_id,
                    threadRootId,
                    getTs: () => 1,
                    isRelation: (relType) => {
                        return !relType || relType === "m.thread";
                    },
                } as any as MatrixEvent;
            },
            { otherRoomId, eventResponse, threadRootId },
        );
    };

    /**
     * Send a threaded receipt marking the message referred to in
     * eventResponse as read. If threadRootEventResponse is supplied, the
     * receipt will have its event_id as the thread root ID for the receipt.
     */
    const sendThreadedReadReceipt = async (
        app: ElementAppPage,
        eventResponse: ISendEventResponse,
        threadRootEventResponse: ISendEventResponse = undefined,
    ) => {
        await app.client.sendReadReceipt(
            await fakeEventFromSent(app, eventResponse, threadRootEventResponse?.event_id),
        );
    };

    /**
     * Send an unthreaded receipt marking the message referred to in
     * eventResponse as read.
     */
    const sendUnthreadedReadReceipt = async (app: ElementAppPage, eventResponse: ISendEventResponse) => {
        await app.client.sendReadReceipt(
            await fakeEventFromSent(app, eventResponse, undefined),
            "m.read" as any as ReceiptType,
            true,
        );
    };

    test.beforeEach(async ({ page, app, user, bot }) => {
        /*
         * Create 2 rooms:
         *
         * - Selected room - this one is clicked in the UI
         * - Other room - this one contains the bot, which will send events so
         *                we can check its unread state.
         */
        selectedRoomId = await app.client.createRoom({ name: selectedRoomName });
        // Invite the bot to Other room
        otherRoomId = await app.client.createRoom({ name: otherRoomName, invite: [bot.credentials.userId] });

        await page.goto(`/#/room/${otherRoomId}`);
        await expect(page.getByText(`${bot.credentials.displayName} joined the room`)).toBeVisible();

        // Then go into Selected room
        await page.goto(`/#/room/${selectedRoomId}`);
    });

    test("With sync accumulator, considers main thread and unthreaded receipts #24629", async ({ page, app, bot }) => {
        // Details are in https://github.com/vector-im/element-web/issues/24629
        // This proves we've fixed one of the "stuck unreads" issues.

        // Given we sent 3 events on the main thread
        await sendMessage(bot);
        const main2 = await sendMessage(bot);
        const main3 = await sendMessage(bot);

        // (So the room starts off unread)
        await expect(page.getByLabel(`${otherRoomName} 3 unread messages.`)).toBeVisible();

        // When we send a threaded receipt for the last event in main
        // And an unthreaded receipt for an earlier event
        await sendThreadedReadReceipt(app, main3);
        await sendUnthreadedReadReceipt(app, main2);

        // (So the room has no unreads)
        await expect(page.getByLabel(`${otherRoomName}`)).toBeVisible();

        // And we persuade the app to persist its state to indexeddb by reloading and waiting
        await page.reload();
        await expect(page.getByLabel(`${selectedRoomName}`)).toBeVisible();

        // And we reload again, fetching the persisted state FROM indexeddb
        await page.reload();

        // Then the room is read, because the persisted state correctly remembers both
        // receipts. (In #24629, the unthreaded receipt overwrote the main thread one,
        // meaning that the room still said it had unread messages.)
        await expect(page.getByLabel(`${otherRoomName}`)).toBeVisible();
        await expect(page.getByLabel(`${otherRoomName} Unread messages.`)).not.toBeVisible();
    });

    test("Recognises unread messages on main thread after receiving a receipt for earlier ones", async ({
        page,
        app,
        bot,
    }) => {
        // Given we sent 3 events on the main thread
        await sendMessage(bot);
        const main2 = await sendMessage(bot);
        await sendMessage(bot);

        // (The room starts off unread)
        await expect(page.getByLabel(`${otherRoomName} 3 unread messages.`)).toBeVisible();

        // When we send a threaded receipt for the second-last event in main
        await sendThreadedReadReceipt(app, main2);

        // Then the room has only one unread
        await expect(page.getByLabel(`${otherRoomName} 1 unread message.`)).toBeVisible();
    });

    test("Considers room read if there is only a main thread and we have a main receipt", async ({
        page,
        app,
        bot,
    }) => {
        // Given we sent 3 events on the main thread
        await sendMessage(bot);
        await sendMessage(bot);
        const main3 = await sendMessage(bot);
        // (The room starts off unread)
        await expect(page.getByLabel(`${otherRoomName} 3 unread messages.`)).toBeVisible();

        // When we send a threaded receipt for the last event in main
        await sendThreadedReadReceipt(app, main3);

        // Then the room has no unreads
        await expect(page.getByLabel(`${otherRoomName}`)).toBeVisible();
    });

    test("Recognises unread messages on other thread after receiving a receipt for earlier ones", async ({
        page,
        app,
        bot,
        util,
    }) => {
        // Given we sent 3 events on the main thread
        const main1 = await sendMessage(bot);
        const thread1a = await botSendThreadMessage(bot, main1.event_id);
        await botSendThreadMessage(bot, main1.event_id);
        // 1 unread on the main thread, 2 in the new thread that aren't shown
        await expect(page.getByLabel(`${otherRoomName} 1 unread message.`)).toBeVisible();

        // When we send receipts for main, and the second-last in the thread
        await sendThreadedReadReceipt(app, main1);
        await sendThreadedReadReceipt(app, thread1a, main1);

        // Then the room has only one unread - the one in the thread
        await util.goTo({ name: otherRoomName, roomId: otherRoomId });
        await util.assertUnreadThread("Message 1");
    });

    test("Considers room read if there are receipts for main and other thread", async ({ page, app, bot, util }) => {
        // Given we sent 3 events on the main thread
        const main1 = await sendMessage(bot);
        await botSendThreadMessage(bot, main1.event_id);
        const thread1b = await botSendThreadMessage(bot, main1.event_id);
        // 1 unread on the main thread, 2 in the new thread which don't show
        await expect(page.getByLabel(`${otherRoomName} 1 unread message.`)).toBeVisible();

        // When we send receipts for main, and the last in the thread
        await sendThreadedReadReceipt(app, main1);
        await sendThreadedReadReceipt(app, thread1b, main1);

        // Then the room has no unreads
        await expect(page.getByLabel(`${otherRoomName}`)).toBeVisible();
        await util.goTo({ name: otherRoomName, roomId: otherRoomId });
        await util.assertReadThread("Message 1");
    });

    test("Recognises unread messages on a thread after receiving a unthreaded receipt for earlier ones", async ({
        page,
        app,
        bot,
        util,
    }) => {
        // Given we sent 3 events on the main thread
        const main1 = await sendMessage(bot);
        const thread1a = await botSendThreadMessage(bot, main1.event_id);
        await botSendThreadMessage(bot, main1.event_id);
        // 1 unread on the main thread, 2 in the new thread which don't count
        await expect(page.getByLabel(`${otherRoomName} 1 unread message.`)).toBeVisible();

        // When we send an unthreaded receipt for the second-last in the thread
        await sendUnthreadedReadReceipt(app, thread1a);

        // Then the room has only one unread - the one in the
        // thread. The one in main is read because the unthreaded
        // receipt is for a later event. The room should therefore be
        // read, and the thread unread.
        await expect(page.getByLabel(`${otherRoomName}`)).toBeVisible();
        await util.goTo({ name: otherRoomName, roomId: otherRoomId });
        await util.assertUnreadThread("Message 1");
    });

    test("Recognises unread messages on main after receiving a unthreaded receipt for a thread message", async ({
        page,
        app,
        bot,
    }) => {
        // Given we sent 3 events on the main thread
        const main1 = await sendMessage(bot);
        await botSendThreadMessage(bot, main1.event_id);
        const thread1b = await botSendThreadMessage(bot, main1.event_id);
        await sendMessage(bot);
        // 2 unreads on the main thread, 2 in the new thread which don't count
        await expect(page.getByLabel(`${otherRoomName} 2 unread messages.`)).toBeVisible();

        // When we send an unthreaded receipt for the last in the thread
        await sendUnthreadedReadReceipt(app, thread1b);

        // Then the room has only one unread - the one in the
        // main thread, because it is later than the unthreaded
        // receipt.
        await expect(page.getByLabel(`${otherRoomName} 1 unread message.`)).toBeVisible();
    });

    /**
     * The idea of this test is to intercept the receipt / read read_markers requests and
     * assert that the correct ones are sent.
     * Prose playbook:
     * - Another user sends enough messages that the timeline becomes scrollable
     * - The current user looks at the room and jumps directly to the first unread message
     * - At this point, a receipt for the last message in the room and
     *   a fully read marker for the last visible message are expected to be sent
     * - Then the user jumps to the end of the timeline
     * - A fully read marker for the last message in the room is expected to be sent
     */
    test("Should send the correct receipts", async ({ page, bot }) => {
        const uriEncodedOtherRoomId = encodeURIComponent(otherRoomId);

        const receiptRequestPromise = page.waitForRequest(
            new RegExp(`http://localhost:\\d+/_matrix/client/v3/rooms/${uriEncodedOtherRoomId}/receipt/m\\.read/.+`),
        );

        const numberOfMessages = 20;
        const sendMessageResponses: ISendEventResponse[] = [];

        for (let i = 1; i <= numberOfMessages; i++) {
            sendMessageResponses.push(await sendMessage(bot, i));
        }

        const lastMessageId = sendMessageResponses.at(-1).event_id;
        const uriEncodedLastMessageId = encodeURIComponent(lastMessageId);

        // wait until all messages have been received
        await expect(page.getByLabel(`${otherRoomName} ${sendMessageResponses.length} unread messages.`)).toBeVisible();

        // switch to the room with the messages
        await page.goto(`/#/room/${otherRoomId}`);

        const receiptRequest = await receiptRequestPromise;
        // assert the read receipt for the last message in the room
        expect(receiptRequest.url()).toContain(uriEncodedLastMessageId);
        expect(receiptRequest.postDataJSON()).toEqual({
            thread_id: "main",
        });

        // the following code tests the fully read marker somewhere in the middle of the room
        const readMarkersRequestPromise = page.waitForRequest(
            new RegExp(`http://localhost:\\d+/_matrix/client/v3/rooms/${uriEncodedOtherRoomId}/read_markers`),
        );

        await page.getByRole("button", { name: "Jump to first unread message." }).click();

        const readMarkersRequest = await readMarkersRequestPromise;
        // since this is not pixel perfect,
        // the fully read marker should be +/- 1 around the last visible message
        expect([
            sendMessageResponses[11].event_id,
            sendMessageResponses[12].event_id,
            sendMessageResponses[13].event_id,
        ]).toContain(readMarkersRequest.postDataJSON()["m.fully_read"]);

        // the following code tests the fully read marker at the bottom of the room
        const readMarkersRequestPromise2 = page.waitForRequest(
            new RegExp(`http://localhost:\\d+/_matrix/client/v3/rooms/${uriEncodedOtherRoomId}/read_markers`),
        );

        await page.getByRole("button", { name: "Scroll to most recent messages" }).click();

        const readMarkersRequest2 = await readMarkersRequestPromise2;
        expect(readMarkersRequest2.postDataJSON()).toEqual({
            ["m.fully_read"]: sendMessageResponses.at(-1).event_id,
        });
    });
});
