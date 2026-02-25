/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Action } from "../../../../src/dispatcher/actions";
import dis from "../../../../src/dispatcher/dispatcher";
import FontSizeController from "../../../../src/settings/controllers/FontSizeController";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

const dispatchSpy = jest.spyOn(dis, "fire");

describe("FontSizeController", () => {
    it("dispatches a font size action on change", () => {
        const controller = new FontSizeController();

        controller.onChange(SettingLevel.ACCOUNT, "$room:server", 12);

        expect(dispatchSpy).toHaveBeenCalledWith(Action.MigrateBaseFontSize);
    });
});
