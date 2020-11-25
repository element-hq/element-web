/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd
Copyright 2018, 2020 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import BasePlatform from 'matrix-react-sdk/src/BasePlatform';
import {_t} from 'matrix-react-sdk/src/languageHandler';
import {getVectorConfig} from "../getconfig";

import Favicon from "../../favicon";

/**
 * Vector-specific extensions to the BasePlatform template
 */
export default abstract class VectorBasePlatform extends BasePlatform {
    protected _favicon: Favicon;

    async getConfig(): Promise<{}> {
        return getVectorConfig();
    }

    getHumanReadableName(): string {
        return 'Vector Base Platform'; // no translation required: only used for analytics
    }

    /**
     * Delay creating the `Favicon` instance until first use (on the first notification) as
     * it uses canvas, which can trigger a permission prompt in Firefox's resist fingerprinting mode.
     * See https://github.com/vector-im/element-web/issues/9605.
     */
    get favicon() {
        if (this._favicon) {
            return this._favicon;
        }
        return this._favicon = new Favicon();
    }

    _updateFavicon() {
        let bgColor = "#d00";
        let notif: string | number = this.notificationCount;

        if (this.errorDidOccur) {
            notif = notif || "×";
            bgColor = "#f00";
        }

        this.favicon.badge(notif, { bgColor });
    }

    setNotificationCount(count: number) {
        if (this.notificationCount === count) return;
        super.setNotificationCount(count);
        this._updateFavicon();
    }

    setErrorStatus(errorDidOccur: boolean) {
        if (this.errorDidOccur === errorDidOccur) return;
        super.setErrorStatus(errorDidOccur);
        this._updateFavicon();
    }

    /**
     * Begin update polling, if applicable
     */
    startUpdater() {
    }

    /**
     * Get a sensible default display name for the
     * device Vector is running on
     */
    getDefaultDeviceDisplayName(): string {
        return _t("Unknown device");
    }
}
