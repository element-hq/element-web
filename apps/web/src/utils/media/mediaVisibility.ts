/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JoinRule, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type MediaPreviewConfig, MediaPreviewValue } from "../../@types/media_preview";
import { SettingLevel } from "../../settings/SettingLevel";
import SettingsStore from "../../settings/SettingsStore";

function isRoomPrivate(client: MatrixClient, roomId?: string): boolean {
    const room = roomId ? client.getRoom(roomId) : undefined;
    const joinRule = room?.currentState.getJoinRule();

    switch (joinRule) {
        case JoinRule.Invite:
        case JoinRule.Knock:
        case JoinRule.Restricted:
            return true;
        default:
            return false;
    }
}

export function computeMediaVisibility(
    mediaPreviewSetting: MediaPreviewConfig,
    eventVisibility: Record<string, boolean>,
    userId: string | undefined,
    eventId: string | undefined,
    sender: string | undefined,
    roomIsPrivate: boolean,
): boolean {
    const explicitEventVisibility = eventId ? eventVisibility[eventId] : undefined;

    if (explicitEventVisibility !== undefined) {
        return explicitEventVisibility;
    }

    if (sender === userId) {
        return true;
    }

    switch (mediaPreviewSetting.media_previews) {
        case MediaPreviewValue.Off:
            return false;
        case MediaPreviewValue.On:
            return true;
        case MediaPreviewValue.Private:
            return roomIsPrivate;
        default:
            console.warn("Invalid media visibility setting", mediaPreviewSetting.media_previews);
            return false;
    }
}

export function getMediaVisibility(mxEvent: MatrixEvent, client: MatrixClient): boolean {
    const eventId = mxEvent.getId();
    const roomId = mxEvent.getRoomId();
    const mediaPreviewSetting = SettingsStore.getValue("mediaPreviewConfig", roomId);
    const eventVisibility = SettingsStore.getValue("showMediaEventIds");

    return computeMediaVisibility(
        mediaPreviewSetting,
        eventVisibility,
        client.getUserId() ?? undefined,
        eventId,
        mxEvent.getSender(),
        isRoomPrivate(client, roomId),
    );
}

export async function setMediaVisibility(mxEvent: MatrixEvent, visible: boolean): Promise<void> {
    const eventId = mxEvent.getId();
    if (!eventId) return;

    const eventVisibility = SettingsStore.getValue("showMediaEventIds");

    await SettingsStore.setValue("showMediaEventIds", null, SettingLevel.DEVICE, {
        ...eventVisibility,
        [eventId]: visible,
    });
}
