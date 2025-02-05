/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingsHandler from "./SettingsHandler";
import PlatformPeg from "../../PlatformPeg";
import { SETTINGS } from "../Settings";
import { SettingLevel } from "../SettingLevel";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions";

/**
 * Gets and sets settings at the "platform" level for the current device.
 * This handler does not make use of the roomId parameter.
 */
export default class PlatformSettingsHandler extends SettingsHandler {
    private store: { [settingName: string]: any } = {};

    public constructor() {
        super();

        defaultDispatcher.register(this.onAction);
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.PlatformSet) {
            this.store = {};
            // Load setting values as they are async and `getValue` must be synchronous
            Object.entries(SETTINGS).forEach(([key, setting]) => {
                if (setting.supportedLevels?.includes(SettingLevel.PLATFORM) && payload.platform.supportsSetting(key)) {
                    payload.platform.getSettingValue(key).then((value: any) => {
                        this.store[key] = value;
                    });
                }
            });
        }
    };

    public canSetValue(settingName: string, roomId: string): boolean {
        return PlatformPeg.get()?.supportsSetting(settingName) ?? false;
    }

    public getValue(settingName: string, roomId: string): any {
        return this.store[settingName];
    }

    public async setValue(settingName: string, roomId: string, newValue: any): Promise<void> {
        this.store[settingName] = newValue; // keep cache up to date for synchronous access
        await PlatformPeg.get()?.setSettingValue(settingName, newValue);
    }

    public isSupported(): boolean {
        return PlatformPeg.get()?.supportsSetting() ?? false;
    }
}
