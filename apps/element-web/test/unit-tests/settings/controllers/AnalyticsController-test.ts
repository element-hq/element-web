/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import PosthogTrackers from "../../../../src/PosthogTrackers";
import AnalyticsController from "../../../../src/settings/controllers/AnalyticsController";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

describe("AnalyticsController", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("Tracks a Posthog interaction on change", () => {
        const trackInteractionSpy = jest.spyOn(PosthogTrackers, "trackInteraction");

        const controller = new AnalyticsController("WebSettingsNotificationsTACOnlyNotificationsToggle");

        controller.onChange(SettingLevel.DEVICE, null, false);

        expect(trackInteractionSpy).toHaveBeenCalledWith("WebSettingsNotificationsTACOnlyNotificationsToggle");
    });
});
