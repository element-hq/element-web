/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Capabilities } from "matrix-js-sdk/src/matrix";
import SettingsStore from "../SettingsStore";
import type { BooleanSettingKey } from "../Settings.tsx";
import MatrixClientBackedController from "./MatrixClientBackedController.ts";

/**
 * Disables a setting & forces it's value if one or more settings are not enabled
 * and/or a capability on the client check does not pass.
 */
export default class RequiresSettingsController extends MatrixClientBackedController {
    public constructor(
        public readonly settingNames: BooleanSettingKey[],
        private readonly forcedValue = false,
        /**
         * Function to check the capabilites of the client.
         * If defined this will be called when the MatrixClient is instantiated to check
         * the returned capabilites.
         * @returns `true` or a string if the feature is disabled by the feature, otherwise false.
         */
        private readonly isCapabilityDisabled?: (caps: Capabilities) => boolean | string,
    ) {
        super();
    }

    protected initMatrixClient(): void {
        if (this.client && this.isCapabilityDisabled) {
            // Ensure we fetch capabilies at least once.
            void this.client.getCapabilities();
        }
    }

    /**
     * Checks if the `isCapabilityDisabled` function blocks the setting.
     * @returns `true` or a string if the feature is disabled by the feature, otherwise false.
     */
    private get isBlockedByCapabilites(): boolean | string {
        if (!this.isCapabilityDisabled) {
            return false;
        }
        // This works because the cached caps are stored forever, and we have made
        // at least one call to get capaibilies.
        const cachedCaps = this.client?.getCachedCapabilities();
        if (!cachedCaps) {
            // If we do not have any capabilites yet, then assume the setting IS blocked.
            return true;
        }
        return this.isCapabilityDisabled(cachedCaps);
    }

    public get settingDisabled(): boolean | string {
        if (this.settingNames.some((s) => !SettingsStore.getValue(s))) {
            return true;
        }
        return this.isBlockedByCapabilites;
    }

    public getValueOverride(): any {
        if (this.settingDisabled) {
            // per the docs: we force a disabled state when the feature isn't active
            return this.forcedValue;
        }
        if (this.isBlockedByCapabilites) {
            return this.forcedValue;
        }
        return null; // no override
    }
}
