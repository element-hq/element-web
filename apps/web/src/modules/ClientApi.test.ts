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
import { MatrixClientPeg } from "../MatrixClientPeg";

describe("ClientApi", () => {
    it("should return module room from getRoom()", () => {
        stubClient();
        const client = new ClientApi(new MatrixDispatcher());
        const moduleRoom = client.getRoom("!foo:matrix.org");
        expect(moduleRoom).toBeInstanceOf(Room);
        expect(moduleRoom?.id).toStrictEqual("!foo:matrix.org");
    });

    describe("client details", () => {
        it("should return the user ID from getUserId()", () => {
            stubClient();
            const api = new ClientApi(new MatrixDispatcher());
            expect(api.getUserId()).toStrictEqual("@userId:matrix.org");
        });

        it("should return the device ID from getDeviceId()", () => {
            stubClient();
            const api = new ClientApi(new MatrixDispatcher());
            expect(api.getDeviceId()).toStrictEqual("ABCDEFGHI");
        });

        it("should return the access token from getAccessToken()", () => {
            const client = stubClient();
            vi.mocked(client.getAccessToken).mockReturnValue("syt_token");
            const api = new ClientApi(new MatrixDispatcher());
            expect(api.getAccessToken()).toStrictEqual("syt_token");
        });

        it.each(["getUserId", "getDeviceId", "getAccessToken"] as const)(
            "should throw from %s() if the client isn't ready",
            (method) => {
                vi.spyOn(MatrixClientPeg, "safeGet").mockImplementation(() => {
                    throw new Error("not logged in");
                });
                const api = new ClientApi(new MatrixDispatcher());
                expect(() => api[method]()).toThrow("not logged in");
            },
        );
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
