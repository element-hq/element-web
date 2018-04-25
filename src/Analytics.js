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

import { getCurrentLanguage, _t, _td } from './languageHandler';
import PlatformPeg from './PlatformPeg';
import SdkConfig, { DEFAULTS } from './SdkConfig';
import Modal from './Modal';
import sdk from './index';

const hashRegex = /#\/(group|room|user)\/(.+)/;

// Remove all but the first item in the hash path. Redact unexpected hashes.
function getRedactedHash(hash) {
    // Don't leak URLs we aren't expecting - they could contain tokens/PPI
    const match = hashRegex.exec(hash);
    if (!match) {
        console.warn(`Unexpected hash location "${hash}"`);
        return '#/<unexpected hash location>';
    }

    return hash.replace(hashRegex, "#/$1");
}

// Return the current origin and hash separated with a `/`. This does not include query parameters.
function getRedactedUrl() {
    const { origin, hash } = window.location;
    return origin + '/' + getRedactedHash(hash);
}

const customVariables = {
    'App Platform': {
        id: 1,
        expl: _td('The platform you\'re on'),
    },
    'App Version': {
        id: 2,
        expl: _td('The version of Riot.im'),
    },
    'User Type': {
        id: 3,
        expl: _td('Whether or not you\'re logged in (we don\'t record your user name)'),
    },
    'Chosen Language': {
        id: 4,
        expl: _td('Your language of choice'),
    },
    'Instance': {
        id: 5,
        expl: _td('Which officially provided instance you are using, if any'),
    },
    'RTE: Uses Richtext Mode': {
        id: 6,
        expl: _td('Whether or not you\'re using the Richtext mode of the Rich Text Editor'),
    },
    'Homeserver URL': {
        id: 7,
        expl: _td('Your homeserver\'s URL'),
    },
    'Identity Server URL': {
        id: 8,
        expl: _td('Your identity server\'s URL'),
    },
};

function whitelistRedact(whitelist, str) {
    if (whitelist.includes(str)) return str;
    return '<redacted>';
}

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
        this.trackEvent('Analytics', 'opt-out');
        // disableHeartBeatTimer is undocumented but exists in the piwik code
        // the _paq.push method will result in an error being printed in the console
        // if an unknown method signature is passed
        this._paq.push(['disableHeartBeatTimer']);
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
        // this._paq.push(['enableLinkTracking', true]);

        const platform = PlatformPeg.get();
        this._setVisitVariable('App Platform', platform.getHumanReadableName());
        platform.getAppVersion().then((version) => {
            this._setVisitVariable('App Version', version);
        }).catch(() => {
            this._setVisitVariable('App Version', 'unknown');
        });

        this._setVisitVariable('Chosen Language', getCurrentLanguage());

        if (window.location.hostname === 'riot.im') {
            this._setVisitVariable('Instance', window.location.pathname);
        }

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

    trackPageChange(generationTimeMs) {
        if (typeof generationTimeMs !== 'number') {
            throw new Error('Analytics.trackPageChange: expected generationTimeMs to be a number');
        }
        if (this.disabled) return;
        if (this.firstPage) {
            // De-duplicate first page
            // router seems to hit the fn twice
            this.firstPage = false;
            return;
        }
        this._paq.push(['setCustomUrl', getRedactedUrl()]);
        this._paq.push(['setGenerationTimeMs', generationTimeMs]);
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

    _setVisitVariable(key, value) {
        this._paq.push(['setCustomVariable', customVariables[key].id, key, value, 'visit']);
    }

    setLoggedIn(isGuest, homeserverUrl, identityServerUrl) {
        if (this.disabled) return;

        const config = SdkConfig.get();
        const whitelistedHSUrls = config.piwik.whitelistedHSUrls || DEFAULTS.piwik.whitelistedHSUrls;
        const whitelistedISUrls = config.piwik.whitelistedISUrls || DEFAULTS.piwik.whitelistedISUrls;

        this._setVisitVariable('User Type', isGuest ? 'Guest' : 'Logged In');
        this._setVisitVariable('Homeserver URL', whitelistRedact(whitelistedHSUrls, homeserverUrl));
        this._setVisitVariable('Identity Server URL', whitelistRedact(whitelistedISUrls, identityServerUrl));
    }

    setRichtextMode(state) {
        if (this.disabled) return;
        this._setVisitVariable('RTE: Uses Richtext Mode', state ? 'on' : 'off');
    }

    showDetailsModal() {
        const Tracker = window.Piwik.getAsyncTracker();
        const rows = Object.values(customVariables).map((v) => Tracker.getCustomVariable(v.id)).filter(Boolean);

        const resolution = `${window.screen.width}x${window.screen.height}`;

        const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
        Modal.createTrackedDialog('Analytics Details', '', ErrorDialog, {
            title: _t('Analytics'),
            description: <div>
                <div>
                    { _t('The information being sent to us to help make Riot.im better includes:') }
                </div>
                <table>
                    { rows.map((row) => <tr key={row[0]}>
                        <td>{ _t(customVariables[row[0]].expl) }</td>
                        <td><code>{ row[1] }</code></td>
                    </tr>) }
                </table>
                <br />
                <div>
                    { _t('We also record each page you use in the app (currently <CurrentPageHash>), your User Agent'
                        + ' (<CurrentUserAgent>) and your device resolution (<CurrentDeviceResolution>).',
                        {},
                        {
                            CurrentPageHash: <code>{ getRedactedHash() }</code>,
                            CurrentUserAgent: <code>{ navigator.userAgent }</code>,
                            CurrentDeviceResolution: <code>{ resolution }</code>,
                        },
                    ) }

                    { _t('Where this page includes identifiable information, such as a room, '
                        + 'user or group ID, that data is removed before being sent to the server.') }
                </div>
            </div>,
        });
    }
}

if (!global.mxAnalytics) {
    global.mxAnalytics = new Analytics();
}
module.exports = global.mxAnalytics;
