/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";
import { type SettingLevel } from "../../settings/SettingLevel";
import { type SettingKey, type Settings } from "../../settings/Settings";

export interface SettingUpdatedPayload<S extends SettingKey = SettingKey> extends ActionPayload {
    action: Action.SettingUpdated;

    settingName: S;
    roomId: string | null;
    level: SettingLevel;
    newValueAtLevel: Settings[S]["default"];
    newValue: Settings[S]["default"];
}

/**
 * Type guard to check if a payload is a SettingUpdatedPayload for a specific setting.
 * @param payload the payload to assert
 * @param settingName the setting name to check for
 */
export function isSettingUpdatedPayload<S extends SettingKey>(
    payload: SettingUpdatedPayload<any>,
    settingName: S,
): payload is SettingUpdatedPayload<S> {
    return payload.settingName === settingName;
}
