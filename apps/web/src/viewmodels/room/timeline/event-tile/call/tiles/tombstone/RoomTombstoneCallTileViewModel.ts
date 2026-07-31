/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, type RoomTombstoneCallTileViewSnapshot } from "@element-hq/web-shared-components";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../../../../../../settings/SettingsStore";
import defaultDispatcher from "../../../../../../../dispatcher/dispatcher";
import type { SettingUpdatedPayload } from "../../../../../../../dispatcher/payloads/SettingUpdatedPayload";
import type { ActionPayload } from "../../../../../../../dispatcher/payloads";
import { Action } from "../../../../../../../dispatcher/actions";
import type { GetRelationsForEvent } from "../../../../../../../components/views/rooms/EventTile";
import { getTimeFromEvent } from "./common";

export interface RoomTombstoneCallTileViewModelProps {
    /**
     * Event of type `org.matrix.msc4075.rtc.notification`.
     */
    mxEvent: MatrixEvent;
    /**
     * Helper to fetch related events from a given event.
     */
    getRelationsForEvent?: GetRelationsForEvent;
}

function generateSnapshot(event: MatrixEvent): RoomTombstoneCallTileViewSnapshot {
    const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
    const timestamp = getTimeFromEvent(event, showTwelveHour);
    return { timestamp };
}

function isSettingsChangedPayload(payload: ActionPayload): payload is SettingUpdatedPayload {
    return payload.action === Action.SettingUpdated;
}

/**
 * View model for a tombstone call in a room.
 */
export class RoomTombstoneCallTileViewModel<
    T extends RoomTombstoneCallTileViewSnapshot = RoomTombstoneCallTileViewSnapshot,
    P extends RoomTombstoneCallTileViewModelProps = RoomTombstoneCallTileViewModelProps,
> extends BaseViewModel<T, P> {
    public constructor(props: P, extraSnapshot: Partial<T> = {}) {
        const snapshot = { ...generateSnapshot(props.mxEvent), ...extraSnapshot };
        super(props, snapshot as T);

        // Listen to the changes on settings so that we can update the timestamp format (12H vs 24H).
        SettingsStore.monitorSetting("showTwelveHourTimestamps", null);
        const token = defaultDispatcher.register(this.onAction);
        this.disposables.track(() => {
            defaultDispatcher.unregister(token);
        });
    }

    private onAction = (payload: ActionPayload): void => {
        if (!isSettingsChangedPayload(payload) || payload.settingName !== "showTwelveHourTimestamps") return;
        const showTwelveHour = (payload.newValue as boolean) ?? false;
        const timestamp = this.getTimestamp(showTwelveHour);
        this.snapshot.merge({ timestamp } as Partial<T>);
    };

    protected getTimestamp(showTwelveHour: boolean): string {
        return getTimeFromEvent(this.props.mxEvent, showTwelveHour);
    }
}
