/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { ClientEvent, type MatrixClient, type ReceivedToDeviceMessage } from "matrix-js-sdk/src/matrix";
import { createTestClient, stubClient } from "test-utils";

import { ClientApi } from "./ClientApi";
import { Room } from "./models/Room";
import { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

function emitMessage(client: MatrixClient): void {
    client.emit(ClientEvent.ReceivedToDeviceMessage, {
        message: { type: "org.example.message", sender: "@sender:example.org", content: {} },
        encryptionInfo: null,
    } as ReceivedToDeviceMessage);
}

describe("ClientApi", () => {
    it("does not inspect the device identity before to-device communication is used", () => {
        const getUserId = vi.fn().mockReturnValue("@alice:example.org");
        const partialClient = { getUserId } as unknown as MatrixClient;
        const dispatcher = new MatrixDispatcher();

        expect(() => {
            new ClientApi(dispatcher);
            dispatcher.dispatch({ action: Action.OnLoggedIn, client: partialClient }, true);
        }).not.toThrow();
        expect(getUserId).not.toHaveBeenCalled();
    });

    it("should return module room from getRoom()", () => {
        stubClient();
        const client = new ClientApi(new MatrixDispatcher());
        const moduleRoom = client.getRoom("!foo:matrix.org");
        expect(moduleRoom).toBeInstanceOf(Room);
        expect(moduleRoom?.id).toStrictEqual("!foo:matrix.org");
    });

    it("keeps a receive-only subscription across login and logout", () => {
        const firstClient = stubClient();
        const dispatcher = new MatrixDispatcher();
        const client = new ClientApi(dispatcher);
        const listener = vi.fn();
        const unsubscribe = client.toDevice.onMessage("org.example.message", listener);

        dispatcher.dispatch({ action: Action.OnLoggedIn, client: firstClient }, true);
        emitMessage(firstClient);
        expect(listener).toHaveBeenCalledOnce();

        dispatcher.dispatch({ action: Action.OnLoggedOut }, true);
        emitMessage(firstClient);
        expect(listener).toHaveBeenCalledOnce();

        const secondClient = createTestClient();
        dispatcher.dispatch({ action: Action.OnLoggedIn, client: secondClient }, true);
        emitMessage(secondClient);
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        emitMessage(secondClient);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    describe("waitForClientStarted", () => {
        it("should resolve once the client has started", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = new ClientApi(dispatcher);
            const onStarted = vi.fn();
            void client.waitForClientStarted().then(onStarted);

            await Promise.resolve();
            expect(onStarted).not.toHaveBeenCalled();

            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            await vi.waitFor(() => expect(onStarted).toHaveBeenCalled());
        });

        it("should resolve immediately if the client has already started", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = new ClientApi(dispatcher);
            dispatcher.dispatch({ action: Action.ClientStarted }, true);

            await expect(client.waitForClientStarted()).resolves.toBeUndefined();
        });

        it("should wait for the next start after logout", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = new ClientApi(dispatcher);
            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            dispatcher.dispatch({ action: Action.OnLoggedOut }, true);

            const onStarted = vi.fn();
            void client.waitForClientStarted().then(onStarted);
            await Promise.resolve();
            expect(onStarted).not.toHaveBeenCalled();

            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            await vi.waitFor(() => expect(onStarted).toHaveBeenCalled());
        });
    });
});
