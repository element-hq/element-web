/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JoinRule, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type MediaPreviewConfig, MediaPreviewValue } from "../../@types/media_preview";
import { SettingLevel } from "../../settings/SettingLevel";
import SettingsStore from "../../settings/SettingsStore";

/**
 * Determine whether a room should be treated as private when applying media preview defaults.
 *
 * @param client - Matrix client used to resolve the room and its current join rule.
 * @param roomId - Room to inspect. If omitted or unknown, the room is treated as non-private.
 * @returns `true` when the room's join rule restricts membership, otherwise `false`.
 */
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

/**
 * Resolve whether media for a single event should be shown.
 *
 * Precedence is:
 * 1. An explicit per-event override stored in `showMediaEventIds`
 * 2. Always show media in events sent by the current user
 * 3. Fall back to the room-level `mediaPreviewConfig` policy
 *
 * @param mediaPreviewSetting - Effective room-level media preview configuration.
 * @param eventVisibility - Per-event visibility overrides keyed by event ID.
 * @param userId - Current user ID, used to always show media sent by the local user.
 * @param eventId - Event being evaluated. Used to look up any explicit override.
 * @param sender - Sender of the event being evaluated.
 * @param roomIsPrivate - Whether the event's room should use the private-room preview behavior.
 * @returns `true` when media should be displayed for the event, otherwise `false`.
 */
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

/**
 * Compute the effective media visibility for a Matrix event using the current settings state.
 *
 * @param mxEvent - Event whose media visibility should be evaluated.
 * @param client - Matrix client used to resolve the current user and room metadata.
 * @returns `true` when media should be shown for the event, otherwise `false`.
 */
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

/**
 * Persist a per-event override for whether media should be displayed on this device.
 *
 * @param mxEvent - Event whose media visibility override should be updated.
 * @param visible - Whether media for the event should be shown.
 * @returns A promise that resolves once the device-scoped setting has been updated.
 */
export async function setMediaVisibility(mxEvent: MatrixEvent, visible: boolean): Promise<void> {
    const eventId = mxEvent.getId();
    if (!eventId) return;

    const eventVisibility = SettingsStore.getValue("showMediaEventIds");

    await SettingsStore.setValue("showMediaEventIds", null, SettingLevel.DEVICE, {
        ...eventVisibility,
        [eventId]: visible,
    });
}
