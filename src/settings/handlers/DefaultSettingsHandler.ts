/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingsHandler from "./SettingsHandler";

/**
 * Gets settings at the "default" level. This handler does not support setting values.
 * This handler does not make use of the roomId parameter.
 */
export default class DefaultSettingsHandler extends SettingsHandler {
    /**
     * Creates a new default settings handler with the given defaults
     * @param {object} defaults The default setting values, keyed by setting name.
     * @param {object} invertedDefaults The default inverted setting values, keyed by setting name.
     */
    public constructor(
        private defaults: Record<string, any>,
        private invertedDefaults: Record<string, any>,
    ) {
        super();
    }

    public getValue(settingName: string, roomId: string): any {
        let value = this.defaults[settingName];
        if (value === undefined) {
            value = this.invertedDefaults[settingName];
        }
        return value;
    }

    public async setValue(settingName: string, roomId: string, newValue: any): Promise<void> {
        throw new Error("Cannot set values on the default level handler");
    }

    public canSetValue(settingName: string, roomId: string): boolean {
        return false;
    }

    public isSupported(): boolean {
        return true;
    }
}
