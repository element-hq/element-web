/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { renderHook } from "@testing-library/react-hooks";
import { act } from "@testing-library/react";

import UIStore, { UI_EVENTS } from "../../src/stores/UIStore";
import { useWindowWidth } from "../../src/hooks/useWindowWidth";

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
