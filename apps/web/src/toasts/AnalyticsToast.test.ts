/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";

import ToastStore from "../stores/ToastStore";
import SettingsStore from "../settings/SettingsStore";
import { showToast } from "./AnalyticsToast";
import { shouldShowComponent } from "../customisations/helpers/UIComponents";
import { UIComponent } from "../settings/UIFeature";

vi.mock("../customisations/helpers/UIComponents", () => ({ shouldShowComponent: vi.fn() }));

describe("AnalyticsToast", () => {
    const addOrReplaceToastSpy = vi.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");

    beforeEach(() => {
        addOrReplaceToastSpy.mockClear();
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(null);
        vi.mocked(shouldShowComponent).mockReturnValue(true);
    });

    it("should show the toast", () => {
        showToast();
        expect(addOrReplaceToastSpy).toHaveBeenCalledWith(expect.objectContaining({ key: "analytics" }));
    });

    it("should do nothing if a module hides the onboarding toasts", () => {
        vi.mocked(shouldShowComponent).mockReturnValue(false);

        showToast();
        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.OnboardingToasts);
        expect(addOrReplaceToastSpy).not.toHaveBeenCalled();
    });
});
