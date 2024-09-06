/*
Copyright 2018-2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import BasePlatform from "matrix-react-sdk/src/BasePlatform";

import type { IConfigOptions } from "matrix-react-sdk/src/IConfigOptions";
import { getVectorConfig } from "../getconfig";
import Favicon from "../../favicon";
import { _t } from "../../languageHandler";

/**
 * Vector-specific extensions to the BasePlatform template
 */
export default abstract class VectorBasePlatform extends BasePlatform {
    protected _favicon?: Favicon;

    public async getConfig(): Promise<IConfigOptions | undefined> {
        return getVectorConfig();
    }

    public getHumanReadableName(): string {
        return "Vector Base Platform"; // no translation required: only used for analytics
    }

    /**
     * Delay creating the `Favicon` instance until first use (on the first notification) as
     * it uses canvas, which can trigger a permission prompt in Firefox's resist fingerprinting mode.
     * See https://github.com/element-hq/element-web/issues/9605.
     */
    public get favicon(): Favicon {
        if (this._favicon) {
            return this._favicon;
        }
        this._favicon = new Favicon();
        return this._favicon;
    }

    private updateFavicon(): void {
        let bgColor = "#d00";
        let notif: string | number = this.notificationCount;

        if (this.errorDidOccur) {
            notif = notif || "×";
            bgColor = "#f00";
        }

        this.favicon.badge(notif, { bgColor });
    }

    public setNotificationCount(count: number): void {
        if (this.notificationCount === count) return;
        super.setNotificationCount(count);
        this.updateFavicon();
    }

    public setErrorStatus(errorDidOccur: boolean): void {
        if (this.errorDidOccur === errorDidOccur) return;
        super.setErrorStatus(errorDidOccur);
        this.updateFavicon();
    }

    /**
     * Begin update polling, if applicable
     */
    public startUpdater(): void {}

    /**
     * Get a sensible default display name for the
     * device Vector is running on
     */
    public getDefaultDeviceDisplayName(): string {
        return _t("unknown_device");
    }
}
