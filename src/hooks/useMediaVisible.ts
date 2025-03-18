/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback } from "react";

import { SettingLevel } from "../settings/SettingLevel";
import { useSettingValue } from "./useSettings";
import SettingsStore from "../settings/SettingsStore";

/**
 * Should the media event be visible in the client, or hidden.
 * @param eventId The eventId of the media event.
 * @returns A boolean describing the hidden status, and a function to set the visiblity.
 */
export function useMediaVisible(eventId: string): [boolean, (visible: boolean) => void] {
    const defaultShowImages = useSettingValue("showImages", SettingLevel.DEVICE);
    const eventVisibility = useSettingValue("showMediaEventIds", SettingLevel.DEVICE);
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
    const imgIsVisible = eventVisibility[eventId] ?? defaultShowImages;
    return [imgIsVisible, setMediaVisible];
}
