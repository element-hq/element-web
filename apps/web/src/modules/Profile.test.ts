/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { WatchableProfile } from "./Profile";
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { OwnProfileStore } from "../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../stores/AsyncStore";

describe("WatchableProfile", () => {
    it("should update the profile with the new client on login, before the profile is fetched", () => {
        const profile = new WatchableProfile();
        const listener = vi.fn();
        profile.watch(listener);

        const client = {
            isGuest: () => true,
            getUserId: () => "@guest-1:server",
            getDeviceId: () => "GUESTDEVICE",
            getHomeserverUrl: () => "https://matrix.server",
        } as unknown as MatrixClient;
        defaultDispatcher.dispatch({ action: Action.OnLoggedIn, client }, true);

        expect(profile.value).toMatchObject({
            isGuest: true,
            userId: "@guest-1:server",
            deviceId: "GUESTDEVICE",
            homeserverUrl: "https://matrix.server",
        });
        expect(listener).toHaveBeenCalledWith(profile.value);
    });

    it("clears the session on logout even when the profile store still has the old client", () => {
        const profile = new WatchableProfile();
        const listener = vi.fn();
        profile.watch(listener);
        const client = {
            isGuest: () => false,
            getUserId: () => "@user:server",
            getDeviceId: () => "OLD_DEVICE",
            getHomeserverUrl: () => "https://matrix.server",
        } as unknown as MatrixClient;
        const storeClient = vi.spyOn(OwnProfileStore.instance, "matrixClient", "get").mockReturnValue(client);

        defaultDispatcher.dispatch({ action: Action.OnLoggedIn, client }, true);
        expect(profile.value.userId).toBe("@user:server");

        defaultDispatcher.dispatch({ action: Action.OnLoggedOut }, true);
        expect(profile.value).toEqual({});
        expect(listener).toHaveBeenLastCalledWith({});

        OwnProfileStore.instance.emit(UPDATE_EVENT);
        expect(profile.value).toEqual({});

        defaultDispatcher.dispatch({ action: Action.OnLoggedIn, client }, true);
        expect(profile.value).toMatchObject({ userId: "@user:server", deviceId: "OLD_DEVICE" });
        storeClient.mockRestore();
    });
});
