/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type SettingLevel } from "../SettingLevel";
import MatrixClientBackedController from "./MatrixClientBackedController";
import { type WatchManager } from "../WatchManager";
import SettingsStore from "../SettingsStore";
import { type SettingKey } from "../Settings.tsx";

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
        private readonly settingName: SettingKey,
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

    protected async initMatrixClient(): Promise<void> {
        // Check for stable version support first
        if (this.stableVersion && (await this.client!.isVersionSupported(this.stableVersion))) {
            this.disabled = false;
            return;
        }

        // Otherwise, only one of the unstable feature groups needs to be satisfied in
        // order for this setting overall to be enabled
        let isEnabled = false;
        for (const featureGroup of this.unstableFeatureGroups) {
            const featureSupportList = await Promise.all(
                featureGroup.map(async (feature) => {
                    const isFeatureSupported = await this.client!.doesServerSupportUnstableFeature(feature);
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
