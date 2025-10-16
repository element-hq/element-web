/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import PlatformPeg from "../../PlatformPeg";

export default class ProtocolHandlerController extends SettingController {
    public constructor() {
        super();
    }

    public get settingDisabled() {
        return PlatformPeg.get()?.registerProtocolHandler === undefined;
    }

    public onChange(): void {
        const platform = PlatformPeg.get()!;
        const uri = platform.baseUrl;
        platform.registerProtocolHandler!(`${uri}#/%s`);
    }
}
