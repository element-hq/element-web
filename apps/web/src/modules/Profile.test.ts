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

describe("WatchableProfile", () => {
    it("should update the profile with the new client on login, before the profile is fetched", () => {
        const profile = new WatchableProfile();
        const listener = vi.fn();
        profile.watch(listener);

        const client = { isGuest: () => true, getUserId: () => "@guest-1:server" } as unknown as MatrixClient;
        defaultDispatcher.dispatch({ action: Action.OnLoggedIn, client }, true);

        expect(profile.value).toMatchObject({ isGuest: true, userId: "@guest-1:server" });
        expect(listener).toHaveBeenCalledWith(profile.value);
    });
});
