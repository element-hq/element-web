/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, beforeEach, vi } from "vitest";

import { CustomisationsApi } from "./customisationsApi";
import { UIComponent } from "../settings/UIFeature.ts";

describe("CustomisationsApi", () => {
    let api: CustomisationsApi;

    beforeEach(() => {
        api = new CustomisationsApi();
    });

    it("should register a shouldShowComponent callback", () => {
        const shouldShowComponent = vi.fn().mockReturnValue(true);
        api.registerShouldShowComponent(shouldShowComponent);
        expect(api.shouldShowComponent(UIComponent.CreateRooms)).toBe(true);
        expect(shouldShowComponent).toHaveBeenCalledWith("UIComponent.roomCreation");
    });

    describe("should support unregistering from registerShouldShowComponent()", () => {
        it("removes the callback", () => {
            const hide = vi.fn().mockReturnValue(false);
            const unregister = api.registerShouldShowComponent(hide);

            unregister();

            expect(api.shouldShowComponent(UIComponent.CreateRooms)).toBeUndefined();
            expect(hide).not.toHaveBeenCalled();
        });

        it("lets a callback registered again take effect instead of the removed one", () => {
            const oldCallback = vi.fn().mockReturnValue(false);
            const newCallback = vi.fn().mockReturnValue(true);
            const unregister = api.registerShouldShowComponent(oldCallback);
            api.registerShouldShowComponent(newCallback);

            unregister();

            expect(api.shouldShowComponent(UIComponent.CreateRooms)).toBe(true);
            expect(oldCallback).not.toHaveBeenCalled();
        });
    });
});
