/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import { type SettingLevel } from "../SettingLevel";
import PosthogTrackers, { type InteractionName } from "../../PosthogTrackers";

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
