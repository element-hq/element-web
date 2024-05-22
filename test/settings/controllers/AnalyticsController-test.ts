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

import PosthogTrackers from "../../../src/PosthogTrackers";
import AnalyticsController from "../../../src/settings/controllers/AnalyticsController";
import { SettingLevel } from "../../../src/settings/SettingLevel";

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
