/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import SettingsStore from "../SettingsStore";
import dis from "../../dispatcher/dispatcher";
import { type UpdateSystemFontPayload } from "../../dispatcher/payloads/UpdateSystemFontPayload";
import { Action } from "../../dispatcher/actions";

export default class SystemFontController extends SettingController {
    public constructor() {
        super();
    }

    public onChange(): void {
        // Dispatch font size change so that everything open responds to the change.
        dis.dispatch<UpdateSystemFontPayload>({
            action: Action.UpdateSystemFont,
            useBundledEmojiFont: SettingsStore.getValue("useBundledEmojiFont"),
            useSystemFont: SettingsStore.getValue("useSystemFont"),
            font: SettingsStore.getValue("systemFont"),
        });
    }
}
