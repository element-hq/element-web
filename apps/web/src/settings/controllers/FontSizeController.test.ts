/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect } from "vitest";

import { Action } from "../../dispatcher/actions";
import dis from "../../dispatcher/dispatcher";
import FontSizeController from "./FontSizeController";
import { SettingLevel } from "../SettingLevel";

const dispatchSpy = vi.spyOn(dis, "dispatch");

describe("FontSizeController", () => {
    it("dispatches a font size action on change", () => {
        const controller = new FontSizeController();

        controller.onChange(SettingLevel.ACCOUNT, "$room:server", 12);

        expect(dispatchSpy).toHaveBeenCalledWith({ action: Action.UpdateFontSizeDelta, delta: 12 });
    });
});
