/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { useCallback, useState } from "react";

import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";

interface MessagePreviewToggleState {
    shouldShowMessagePreview: boolean;
    toggleMessagePreview: () => void;
}

/**
 * This hook:
 * - Provides a state that tracks whether message previews are turned on or off.
 * - Provides a function to toggle message previews.
 */
export function useMessagePreviewToggle(): MessagePreviewToggleState {
    const [shouldShowMessagePreview, setShouldShowMessagePreview] = useState(() =>
        SettingsStore.getValue("RoomList.showMessagePreview"),
    );

    const toggleMessagePreview = useCallback((): void => {
        setShouldShowMessagePreview((current) => {
            const toggled = !current;
            SettingsStore.setValue("RoomList.showMessagePreview", null, SettingLevel.DEVICE, toggled);
            return toggled;
        });
    }, []);

    return { toggleMessagePreview, shouldShowMessagePreview };
}
