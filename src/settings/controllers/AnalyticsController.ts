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

import SettingController from "./SettingController";
import { SettingLevel } from "../SettingLevel";
import PosthogTrackers, { InteractionName } from "../../PosthogTrackers";

/**
 * Controller that sends events to analytics when a setting is changed.
 * Since it will only trigger events when the setting is changed,
 * (and the value isn't reported: only the fact that it's been toggled)
 * it won't be useful for tracking what percentage of a userbase has a given setting
 * enabled, but many of our settings can be set per device and Posthog only supports
 * per-user properties, so this isn't straightforward. This is only for seeing how
 * often people interact with the settings.
 */
export default class AnalyticsController extends SettingController {
    /**
     *
     * @param interactionName The name of the event to send to analytics
     */
    public constructor(private interactionName: InteractionName) {
        super();
    }

    public onChange(_level: SettingLevel, _roomId: string | null, _newValue: any): void {
        PosthogTrackers.trackInteraction(this.interactionName);
    }
}
