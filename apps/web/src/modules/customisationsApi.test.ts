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

    it("should use the first shouldViewOngoingCall callback returning a boolean", () => {
        expect(api.shouldViewOngoingCall("!room:example.org")).toBeUndefined();

        const undecided = vi.fn().mockReturnValue(undefined);
        api.registerShouldViewOngoingCall(undecided);
        api.registerShouldViewOngoingCall(() => true);
        api.registerShouldViewOngoingCall(() => false);
        expect(api.shouldViewOngoingCall("!room:example.org")).toBe(true);
        expect(undecided).toHaveBeenCalledWith("!room:example.org");
    });
});
