/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from "../../element-web-test";
import type { ReceivedToDeviceMessage } from "matrix-js-sdk/src/matrix";

const MESSAGE_TYPE = "org.element.test.to_device";
type ModuleToDeviceMessage = { type: string; sender: string; content: unknown };

test.describe("to-device Module API", () => {
    test("sends and receives messages between two Matrix clients", async ({ page, bot, user }) => {
        await page.evaluate(async () => window.mxModuleApi.client.waitForClientStarted());
        await bot.prepareClient();

        const botCredentials = bot.credentials!;
        const appIdentity = await page.evaluate(() => ({
            userId: window.mxMatrixClientPeg.get().getUserId()!,
            deviceId: window.mxMatrixClientPeg.get().getDeviceId()!,
        }));
        const outgoingContent = { action: "probe", request_id: "request-1" };

        const receivedByBot = bot.evaluate(
            (client, eventType) =>
                new Promise<ReceivedToDeviceMessage["message"]>((resolve) => {
                    const listener = (payload: ReceivedToDeviceMessage): void => {
                        if (payload.message?.type !== eventType) return;
                        client.off(window.matrixcs.ClientEvent.ReceivedToDeviceMessage, listener);
                        resolve(payload.message);
                    };
                    client.on(window.matrixcs.ClientEvent.ReceivedToDeviceMessage, listener);
                }),
            MESSAGE_TYPE,
        );

        const appSubscription = await page.evaluateHandle((eventType) => {
            const target = window as Window & { __receivedToDeviceMessage?: ModuleToDeviceMessage };
            delete target.__receivedToDeviceMessage;
            return window.mxModuleApi.client.toDevice.onMessage(eventType, (message) => {
                target.__receivedToDeviceMessage = message;
            });
        }, MESSAGE_TYPE);

        try {
            await page.evaluate(
                async ({ recipientUserId, recipientDeviceId, type, content }) =>
                    window.mxModuleApi.client.toDevice.sendMessage({
                        recipientUserId,
                        recipientDeviceId,
                        type,
                        content,
                    }),
                {
                    recipientUserId: botCredentials.userId,
                    recipientDeviceId: botCredentials.deviceId,
                    type: MESSAGE_TYPE,
                    content: outgoingContent,
                },
            );

            expect(await receivedByBot).toEqual({
                type: MESSAGE_TYPE,
                sender: user.userId,
                content: outgoingContent,
            });

            const responseContent = { request_id: "request-1", result: "ready" };
            await bot.evaluate(
                async (client, { userId, deviceId, type, content }) => {
                    await client.sendToDevice(type, new Map([[userId, new Map([[deviceId, content]])]]));
                },
                {
                    userId: appIdentity.userId,
                    deviceId: appIdentity.deviceId,
                    type: MESSAGE_TYPE,
                    content: responseContent,
                },
            );

            await expect
                .poll(() =>
                    page.evaluate(
                        () => (window as Window & { __receivedToDeviceMessage?: unknown }).__receivedToDeviceMessage,
                    ),
                )
                .toEqual({
                    type: MESSAGE_TYPE,
                    sender: botCredentials.userId,
                    content: responseContent,
                });
        } finally {
            await appSubscription.evaluate((unsubscribe) => unsubscribe());
            await appSubscription.dispose();
        }
    });
});
