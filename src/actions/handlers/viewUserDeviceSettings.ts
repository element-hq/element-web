/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { UserTab } from "../../components/views/dialogs/UserTab";
import { Action } from "../../dispatcher/actions";
import defaultDispatcher from "../../dispatcher/dispatcher";

/**
 * Open user device manager settings
 */
export const viewUserDeviceSettings = (): void => {
    defaultDispatcher.dispatch({
        action: Action.ViewUserSettings,
        initialTabId: UserTab.SessionManager,
    });
};
