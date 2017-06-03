// @flow

/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd

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

import BasePlatform from 'matrix-react-sdk/lib/BasePlatform';
import { _t } from 'matrix-react-sdk/lib/languageHandler';

import Favico from 'favico.js';

/**
 * Vector-specific extensions to the BasePlatform template
 */
export default class VectorBasePlatform extends BasePlatform {
    constructor() {
        super();

        // The 'animations' are really low framerate and look terrible.
        // Also it re-starts the animationb every time you set the badge,
        // and we set the state each time, even if the value hasn't changed,
        // so we'd need to fix that if enabling the animation.
        this.favicon = new Favico({animation: 'none'});
        this._updateFavicon();
    }

    getHumanReadableName(): string {
        return 'Vector Base Platform'; // no translation required: only used for analytics
    }

    _updateFavicon() {
        try {
            // This needs to be in in a try block as it will throw
            // if there are more than 100 badge count changes in
            // its internal queue
            let bgColor = "#d00",
                notif = this.notificationCount;

            if (this.errorDidOccur) {
                notif = notif || "×";
                bgColor = "#f00";
            }

            this.favicon.badge(notif, {
                bgColor: bgColor,
            });
        } catch (e) {
            console.warn(`Failed to set badge count: ${e.message}`);
        }
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
     * Check for the availability of an update to the version of the
     * app that's currently running.
     * If an update is available, this function should dispatch the
     * 'new_version' action.
     */
    pollForUpdate() {
    }

    /**
     * Update the currently running app to the latest available
     * version and replace this instance of the app with the
     * new version.
     */
    installUpdate() {
    }

    /**
     * Get a sensible default display name for the
     * device Vector is running on
     */
    getDefaultDeviceDisplayName(): string {
        return _t("Unknown device");
    }
}
