/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel } from "@element-hq/web-shared-components";

import type SettingsStore from "../../settings/SettingsStore";
import type { RetentionConfigurationResponse } from "matrix-js-sdk/src/retentionPolicy";
import type { MatrixClient } from "matrix-js-sdk/src/client";
import type { Room } from "matrix-js-sdk/src/models/room";

export interface RoomRententionConfigViewModelProps {
    /**
     * Is rentention enabled.
     */
    settingsStore: Pick<typeof SettingsStore, "getValue" | "setValue" | "watchSetting" | "unwatchSetting">;

    client: MatrixClient;

    room: Room;
}

interface RoomRententionConfigViewSnapshot {
    featureEnabled?: boolean;
    serverSidePolicy?: RetentionConfigurationResponse;
    maxRetentionMs?: number;
}

/**
 * View model backing the custom themes developer tool.
 *
 * Owns downloading a theme from a URL, validating it, and adding it to (or removing it from)
 * the `custom_themes` account setting.
 */
export class RoomRententionConfigViewModel extends BaseViewModel<
    RoomRententionConfigViewSnapshot,
    RoomRententionConfigViewModelProps
> {
    public constructor(props: RoomRententionConfigViewModelProps) {
        super(props, {
            featureEnabled: props.settingsStore.getValue("feature_retention"),
            maxRetentionMs: props.room["retention"]?.["maxRetention"] ?? undefined,
        });

        const watcherRef = props.settingsStore.watchSetting(
            "feature_retention",
            null,
            (featureName, _roomId, _level, value) => {
                this.snapshot.merge({ featureEnabled: value ?? false });
            },
        );
        this.disposables.track(() => props.settingsStore.unwatchSetting(watcherRef));

        void this.computeSnapshot();
    }

    public async computeSnapshot() {
        const serverSidePolicy = await this.props.client.retentionPolicyService.fetch();
        this.snapshot.merge({ serverSidePolicy });
    }
}
