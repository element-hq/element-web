/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Profile, Watchable } from "@element-hq/element-web-module-api";

import { OwnProfileStore } from "../stores/OwnProfileStore.ts";
import { UPDATE_EVENT } from "../stores/AsyncStore.ts";
import defaultDispatcher from "../dispatcher/dispatcher.ts";
import { Action } from "../dispatcher/actions.ts";
import { type ActionPayload } from "../dispatcher/payloads.ts";
import { type OnLoggedInPayload } from "../dispatcher/payloads/OnLoggedInPayload.ts";

export class WatchableProfile extends Watchable<Profile> {
    private loggedOut = false;
    private dispatcherRef?: string;

    public constructor() {
        super({});
        this.value = this.getProfile();

        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileChange);
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    /**
     * Stops listening to the dispatcher and the profile store. Only expected to be called in tests, as the
     * module API's profile otherwise lives as long as the app.
     */
    public destroy(): void {
        OwnProfileStore.instance.off(UPDATE_EVENT, this.onProfileChange);
        defaultDispatcher.unregister(this.dispatcherRef);
        this.dispatcherRef = undefined;
    }

    private getProfile(client = OwnProfileStore.instance.matrixClient): Profile {
        return {
            isGuest: client?.isGuest() ?? false,
            userId: client?.getUserId() ?? undefined,
            deviceId: client?.getDeviceId() ?? undefined,
            displayName: OwnProfileStore.instance.displayName ?? undefined,
            homeserverUrl: client?.getHomeserverUrl() ?? undefined,
        };
    }

    private readonly onProfileChange = (): void => {
        if (!this.loggedOut) this.value = this.getProfile();
    };

    private readonly onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.OnLoggedIn) {
            // OwnProfileStore updates after the first sync, too late for view models built at login.
            this.loggedOut = false;
            this.value = this.getProfile((payload as OnLoggedInPayload).client);
        } else if (payload.action === Action.OnLoggedOut) {
            this.loggedOut = true;
            this.value = {};
        }
    };
}
