/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, afterEach } from "vitest";

import PosthogTrackers from "../../PosthogTrackers";
import AnalyticsController from "../controllers/AnalyticsController";
import { SettingLevel } from "../SettingLevel";

describe("AnalyticsController", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("Tracks a Posthog interaction on change", () => {
        const trackInteractionSpy = vi.spyOn(PosthogTrackers, "trackInteraction");

        const controller = new AnalyticsController("WebSettingsNotificationsTACOnlyNotificationsToggle");

        controller.onChange(SettingLevel.DEVICE, null, false);

        expect(trackInteractionSpy).toHaveBeenCalledWith("WebSettingsNotificationsTACOnlyNotificationsToggle");
    });
});
