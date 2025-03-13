/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { viewUserDeviceSettings } from "../../../../src/actions/handlers/viewUserDeviceSettings";
import { UserTab } from "../../../../src/components/views/dialogs/UserTab";
import { Action } from "../../../../src/dispatcher/actions";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";

describe("viewUserDeviceSettings()", () => {
    const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");

    beforeEach(() => {
        dispatchSpy.mockClear();
    });

    it("dispatches action to view session manager", () => {
        viewUserDeviceSettings();

        expect(dispatchSpy).toHaveBeenCalledWith({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.SessionManager,
        });
    });
});
