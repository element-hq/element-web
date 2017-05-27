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

/*
 * Holds the current Platform object used by the code to do anything
 * specific to the platform we're running on (eg. web, electron)
 * Platforms are provided by the app layer.
 * This allows the app layer to set a Platform without necessarily
 * having to have a MatrixChat object
 */

import MatrixClientPeg from './MatrixClientPeg';
// import dis from './dispatcher';

function redact(str) {
    return str.replace(/#\/(room|user)\/(.+)/, "#/$1/<redacted>");
}

class Analytics {
    constructor() {
        this.tracker = null;
    }

    set(tracker) {
        this.tracker = tracker;

        this.tracker.enableHeartBeatTimer();
        this.tracker.enableLinkTracking(true);

        // dis.register(this._onAction.bind(this));
    }

    // _onAction(payload) {
    //     this.trackEvent('Dispatcher', payload.action);
    // }

    async trackPageChange() {
        if (!this.tracker) return;
        this.tracker.trackPageView(redact(window.location.hash));
    }

    async trackEvent(category, action, name) {
        if (!this.tracker) return;
        this.tracker.trackEvent(category, action, name);
    }

    async logout() {
        if (!this.tracker) return;
        this.tracker.deleteCookies();
    }

    async login() { // not used currently
        const cli = MatrixClientPeg.get();
        if (!this.tracker || !cli) return;

        this.tracker.setUserId(`@${cli.getUserIdLocalpart()}:${cli.getDomain()}`);
    }

}

if (!global.mxAnalytics) {
    global.mxAnalytics = new Analytics();
}
module.exports = global.mxAnalytics;
