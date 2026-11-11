/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { stubClient } from "test-utils";

import { ClientApi } from "./ClientApi";
import { Room } from "./models/Room";
import { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

describe("ClientApi", () => {
    it("should return module room from getRoom()", () => {
        stubClient();
        const client = new ClientApi(new MatrixDispatcher());
        const moduleRoom = client.getRoom("!foo:matrix.org");
        expect(moduleRoom).toBeInstanceOf(Room);
        expect(moduleRoom?.id).toStrictEqual("!foo:matrix.org");
    });

    it("should return the homeserver URL from getHomeserverUrl()", () => {
        const cli = stubClient();
        vi.mocked(cli.getHomeserverUrl).mockReturnValue("https://matrix-client.example.org");
        const client = new ClientApi(new MatrixDispatcher());
        expect(client.getHomeserverUrl()).toStrictEqual("https://matrix-client.example.org");
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
