/*
 Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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

import MatrixClientPeg from './MatrixClientPeg';
import SdkConfig from './SdkConfig';

function redact(str) {
    return str.replace(/#\/(room|user)\/(.+)/, "#/$1/<redacted>");
}

class Analytics {
    constructor() {
        this.tracker = null;
        this.disabled = true;
    }

    /**
     * Enable Analytics if initialized but disabled
     * otherwise try and initalize, no-op if piwik config missing
     */
    enable() {
        if (this.tracker || this._init()) {
            this.disabled = false;
        }
    }

    /**
     * Disable Analytics calls, will not fully unload Piwik until a refresh,
     * but this is second best, Piwik should not pull anything implicitly.
     */
    disable() {
        this.disabled = true;
    }

    _init() {
        const config = SdkConfig.get();
        if (!config || !config.piwik || !config.piwik.url || !config.piwik.siteId) return;

        const url = config.piwik.url;
        const siteId = config.piwik.siteId;
        const self = this;

        (function() {
            const g = document.createElement('script');
            const s = document.getElementsByTagName('script')[0];
            g.type='text/javascript'; g.async=true; g.defer=true; g.src=url+'piwik.js';

            g.onload = function() {
                const tracker = window.Piwik.getTracker(url+'piwik.php', siteId);
                console.log('Initialised anonymous analytics');
                self._set(tracker);
            };

            s.parentNode.insertBefore(g, s);
        })();

        return true;
    }

    _set(tracker) {
        this.tracker = tracker;
        this.tracker.discardHashTag(false);
        this.tracker.enableHeartBeatTimer();
        this.tracker.enableLinkTracking(true);
    }

    async trackPageChange() {
        if (this.disabled) return;
        this.tracker.setCustomUrl(redact(window.location.href));
        this.tracker.trackPageView();
    }

    async trackEvent(category, action, name) {
        if (this.disabled) return;
        this.tracker.trackEvent(category, action, name);
    }

    async logout() {
        if (this.disabled) return;
        this.tracker.deleteCookies();
    }

    async login() { // not used currently
        const cli = MatrixClientPeg.get();
        if (this.disabled || !cli) return;

        this.tracker.setUserId(`@${cli.getUserIdLocalpart()}:${cli.getDomain()}`);
    }

}

if (!global.mxAnalytics) {
    global.mxAnalytics = new Analytics();
}
module.exports = global.mxAnalytics;
