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

import { getCurrentLanguage } from './languageHandler';
import MatrixClientPeg from './MatrixClientPeg';
import PlatformPeg from './PlatformPeg';
import SdkConfig from './SdkConfig';

function getRedactedUrl() {
    const redactedHash = window.location.hash.replace(/#\/(room|user)\/(.+)/, "#/$1/<redacted>");
    // hardcoded url to make piwik happy
    return 'https://riot.im/app/' + redactedHash;
}

const customVariables = {
    'App Platform': 1,
    'App Version': 2,
    'User Type': 3,
    'Chosen Language': 4,
};


class Analytics {
    constructor() {
        this._paq = null;
        this.disabled = true;
        this.firstPage = true;
    }

    /**
     * Enable Analytics if initialized but disabled
     * otherwise try and initalize, no-op if piwik config missing
     */
    enable() {
        if (this._paq || this._init()) {
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

        window._paq = this._paq = window._paq || [];

        this._paq.push(['setTrackerUrl', url+'piwik.php']);
        this._paq.push(['setSiteId', siteId]);

        this._paq.push(['trackAllContentImpressions']);
        this._paq.push(['discardHashTag', false]);
        this._paq.push(['enableHeartBeatTimer']);
        this._paq.push(['enableLinkTracking', true]);

        const platform = PlatformPeg.get();
        this._setVisitVariable('App Platform', platform.getHumanReadableName());
        platform.getAppVersion().then((version) => {
            this._setVisitVariable('App Version', version);
        }).catch(() => {
            this._setVisitVariable('App Version', 'unknown');
        });

        this._setVisitVariable('Chosen Language', getCurrentLanguage());

        (function() {
            const g = document.createElement('script');
            const s = document.getElementsByTagName('script')[0];
            g.type='text/javascript'; g.async=true; g.defer=true; g.src=url+'piwik.js';

            g.onload = function() {
                console.log('Initialised anonymous analytics');
                self._paq = window._paq;
            };

            s.parentNode.insertBefore(g, s);
        })();

        return true;
    }

    trackPageChange() {
        if (this.disabled) return;
        if (this.firstPage) {
            // De-duplicate first page
            // router seems to hit the fn twice
            this.firstPage = false;
            return;
        }
        this._paq.push(['setCustomUrl', getRedactedUrl()]);
        this._paq.push(['trackPageView']);
    }

    trackEvent(category, action, name) {
        if (this.disabled) return;
        this._paq.push(['trackEvent', category, action, name]);
    }

    logout() {
        if (this.disabled) return;
        this._paq.push(['deleteCookies']);
    }

    login() { // not used currently
        const cli = MatrixClientPeg.get();
        if (this.disabled || !cli) return;

        this._paq.push(['setUserId', `@${cli.getUserIdLocalpart()}:${cli.getDomain()}`]);
    }

    _setVisitVariable(key, value) {
        this._paq.push(['setCustomVariable', customVariables[key], key, value, 'visit']);
    }

    setGuest(guest) {
        if (this.disabled) return;
        this._setVisitVariable('User Type', guest ? 'Guest' : 'Logged In');
    }
}

if (!global.mxAnalytics) {
    global.mxAnalytics = new Analytics();
}
module.exports = global.mxAnalytics;
