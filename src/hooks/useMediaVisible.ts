/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback } from "react";

import { SettingLevel } from "../settings/SettingLevel";
import { useSettingValue } from "./useSettings";
import SettingsStore from "../settings/SettingsStore";
import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { JoinRule, MediaPreviewConfig } from "matrix-js-sdk/src/matrix";

const PRIVATE_JOIN_RULES: JoinRule[] = [JoinRule.Invite, JoinRule.Knock, JoinRule.Restricted];

/**
 * Should the media event be visible in the client, or hidden.
 * @param eventId The eventId of the media event.
 * @returns A boolean describing the hidden status, and a function to set the visiblity.
 */
export function useMediaVisible(eventId: string, roomId: string): [boolean, (visible: boolean) => void] {
    const mediaPreviewSetting = useSettingValue("mediaPreviewConfig", roomId);
    // const defaultShowImages = useSettingValue("showImages");
    const client = useMatrixClientContext();
    const eventVisibility = useSettingValue("showMediaEventIds");
    const setMediaVisible = useCallback(
        (visible: boolean) => {
            SettingsStore.setValue("showMediaEventIds", null, SettingLevel.DEVICE, {
                ...eventVisibility,
                [eventId]: visible,
            });
        },
        [eventId, eventVisibility],
    );

    // Always prefer the explicit per-event user preference here.
    if (eventVisibility[eventId]) {
        return [true, setMediaVisible];
    } else if (mediaPreviewSetting === MediaPreviewConfig.Off) {
        return [false, setMediaVisible];
    } else if (mediaPreviewSetting === MediaPreviewConfig.On) {
        return [false, setMediaVisible];
    }
    const joinRule = client.getRoom(roomId)?.getJoinRule();
    if (PRIVATE_JOIN_RULES.includes(joinRule as JoinRule)) {
        console.log("Room is private");
        return [true, setMediaVisible];
    } else { // All other join rules, and unknown will default to hiding.
        console.log("Room is probably public");
        return [false, setMediaVisible];
    }

}
