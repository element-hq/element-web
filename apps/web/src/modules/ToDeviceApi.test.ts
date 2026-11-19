/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { ClientEvent, type MatrixClient, type ReceivedToDeviceMessage } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { createTestClient, stubClient } from "test-utils";

import { ToDeviceApi } from "./ToDeviceApi";

const MESSAGE_TYPE = "org.example.message";
const OTHER_TYPE = "org.example.other";
const RECIPIENT_USER_ID = "@bot:example.org";

function outgoing(
    overrides: Partial<Parameters<ToDeviceApi["sendMessage"]>[0]> = {},
): Parameters<ToDeviceApi["sendMessage"]>[0] {
    return {
        recipientUserId: RECIPIENT_USER_ID,
        recipientDeviceId: "*",
        type: MESSAGE_TYPE,
        content: { action: "probe" },
        ...overrides,
    };
}

function emitMessage(client: MatrixClient, type: string, sender: string, content: unknown): void {
    client.emit(ClientEvent.ReceivedToDeviceMessage, {
        message: { type, sender, content },
        encryptionInfo: null,
    } as ReceivedToDeviceMessage);
}

describe("ToDeviceApi", () => {
    it.each(["*", "BOT_DEVICE"])(
        "sends to recipient device %s without changing the content or adding a listener",
        async (recipientDeviceId) => {
            const client = stubClient();
            const api = new ToDeviceApi(client);
            const on = vi.spyOn(client, "on");
            const content = { request_id: "module-id", requesting_device_id: "module-device" };

            await api.sendMessage(outgoing({ recipientDeviceId, content }));

            expect(client.sendToDevice).toHaveBeenCalledWith(
                MESSAGE_TYPE,
                new Map([[RECIPIENT_USER_ID, new Map([[recipientDeviceId, content]])]]),
            );
            expect(vi.mocked(client.sendToDevice).mock.calls[0]).toHaveLength(2);
            expect(content).toEqual({ request_id: "module-id", requesting_device_id: "module-device" });
            expect(client.getAccessToken).not.toHaveBeenCalled();
            expect(on).not.toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));
        },
    );

    it("resolves after the send succeeds without waiting for a response", async () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const pendingSend = Promise.withResolvers<{}>();
        vi.mocked(client.sendToDevice).mockReturnValue(pendingSend.promise);
        const settled = vi.fn();

        const send = api.sendMessage(outgoing()).then(settled);
        await Promise.resolve();
        expect(settled).not.toHaveBeenCalled();

        pendingSend.resolve({});
        await send;
        expect(settled).toHaveBeenCalledOnce();
    });

    it("rejects send failures without exposing upstream error details", async () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        vi.mocked(client.sendToDevice).mockRejectedValue(new Error("sensitive upstream details"));

        await expect(api.sendMessage(outgoing())).rejects.toThrow("Failed to send to-device message");
    });

    it("passes a recipient user ID with a server port to the SDK", async () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const recipientUserId = "@bot:example.org:8448";
        const content = { action: "probe" };

        await api.sendMessage(outgoing({ recipientUserId, content }));

        expect(client.sendToDevice).toHaveBeenCalledWith(
            MESSAGE_TYPE,
            new Map([[recipientUserId, new Map([["*", content]])]]),
        );
    });

    it("supports a receive-only subscription and passes only message data", () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const listener = vi.fn();
        const unsubscribe = api.onMessage(MESSAGE_TYPE, listener);
        const content = ["unvalidated"];

        emitMessage(client, OTHER_TYPE, RECIPIENT_USER_ID, { ignored: true });
        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, content);

        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith({
            type: MESSAGE_TYPE,
            sender: RECIPIENT_USER_ID,
            content,
        });
        expect(Object.keys(listener.mock.calls[0]![0])).toEqual(["type", "sender", "content"]);
        expect(client.sendToDevice).not.toHaveBeenCalled();
        unsubscribe();
    });

    it("allows registration without a session, then delivers on login", () => {
        const client = stubClient();
        const on = vi.spyOn(client, "on");
        const api = new ToDeviceApi(null);
        const listener = vi.fn();
        const unsubscribe = api.onMessage(MESSAGE_TYPE, listener);
        expect(on).not.toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));

        api.setClient(client);
        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, { ready: true });

        expect(listener).toHaveBeenCalledOnce();
        unsubscribe();
    });

    it("suspends delivery on logout and resumes on a replacement session", async () => {
        const oldClient = stubClient();
        const api = new ToDeviceApi(oldClient);
        const listener = vi.fn();
        const unsubscribe = api.onMessage(MESSAGE_TYPE, listener);
        const oldOff = vi.spyOn(oldClient, "off");

        api.setClient(null);
        emitMessage(oldClient, MESSAGE_TYPE, RECIPIENT_USER_ID, { stale: true });
        expect(listener).not.toHaveBeenCalled();
        expect(oldOff).toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));
        await expect(api.sendMessage(outgoing())).rejects.toThrow("No active Matrix session");

        const newClient = createTestClient();
        api.setClient(newClient);
        emitMessage(newClient, MESSAGE_TYPE, RECIPIENT_USER_ID, { current: true });
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ content: { current: true } }));
        unsubscribe();
    });

    it("keeps subscriptions independent and makes unsubscribe permanent", () => {
        const oldClient = stubClient();
        const on = vi.spyOn(oldClient, "on");
        const api = new ToDeviceApi(oldClient);
        const first = vi.fn();
        const second = vi.fn();
        const unsubscribeFirst = api.onMessage(MESSAGE_TYPE, first);
        const unsubscribeSecond = api.onMessage(MESSAGE_TYPE, second);
        expect(on).toHaveBeenCalledTimes(1);

        unsubscribeFirst();
        unsubscribeFirst();
        emitMessage(oldClient, MESSAGE_TYPE, RECIPIENT_USER_ID, {});
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledOnce();

        const newClient = createTestClient();
        const off = vi.spyOn(newClient, "off");
        api.setClient(newClient);
        emitMessage(newClient, MESSAGE_TYPE, RECIPIENT_USER_ID, {});
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(2);

        unsubscribeSecond();
        expect(off).toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));
    });

    it("isolates a throwing module listener from other subscribers", () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const logError = vi.spyOn(logger, "error").mockImplementation(() => {});
        const unsubscribeThrowing = api.onMessage(MESSAGE_TYPE, () => {
            throw new Error("module details");
        });
        const listener = vi.fn();
        const unsubscribeOther = api.onMessage(MESSAGE_TYPE, listener);

        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, {});

        expect(listener).toHaveBeenCalledOnce();
        expect(logError).toHaveBeenCalledWith("To-device module listener failed");
        unsubscribeThrowing();
        unsubscribeOther();
    });

    it("stops delivery to remaining listeners if a callback logs out", () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const second = vi.fn();
        api.onMessage(MESSAGE_TYPE, () => api.setClient(null));
        api.onMessage(MESSAGE_TYPE, second);

        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, {});

        expect(second).not.toHaveBeenCalled();
    });

    it("starts a listener added during delivery with the next message", () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const lateListener = vi.fn();
        api.onMessage(MESSAGE_TYPE, () => api.onMessage(MESSAGE_TYPE, lateListener));

        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, { first: true });
        expect(lateListener).not.toHaveBeenCalled();
        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, { second: true });
        expect(lateListener).toHaveBeenCalledOnce();
    });

    it.each(["user", "device"] as const)("stops old delivery when the session %s changes", (changedIdentity) => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const off = vi.spyOn(client, "off");
        const listener = vi.fn();
        api.onMessage(MESSAGE_TYPE, listener);

        if (changedIdentity === "user") {
            vi.mocked(client.getUserId).mockReturnValue("@other:example.org");
        } else {
            vi.mocked(client.getDeviceId).mockReturnValue("OTHER_DEVICE");
        }
        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, {});

        expect(listener).not.toHaveBeenCalled();
        expect(off).toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));
    });

    it("reattaches a subscription when the device changes on the same client", () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const listener = vi.fn();
        const unsubscribe = api.onMessage(MESSAGE_TYPE, listener);

        vi.mocked(client.getDeviceId).mockReturnValue("NEW_DEVICE");
        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, { stale: true });
        expect(listener).not.toHaveBeenCalled();

        api.setClient(client);
        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, { current: true });
        expect(listener).toHaveBeenCalledOnce();
        unsubscribe();
    });

    it("does not deliver events from a replaced client", () => {
        const oldClient = stubClient();
        const api = new ToDeviceApi(oldClient);
        const listener = vi.fn();
        const unsubscribe = api.onMessage(MESSAGE_TYPE, listener);
        const newClient = createTestClient();
        api.setClient(newClient);

        emitMessage(oldClient, MESSAGE_TYPE, RECIPIENT_USER_ID, { stale: true });
        expect(listener).not.toHaveBeenCalled();

        emitMessage(newClient, MESSAGE_TYPE, RECIPIENT_USER_ID, { current: true });
        expect(listener).toHaveBeenCalledOnce();
        unsubscribe();
    });

    it("ignores an old-client callback already queued during replacement", () => {
        const oldClient = stubClient();
        const newClient = createTestClient();
        const api = new ToDeviceApi(oldClient);
        const listener = vi.fn();
        oldClient.once(ClientEvent.ReceivedToDeviceMessage, () => {
            api.setClient(newClient);
        });
        const unsubscribe = api.onMessage(MESSAGE_TYPE, listener);

        emitMessage(oldClient, MESSAGE_TYPE, RECIPIENT_USER_ID, { stale: true });
        expect(listener).not.toHaveBeenCalled();

        emitMessage(newClient, MESSAGE_TYPE, RECIPIENT_USER_ID, { current: true });
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ content: { current: true } }));
        unsubscribe();
    });

    it("ignores a callback from an earlier attachment to the same client", () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const listener = vi.fn();
        client.once(ClientEvent.ReceivedToDeviceMessage, () => api.setClient(client));
        const unsubscribe = api.onMessage(MESSAGE_TYPE, listener);

        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, { stale: true });
        expect(listener).not.toHaveBeenCalled();

        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, { current: true });
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ content: { current: true } }));
        unsubscribe();
    });

    it("removes a subscription when attaching its client listener fails", () => {
        const client = stubClient();
        const api = new ToDeviceApi(client);
        const failedListener = vi.fn();
        const error = new Error("listener registration failed");
        const on = vi.spyOn(client, "on").mockImplementation(() => {
            throw error;
        });

        expect(() => api.onMessage(MESSAGE_TYPE, failedListener)).toThrow(error);

        on.mockRestore();
        const listener = vi.fn();
        const unsubscribe = api.onMessage(MESSAGE_TYPE, listener);
        emitMessage(client, MESSAGE_TYPE, RECIPIENT_USER_ID, {});

        expect(failedListener).not.toHaveBeenCalled();
        expect(listener).toHaveBeenCalledOnce();
        unsubscribe();
    });

    it("validates subscription inputs while allowing a missing session", async () => {
        const client = stubClient();
        const api = new ToDeviceApi(null);
        const on = vi.spyOn(client, "on");
        expect(() => api.onMessage(null as unknown as string, vi.fn())).toThrow("Invalid to-device event type");
        expect(() => api.onMessage(MESSAGE_TYPE, null as unknown as () => void)).toThrow(TypeError);
        expect(() => api.onMessage("x".repeat(256), vi.fn())).not.toThrow();
        expect(on).not.toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));
        await expect(api.sendMessage(outgoing())).rejects.toThrow("No active Matrix session");
    });
});
