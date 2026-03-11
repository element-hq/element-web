/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JoinRule, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MediaPreviewValue } from "../../@types/media_preview";
import { SettingLevel } from "../../settings/SettingLevel";
import SettingsStore from "../../settings/SettingsStore";

const PRIVATE_JOIN_RULES: JoinRule[] = [JoinRule.Invite, JoinRule.Knock, JoinRule.Restricted];

function isRoomPrivate(client: MatrixClient, roomId?: string): boolean {
    const room = roomId ? client.getRoom(roomId) : undefined;
    const joinRule = room?.getJoinRule();

    return joinRule ? PRIVATE_JOIN_RULES.includes(joinRule) : false;
}

export function getMediaVisibility(mxEvent: MatrixEvent, client: MatrixClient): boolean {
    const eventId = mxEvent.getId();
    const roomId = mxEvent.getRoomId();
    const mediaPreviewSetting = SettingsStore.getValue("mediaPreviewConfig", roomId);
    const eventVisibility = SettingsStore.getValue("showMediaEventIds");
    const explicitEventVisibility = eventId ? eventVisibility[eventId] : undefined;

    if (explicitEventVisibility !== undefined) {
        return explicitEventVisibility;
    }

    if (mxEvent.getSender() === client.getUserId()) {
        return true;
    }

    switch (mediaPreviewSetting.media_previews) {
        case MediaPreviewValue.Off:
            return false;
        case MediaPreviewValue.On:
            return true;
        case MediaPreviewValue.Private:
            return isRoomPrivate(client, roomId);
        default:
            console.warn("Invalid media visibility setting", mediaPreviewSetting.media_previews);
            return false;
    }
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
