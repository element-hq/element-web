/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook, act } from "jest-matrix-react";

import UIStore, { UI_EVENTS } from "../../../src/stores/UIStore";
import { useWindowWidth } from "../../../src/hooks/useWindowWidth";

describe("useWindowWidth", () => {
    beforeEach(() => {
        UIStore.instance.windowWidth = 768;
    });

    it("should return the current width of window, according to UIStore", () => {
        const { result } = renderHook(() => useWindowWidth());

        expect(result.current).toBe(768);
    });

    it("should update the value when UIStore's value changes", () => {
        const { result } = renderHook(() => useWindowWidth());

        act(() => {
            UIStore.instance.windowWidth = 1024;
            UIStore.instance.emit(UI_EVENTS.Resize);
        });

        expect(result.current).toBe(1024);
    });
});
