/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { Room } from "matrix-js-sdk/src/matrix";

import { ActionPayload } from "../payloads";
import { Action } from "../actions";

export enum SpacePreferenceTab {
    Appearance = "SPACE_PREFERENCE_APPEARANCE_TAB",
}

export interface OpenSpacePreferencesPayload extends ActionPayload {
    action: Action.OpenSpacePreferences;

    /**
     * The space to open preferences for.
     */
    space: Room;

    /**
     * Optional tab to open specifically, otherwise the dialog's internal default.
     */
    initialTabId?: SpacePreferenceTab;
}
