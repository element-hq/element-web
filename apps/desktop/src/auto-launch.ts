/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import BaseAutoLaunch from "auto-launch";

import Store from "./store.js";

export type AutoLaunchState = "enabled" | "minimised" | "disabled";

// Wrapper around auto-launch to get/set the `isHidden` option
export class AutoLaunch extends BaseAutoLaunch {
    private static internalInstance?: AutoLaunch;

    public static get instance(): AutoLaunch {
        if (!AutoLaunch.internalInstance) {
            if (!Store.instance) throw new Error("Store not initialized");
            AutoLaunch.internalInstance = new AutoLaunch({
                name: global.vectorConfig.brand || "Element",
                isHidden: Store.instance.get("openAtLoginMinimised"),
                mac: {
                    useLaunchAgent: true,
                },
            });
        }
        return AutoLaunch.internalInstance;
    }

    public async getState(): Promise<AutoLaunchState> {
        if (!(await this.isEnabled())) {
            return "disabled";
        }
        return this.opts.isHiddenOnLaunch ? "minimised" : "enabled";
    }

    public async setState(state: AutoLaunchState): Promise<void> {
        const openAtLoginMinimised = state === "minimised";
        Store.instance?.set("openAtLoginMinimised", openAtLoginMinimised);
        this.opts.isHiddenOnLaunch = openAtLoginMinimised;

        if (state !== "disabled") {
            return this.enable();
        } else {
            return this.disable();
        }
    }
}
