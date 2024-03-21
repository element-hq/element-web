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
    // Starts off as `undefined` so when we first compare the `newDisabledValue`, it sees
    // it as a change and updates the watchers.
    private enabled: boolean | undefined;

    /**
     * Construct a new ServerSupportUnstableFeatureController.
     *
     * @param unstableFeatureGroups - If any one of the feature groups is satisfied,
     * then the setting is considered enabled. A feature group is satisfied if all of
     * the features in the group are supported (all features in a group are required).
     */
    public constructor(
        private readonly settingName: string,
        private readonly watchers: WatchManager,
        private readonly unstableFeatureGroups: string[][],
        private readonly stableVersion?: string,
        private readonly disabledMessage?: string,
        private readonly forcedValue: any = false,
    ) {
        super();
    }

    public get disabled(): boolean {
        return !this.enabled;
    }

    public set disabled(newDisabledValue: boolean) {
        if (!newDisabledValue === this.enabled) return;
        this.enabled = !newDisabledValue;
        const level = SettingsStore.firstSupportedLevel(this.settingName);
        if (!level) return;
        const settingValue = SettingsStore.getValue(this.settingName, null);
        this.watchers.notifyUpdate(this.settingName, null, level, settingValue);
    }

    protected async initMatrixClient(oldClient: MatrixClient, newClient: MatrixClient): Promise<void> {
        // Check for stable version support first
        if (this.stableVersion && (await this.client.isVersionSupported(this.stableVersion))) {
            this.disabled = false;
            return;
        }

        // Otherwise, only one of the unstable feature groups needs to be satisfied in
        // order for this setting overall to be enabled
        let isEnabled = false;
        for (const featureGroup of this.unstableFeatureGroups) {
            const featureSupportList = await Promise.all(
                featureGroup.map(async (feature) => {
                    const isFeatureSupported = await this.client.doesServerSupportUnstableFeature(feature);
                    return isFeatureSupported;
                }),
            );

            // Every feature in a feature group is required in order
            // for this setting overall to be enabled.
            const isFeatureGroupSatisfied = featureSupportList.every((isFeatureSupported) => isFeatureSupported);
            if (isFeatureGroupSatisfied) {
                isEnabled = true;
                break;
            }
        }

        this.disabled = !isEnabled;
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

    public get settingDisabled(): boolean | string {
        if (this.disabled) {
            return this.disabledMessage ?? true;
        }
        return false;
    }
}
