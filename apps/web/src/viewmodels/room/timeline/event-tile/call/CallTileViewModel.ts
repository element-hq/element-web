/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, CallType, type CallTileViewSnapshot } from "@element-hq/web-shared-components";
import { EventType, type MatrixEvent, MatrixEventEvent, RelationType } from "matrix-js-sdk/src/matrix";

import type { IRTCNotificationContent } from "matrix-js-sdk/src/matrixrtc";
import SettingsStore from "../../../../../settings/SettingsStore";
import { formatTime } from "../../../../../DateUtils";
import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import type { SettingUpdatedPayload } from "../../../../../dispatcher/payloads/SettingUpdatedPayload";
import type { ActionPayload } from "../../../../../dispatcher/payloads";
import { Action } from "../../../../../dispatcher/actions";
import type { GetRelationsForEvent } from "../../../../../components/views/rooms/EventTile";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";

export interface CallTileViewModelProps {
    /**
     * Event of type `org.matrix.msc4075.rtc.notification`.
     */
    mxEvent: MatrixEvent;
    /**
     * Helper to fetch related events from a given event.
     */
    getRelationsForEvent?: GetRelationsForEvent;
}

function getIntentFromEvent(event: MatrixEvent): CallTileViewSnapshot["type"] {
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

function getTs(event: MatrixEvent): number {
    if (event.getType() === EventType.RTCNotification) {
        /**
         * According to the spec:
         * Receivers SHOULD use origin_server_ts if |sender_ts - origin_server_ts| > 20000 ms.
         */
        const content = event.getContent<IRTCNotificationContent>();
        const senderTs = content["sender_ts"];
        const originServerTs = event.getTs();
        const ts = Math.abs(senderTs - originServerTs) > 20000 ? originServerTs : senderTs;
        return ts;
    } else return event.getTs();
}

function getTimeFromEvent(event: MatrixEvent, showTwelveHour: boolean): CallTileViewSnapshot["timestamp"] {
    const ts = getTs(event);
    const date = new Date(ts);
    const timestamp = formatTime(date, showTwelveHour);
    return timestamp;
}

function generateSnapshot(
    event: MatrixEvent,
    getRelationsForEvent?: GetRelationsForEvent,
): { snapshot: CallTileViewSnapshot; declineEvent: MatrixEvent | null } {
    const type = getIntentFromEvent(event);
    const declineEvent = getDeclinedEvent(event, getRelationsForEvent);
    let isCallDeclinedByUs: boolean | undefined;
    if (declineEvent) {
        isCallDeclinedByUs = declineEvent.getSender() === MatrixClientPeg.get()?.getUserId();
    }
    const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
    const timestamp = getTimeFromEvent(declineEvent ?? event, showTwelveHour);
    return { snapshot: { type, timestamp, isCallDeclinedByUs }, declineEvent };
}

function isSettingsChangedPayload(payload: ActionPayload): payload is SettingUpdatedPayload {
    return payload.action === Action.SettingUpdated;
}

/**
 * Get a declined event that is related to the given rtc notification event.
 * @param event rtc notification event
 */
function getDeclinedEvent(event: MatrixEvent, getRelationsForEvent?: GetRelationsForEvent): MatrixEvent | null {
    const eventId = event.getId();
    if (eventId && getRelationsForEvent) {
        const relations = getRelationsForEvent(eventId, RelationType.Reference, EventType.RTCDecline)?.getRelations();
        if (relations) return relations[0];
    }
    return null;
}

/**
 * Common view-model for call tiles; currently used to render:
 * 1. A tile that indicates that a call occurred (call tombstone).
 * 2. A tile that indicates that a call was declined.
 */
export class CallTileViewModel extends BaseViewModel<CallTileViewSnapshot, CallTileViewModelProps> {
    /**
     * The decline event associated with this call, if any.
     */
    private declineEvent: MatrixEvent | null;

    public constructor(props: CallTileViewModelProps) {
        const { declineEvent, snapshot } = generateSnapshot(props.mxEvent, props.getRelationsForEvent);
        super(props, snapshot);
        this.declineEvent = declineEvent;

        // Listen to the changes on settings so that we can update the timestamp format (12H vs 24H).
        SettingsStore.monitorSetting("showTwelveHourTimestamps", null);
        const token = defaultDispatcher.register(this.onAction);
        this.disposables.track(() => {
            defaultDispatcher.unregister(token);
        });

        // When a relation is added to the event, recompute the state.
        this.disposables.trackListener(props.mxEvent, MatrixEventEvent.RelationsCreated, () => {
            const { declineEvent, snapshot } = generateSnapshot(props.mxEvent, props.getRelationsForEvent);
            this.declineEvent = declineEvent;
            this.snapshot.set(snapshot);
        });
    }

    private onAction = (payload: ActionPayload): void => {
        if (!isSettingsChangedPayload(payload) || payload.settingName !== "showTwelveHourTimestamps") return;
        const showTwelveHour = (payload.newValue as boolean) ?? false;
        const timestamp = getTimeFromEvent(this.declineEvent ?? this.props.mxEvent, showTwelveHour);
        this.snapshot.merge({ timestamp });
    };

    /**
     * Whether the call associated with this vm has been declined.
     */
    public get isCallDeclined(): boolean {
        return !!this.declineEvent;
    }
}
