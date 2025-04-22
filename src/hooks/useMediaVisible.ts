/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback } from "react";
import { JoinRule, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { SettingLevel } from "../settings/SettingLevel";
import { useSettingValue } from "./useSettings";
import SettingsStore from "../settings/SettingsStore";
import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { MediaPreviewValue } from "../@types/media_preview";
import { useRoomState } from "./useRoomState";

const PRIVATE_JOIN_RULES: JoinRule[] = [JoinRule.Invite, JoinRule.Knock, JoinRule.Restricted];

/**
 * Should the media event be visible in the client, or hidden.
 * @returns A boolean describing the hidden status, and a function to set the visiblity.
 */
export function useMediaVisible(mxEvent?: MatrixEvent): [boolean, (visible: boolean) => void] | [true] {
    const eventId = mxEvent?.getId();
    const mediaPreviewSetting = useSettingValue("mediaPreviewConfig", mxEvent?.getRoomId());
    const client = useMatrixClientContext();
    const eventVisibility = useSettingValue("showMediaEventIds");
    const room = client.getRoom(mxEvent?.getRoomId()) ?? undefined;
    const joinRule = useRoomState(room, (state) => state.getJoinRule());
    const setMediaVisible = useCallback(
        (visible: boolean) => {
            SettingsStore.setValue("showMediaEventIds", null, SettingLevel.DEVICE, {
                ...eventVisibility,
                [eventId!]: visible,
            });
        },
        [eventId, eventVisibility],
    );

    if (mxEvent?.getSender() === client.getUserId()) {
        return [true];
    }

    const roomIsPrivate = joinRule ? PRIVATE_JOIN_RULES.includes(joinRule) : false;

    const explicitEventVisiblity = eventId ? eventVisibility[eventId] : undefined;
    // Always prefer the explicit per-event user preference here.
    if (explicitEventVisiblity !== undefined) {
        return [explicitEventVisiblity, setMediaVisible];
    } else if (mediaPreviewSetting.media_previews === MediaPreviewValue.Off) {
        return [false, setMediaVisible];
    } else if (mediaPreviewSetting.media_previews === MediaPreviewValue.On) {
        return [true, setMediaVisible];
    } else if (mediaPreviewSetting.media_previews === MediaPreviewValue.Private) {
        return [roomIsPrivate, setMediaVisible];
    } else {
        // Invalid setting.
        console.warn("Invalid media visibility setting", mediaPreviewSetting.media_previews);
        return [false, setMediaVisible];
    }
}
