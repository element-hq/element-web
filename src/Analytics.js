/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';

import { getCurrentLanguage, _t, _td } from './languageHandler';
import PlatformPeg from './PlatformPeg';
import SdkConfig from './SdkConfig';
import Modal from './Modal';
import * as sdk from './index';

const hashRegex = /#\/(groups?|room|user|settings|register|login|forgot_password|home|directory)/;
const hashVarRegex = /#\/(group|room|user)\/.*$/;

// Remove all but the first item in the hash path. Redact unexpected hashes.
function getRedactedHash(hash) {
    // Don't leak URLs we aren't expecting - they could contain tokens/PII
    const match = hashRegex.exec(hash);
    if (!match) {
        console.warn(`Unexpected hash location "${hash}"`);
        return '#/<unexpected hash location>';
    }

    if (hashVarRegex.test(hash)) {
        return hash.replace(hashVarRegex, "#/$1/<redacted>");
    }

    return hash.replace(hashRegex, "#/$1");
}

// Return the current origin, path and hash separated with a `/`. This does
// not include query parameters.
function getRedactedUrl() {
    const { origin, hash } = window.location;
    let { pathname } = window.location;

    // Redact paths which could contain unexpected PII
    if (origin.startsWith('file://')) {
        pathname = "/<redacted>/";
    }

    return origin + pathname + getRedactedHash(hash);
}

const customVariables = {
    // The Matomo installation at https://matomo.riot.im is currently configured
    // with a limit of 10 custom variables.
    'App Platform': {
        id: 1,
        expl: _td('The platform you\'re on'),
        example: 'Electron Platform',
    },
    'App Version': {
        id: 2,
        expl: _td('The version of %(brand)s'),
        getTextVariables: () => ({
            brand: SdkConfig.get().brand,
        }),
        example: '15.0.0',
    },
    'User Type': {
        id: 3,
        expl: _td('Whether or not you\'re logged in (we don\'t record your username)'),
        example: 'Logged In',
    },
    'Chosen Language': {
        id: 4,
        expl: _td('Your language of choice'),
        example: 'en',
    },
    'Instance': {
        id: 5,
        expl: _td('Which officially provided instance you are using, if any'),
        example: 'app',
    },
    'RTE: Uses Richtext Mode': {
        id: 6,
        expl: _td('Whether or not you\'re using the Richtext mode of the Rich Text Editor'),
        example: 'off',
    },
    'Homeserver URL': {
        id: 7,
        expl: _td('Your homeserver\'s URL'),
        example: 'https://matrix.org',
    },
    'Touch Input': {
        id: 8,
        expl: _td("Whether you're using %(brand)s on a device where touch is the primary input mechanism"),
        getTextVariables: () => ({
            brand: SdkConfig.get().brand,
        }),
        example: 'false',
    },
    'Breadcrumbs': {
        id: 9,
        expl: _td("Whether or not you're using the 'breadcrumbs' feature (avatars above the room list)"),
        example: 'disabled',
    },
    'Installed PWA': {
        id: 10,
        expl: _td("Whether you're using %(brand)s as an installed Progressive Web App"),
        getTextVariables: () => ({
            brand: SdkConfig.get().brand,
        }),
        example: 'false',
    },
};

function whitelistRedact(whitelist, str) {
    if (whitelist.includes(str)) return str;
    return '<redacted>';
}

const UID_KEY = "mx_Riot_Analytics_uid";
const CREATION_TS_KEY = "mx_Riot_Analytics_cts";
const VISIT_COUNT_KEY = "mx_Riot_Analytics_vc";
const LAST_VISIT_TS_KEY = "mx_Riot_Analytics_lvts";

function getUid() {
    try {
        let data = localStorage && localStorage.getItem(UID_KEY);
        if (!data && localStorage) {
            localStorage.setItem(UID_KEY, data = [...Array(16)].map(() => Math.random().toString(16)[2]).join(''));
        }
        return data;
    } catch (e) {
        console.error("Analytics error: ", e);
        return "";
    }
}

const HEARTBEAT_INTERVAL = 30 * 1000; // seconds

class Analytics {
    constructor() {
        this.baseUrl = null;
        this.siteId = null;
        this.visitVariables = {};

        this.firstPage = true;
        this._heartbeatIntervalID = null;

        this.creationTs = localStorage && localStorage.getItem(CREATION_TS_KEY);
        if (!this.creationTs && localStorage) {
            localStorage.setItem(CREATION_TS_KEY, this.creationTs = new Date().getTime());
        }

        this.lastVisitTs = localStorage && localStorage.getItem(LAST_VISIT_TS_KEY);
        this.visitCount = localStorage && localStorage.getItem(VISIT_COUNT_KEY) || 0;
        if (localStorage) {
            localStorage.setItem(VISIT_COUNT_KEY, parseInt(this.visitCount, 10) + 1);
        }
    }

    get disabled() {
        return !this.baseUrl;
    }

    /**
     * Enable Analytics if initialized but disabled
     * otherwise try and initalize, no-op if piwik config missing
     */
    async enable() {
        if (!this.disabled) return;

        const config = SdkConfig.get();
        if (!config || !config.piwik || !config.piwik.url || !config.piwik.siteId) return;

        this.baseUrl = new URL("piwik.php", config.piwik.url);
        // set constants
        this.baseUrl.searchParams.set("rec", 1); // rec is required for tracking
        this.baseUrl.searchParams.set("idsite", config.piwik.siteId); // rec is required for tracking
        this.baseUrl.searchParams.set("apiv", 1); // API version to use
        this.baseUrl.searchParams.set("send_image", 0); // we want a 204, not a tiny GIF
        // set user parameters
        this.baseUrl.searchParams.set("_id", getUid()); // uuid
        this.baseUrl.searchParams.set("_idts", this.creationTs); // first ts
        this.baseUrl.searchParams.set("_idvc", parseInt(this.visitCount, 10)+ 1); // visit count
        if (this.lastVisitTs) {
            this.baseUrl.searchParams.set("_viewts", this.lastVisitTs); // last visit ts
        }

        const platform = PlatformPeg.get();
        this._setVisitVariable('App Platform', platform.getHumanReadableName());
        try {
            this._setVisitVariable('App Version', await platform.getAppVersion());
        } catch (e) {
            this._setVisitVariable('App Version', 'unknown');
        }

        this._setVisitVariable('Chosen Language', getCurrentLanguage());

        const hostname = window.location.hostname;
        if (hostname === 'riot.im') {
            this._setVisitVariable('Instance', window.location.pathname);
        } else if (hostname.endsWith('.element.io')) {
            this._setVisitVariable('Instance', hostname.replace('.element.io', ''));
        }

        let installedPWA = "unknown";
        try {
            // Known to work at least for desktop Chrome
            installedPWA = window.matchMedia('(display-mode: standalone)').matches;
        } catch (e) { }
        this._setVisitVariable('Installed PWA', installedPWA);

        let touchInput = "unknown";
        try {
            // MDN claims broad support across browsers
            touchInput = window.matchMedia('(pointer: coarse)').matches;
        } catch (e) { }
        this._setVisitVariable('Touch Input', touchInput);

        // start heartbeat
        this._heartbeatIntervalID = window.setInterval(this.ping.bind(this), HEARTBEAT_INTERVAL);
    }

    /**
     * Disable Analytics, stop the heartbeat and clear identifiers from localStorage
     */
    disable() {
        if (this.disabled) return;
        this.trackEvent('Analytics', 'opt-out');
        window.clearInterval(this._heartbeatIntervalID);
        this.baseUrl = null;
        this.visitVariables = {};
        localStorage.removeItem(UID_KEY);
        localStorage.removeItem(CREATION_TS_KEY);
        localStorage.removeItem(VISIT_COUNT_KEY);
        localStorage.removeItem(LAST_VISIT_TS_KEY);
    }

    async _track(data) {
        if (this.disabled) return;

        const now = new Date();
        const params = {
            ...data,
            url: getRedactedUrl(),

            _cvar: JSON.stringify(this.visitVariables), // user custom vars
            res: `${window.screen.width}x${window.screen.height}`, // resolution as WWWWxHHHH
            rand: String(Math.random()).slice(2, 8), // random nonce to cache-bust
            h: now.getHours(),
            m: now.getMinutes(),
            s: now.getSeconds(),
        };

        const url = new URL(this.baseUrl);
        for (const key in params) {
            url.searchParams.set(key, params[key]);
        }

        try {
            await window.fetch(url, {
                method: "GET",
                mode: "no-cors",
                cache: "no-cache",
                redirect: "follow",
            });
        } catch (e) {
            console.error("Analytics error: ", e);
        }
    }

    ping() {
        this._track({
            ping: 1,
        });
        localStorage.setItem(LAST_VISIT_TS_KEY, new Date().getTime()); // update last visit ts
    }

    trackPageChange(generationTimeMs) {
        if (this.disabled) return;
        if (this.firstPage) {
            // De-duplicate first page
            // router seems to hit the fn twice
            this.firstPage = false;
            return;
        }

        if (typeof generationTimeMs !== 'number') {
            console.warn('Analytics.trackPageChange: expected generationTimeMs to be a number');
            // But continue anyway because we still want to track the change
        }

        this._track({
            gt_ms: generationTimeMs,
        });
    }

    trackEvent(category, action, name, value) {
        if (this.disabled) return;
        this._track({
            e_c: category,
            e_a: action,
            e_n: name,
            e_v: value,
        });
    }

    _setVisitVariable(key, value) {
        if (this.disabled) return;
        this.visitVariables[customVariables[key].id] = [key, value];
    }

    setLoggedIn(isGuest, homeserverUrl, identityServerUrl) {
        if (this.disabled) return;

        const config = SdkConfig.get();
        if (!config.piwik) return;

        const whitelistedHSUrls = config.piwik.whitelistedHSUrls || [];

        this._setVisitVariable('User Type', isGuest ? 'Guest' : 'Logged In');
        this._setVisitVariable('Homeserver URL', whitelistRedact(whitelistedHSUrls, homeserverUrl));
    }

    setBreadcrumbs(state) {
        if (this.disabled) return;
        this._setVisitVariable('Breadcrumbs', state ? 'enabled' : 'disabled');
    }

    showDetailsModal = () => {
        let rows = [];
        if (!this.disabled) {
            rows = Object.values(this.visitVariables);
        } else {
            rows = Object.keys(customVariables).map(
                (k) => [
                    k,
                    _t('e.g. %(exampleValue)s', { exampleValue: customVariables[k].example }),
                ],
            );
        }

        const resolution = `${window.screen.width}x${window.screen.height}`;
        const otherVariables = [
            {
                expl: _td('Every page you use in the app'),
                value: _t(
                    'e.g. <CurrentPageURL>',
                    {},
                    {
                        CurrentPageURL: getRedactedUrl(),
                    },
                ),
            },
            { expl: _td('Your user agent'), value: navigator.userAgent },
            { expl: _td('Your device resolution'), value: resolution },
        ];

        const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
        Modal.createTrackedDialog('Analytics Details', '', ErrorDialog, {
            title: _t('Analytics'),
            description: <div className="mx_AnalyticsModal">
                <div>{_t('The information being sent to us to help make %(brand)s better includes:', {
                    brand: SdkConfig.get().brand,
                })}</div>
                <table>
                    { rows.map((row) => <tr key={row[0]}>
                        <td>{_t(
                            customVariables[row[0]].expl,
                            customVariables[row[0]].getTextVariables ?
                                customVariables[row[0]].getTextVariables() :
                                null,
                        )}</td>
                        { row[1] !== undefined && <td><code>{ row[1] }</code></td> }
                    </tr>) }
                    { otherVariables.map((item, index) =>
                        <tr key={index}>
                            <td>{ _t(item.expl) }</td>
                            <td><code>{ item.value }</code></td>
                        </tr>,
                    ) }
                </table>
                <div>
                    { _t('Where this page includes identifiable information, such as a room, '
                        + 'user or group ID, that data is removed before being sent to the server.') }
                </div>
            </div>,
        });
    };
}

if (!global.mxAnalytics) {
    global.mxAnalytics = new Analytics();
}
export default global.mxAnalytics;
