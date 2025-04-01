/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, renderHook, waitFor } from "jest-matrix-react";

import { useMediaVisible } from "../../../src/hooks/useMediaVisible";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";

const EVENT_ID = "$fibble:example.org";

function render() {
    return renderHook(() => useMediaVisible(EVENT_ID));
}

describe("useMediaVisible", () => {
    afterEach(() => {
        // Using act here as otherwise React warns about state updates not being wrapped.
        act(() => {
            SettingsStore.setValue(
                "showMediaEventIds",
                null,
                SettingLevel.DEVICE,
                SettingsStore.getDefaultValue("showMediaEventIds"),
            );
            SettingsStore.setValue(
                "showImages",
                null,
                SettingLevel.DEVICE,
                SettingsStore.getDefaultValue("showImages"),
            );
        });
    });

    it("should display images by default", async () => {
        const { result } = render();
        expect(result.current[0]).toEqual(true);
    });

    it("should hide images when the default is changed", async () => {
        SettingsStore.setValue("showImages", null, SettingLevel.DEVICE, false);
        const { result } = render();
        expect(result.current[0]).toEqual(false);
    });

    it("should hide images after function is called", async () => {
        const { result } = render();
        expect(result.current[0]).toEqual(true);
        act(() => {
            result.current[1](false);
        });
        await waitFor(() => {
            expect(result.current[0]).toEqual(false);
        });
    });
    it("should show images after function is called", async () => {
        SettingsStore.setValue("showImages", null, SettingLevel.DEVICE, false);
        const { result } = render();
        expect(result.current[0]).toEqual(false);
        act(() => {
            result.current[1](true);
        });
        await waitFor(() => {
            expect(result.current[0]).toEqual(true);
        });
    });
});
