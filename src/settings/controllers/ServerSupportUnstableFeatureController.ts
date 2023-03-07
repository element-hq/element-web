/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { SettingLevel } from "../SettingLevel";
import MatrixClientBackedController from "./MatrixClientBackedController";
import { WatchManager } from "../WatchManager";
import SettingsStore from "../SettingsStore";

/**
 * Disables a given setting if the server unstable feature it requires is not supported
 * When a setting gets disabled or enabled from this controller it notifies the given WatchManager
 */
export default class ServerSupportUnstableFeatureController extends MatrixClientBackedController {
    private enabled: boolean | undefined;

    public constructor(
        private readonly settingName: string,
        private readonly watchers: WatchManager,
        private readonly unstableFeatures: string[],
        private readonly forcedValue: any = false,
    ) {
        super();
    }

    public get disabled(): boolean {
        return !this.enabled;
    }

    public set disabled(v: boolean) {
        if (!v === this.enabled) return;
        this.enabled = !v;
        const level = SettingsStore.firstSupportedLevel(this.settingName);
        if (!level) return;
        const settingValue = SettingsStore.getValue(this.settingName, null);
        this.watchers.notifyUpdate(this.settingName, null, level, settingValue);
    }

    protected async initMatrixClient(oldClient: MatrixClient, newClient: MatrixClient): Promise<void> {
        this.disabled = true;
        let supported = true;
        for (const feature of this.unstableFeatures) {
            supported = await this.client.doesServerSupportUnstableFeature(feature);
            if (!supported) break;
        }
        this.disabled = !supported;
    }

    public getValueOverride(
        level: SettingLevel,
        roomId: string | null,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        if (this.settingDisabled) {
            return this.forcedValue;
        }
        return null; // no override
    }

    public get settingDisabled(): boolean {
        return this.disabled;
    }
}
