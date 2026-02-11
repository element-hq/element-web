/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Profile, Watchable } from "@element-hq/element-web-module-api";

import { OwnProfileStore } from "../stores/OwnProfileStore.ts";
import { UPDATE_EVENT } from "../stores/AsyncStore.ts";

export class WatchableProfile extends Watchable<Profile> {
    public constructor() {
        super({});
        this.value = this.profile;

        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileChange);
    }

    private get profile(): Profile {
        return {
            isGuest: OwnProfileStore.instance.matrixClient?.isGuest() ?? false,
            userId: OwnProfileStore.instance.matrixClient?.getUserId() ?? undefined,
            displayName: OwnProfileStore.instance.displayName ?? undefined,
        };
    }

    private readonly onProfileChange = (): void => {
        this.value = this.profile;
    };
}
