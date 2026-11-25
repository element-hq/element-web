/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export default class SettingsModule {
    static moduleApiVersion = "^*";
    constructor(api) {
        this.api = api;
    }
    async load() {
        // oxlint-disable-next-line no-alert
        alert(this.api.settings.getValue("language"));

        this.api.settings.registerSettings({
            "module.settingsModule.watched": {
                default: false,
                supportedLevels: ["device"],
            },
            "module.settingsModule.written": {
                default: null,
                supportedLevels: ["device"],
            },
        });

        // Report every change of the module's settings.
        for (const settingName of ["module.settingsModule.watched", "module.settingsModule.written"]) {
            this.api.settings.getValueWatchable(settingName).watch((value) => {
                // oxlint-disable-next-line no-alert
                alert(`${settingName} changed to ${value}`);
            });
        }

        await this.api.settings.setValue("module.settingsModule.written", null, "device", "foo");
    }
}
