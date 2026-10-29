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
    public constructor() {
        super({});
        this.value = this.getProfile();

        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileChange);
        defaultDispatcher.register(this.onAction);
    }

    private getProfile(client = OwnProfileStore.instance.matrixClient): Profile {
        return {
            isGuest: client?.isGuest() ?? false,
            userId: client?.getUserId() ?? undefined,
            displayName: OwnProfileStore.instance.displayName ?? undefined,
        };
    }

    private readonly onProfileChange = (): void => {
        this.value = this.getProfile();
    };

    private readonly onAction = (payload: ActionPayload): void => {
        // OwnProfileStore only updates once the profile is fetched, too late for view models built on the first sync
        if (payload.action === Action.OnLoggedIn) {
            this.value = this.getProfile((payload as OnLoggedInPayload).client);
        }
    };
}
