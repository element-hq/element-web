/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, CallType, type CallStartedTileViewSnapshot } from "@element-hq/web-shared-components";

import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { IRTCNotificationContent } from "matrix-js-sdk/src/matrixrtc";
import SettingsStore from "../../../../../settings/SettingsStore";
import { formatTime } from "../../../../../DateUtils";
import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import type { SettingUpdatedPayload } from "../../../../../dispatcher/payloads/SettingUpdatedPayload";
import type { ActionPayload } from "../../../../../dispatcher/payloads";
import { Action } from "../../../../../dispatcher/actions";

export interface CallStartedTileViewModelProps {
    mxEvent: MatrixEvent;
}

function getIntentFromEvent(event: MatrixEvent): CallStartedTileViewSnapshot["type"] {
    const content = event.getContent<IRTCNotificationContent>();
    const intentInContent = content["m.call.intent"];
    switch (intentInContent) {
        case "audio":
            return CallType.Voice;
        case "video":
        default:
            return CallType.Video;
    }
}

function getTimeFromEvent(event: MatrixEvent, showTwelveHour: boolean): CallStartedTileViewSnapshot["timestamp"] {
    const content = event.getContent<IRTCNotificationContent>();
    const senderTs = content["sender_ts"];
    const originServerTs = event.getTs();
    const ts = Math.abs(senderTs - originServerTs) > 20000 ? originServerTs : senderTs;

    const date = new Date(ts);
    const timestamp = formatTime(date, showTwelveHour);
    return timestamp;
}

function getInitialSnapshot(event: MatrixEvent): CallStartedTileViewSnapshot {
    const type = getIntentFromEvent(event);
    const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
    const timestamp = getTimeFromEvent(event, showTwelveHour);
    return { type, timestamp };
}

function isSettingsChangedPayload(payload: ActionPayload): payload is SettingUpdatedPayload {
    return payload.action === Action.SettingUpdated;
}

/**
 * ViewModel for a timeline tile that indicates the start of an element call.
 */
export class CallStartedTileViewModel extends BaseViewModel<
    CallStartedTileViewSnapshot,
    CallStartedTileViewModelProps
> {
    public constructor(props: CallStartedTileViewModelProps) {
        super(props, getInitialSnapshot(props.mxEvent));
        SettingsStore.monitorSetting("showTwelveHourTimestamps", null);
        const token = defaultDispatcher.register(this.onAction);
        this.disposables.track(() => {
            defaultDispatcher.unregister(token);
        });
    }

    private onAction = (payload: ActionPayload): void => {
        if (!isSettingsChangedPayload(payload) || payload.settingName !== "showTwelveHourTimestamps") return;
        const showTwelveHour = (payload.newValue as boolean) ?? false;
        const timestamp = getTimeFromEvent(this.props.mxEvent, showTwelveHour);
        this.snapshot.merge({ timestamp });
    };
}
