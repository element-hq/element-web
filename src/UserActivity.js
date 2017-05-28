/*
Copyright 2015, 2016 OpenMarket Ltd

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

var dis = require("./dispatcher");

var MIN_DISPATCH_INTERVAL_MS = 500;
var CURRENTLY_ACTIVE_THRESHOLD_MS = 2000;

/**
 * This class watches for user activity (moving the mouse or pressing a key)
 * and dispatches the user_activity action at times when the user is interacting
 * with the app (but at a much lower frequency than mouse move events)
 */
class UserActivity {

    /**
     * Start listening to user activity
     */
    start() {
        document.onmousedown = this._onUserActivity.bind(this);
        document.onmousemove = this._onUserActivity.bind(this);
        document.onkeydown = this._onUserActivity.bind(this);
        // can't use document.scroll here because that's only the document
        // itself being scrolled. Need to use addEventListener's useCapture.
        // also this needs to be the wheel event, not scroll, as scroll is
        // fired when the view scrolls down for a new message.
        window.addEventListener('wheel', this._onUserActivity.bind(this),
                                { passive: true, capture: true });
        this.lastActivityAtTs = new Date().getTime();
        this.lastDispatchAtTs = 0;
        this.activityEndTimer = undefined;
    }

    /**
     * Stop tracking user activity
     */
    stop() {
        document.onmousedown = undefined;
        document.onmousemove = undefined;
        document.onkeydown = undefined;
        window.removeEventListener('wheel', this._onUserActivity.bind(this),
                                   { passive: true, capture: true });
    }

    /**
     * Return true if there has been user activity very recently
     * (ie. within a few seconds)
     */
    userCurrentlyActive() {
        return this.lastActivityAtTs > new Date().getTime() - CURRENTLY_ACTIVE_THRESHOLD_MS;
    }

    _onUserActivity(event) {
        if (event.screenX && event.type == "mousemove") {
            if (event.screenX === this.lastScreenX &&
                event.screenY === this.lastScreenY)
            {
                // mouse hasn't actually moved
                return;
            }
            this.lastScreenX = event.screenX;
            this.lastScreenY = event.screenY;
        }

        this.lastActivityAtTs = new Date().getTime();
        if (this.lastDispatchAtTs < this.lastActivityAtTs - MIN_DISPATCH_INTERVAL_MS) {
            this.lastDispatchAtTs = this.lastActivityAtTs;
            dis.dispatch({
                action: 'user_activity'
            });
            if (!this.activityEndTimer) {
                this.activityEndTimer = setTimeout(
                    this._onActivityEndTimer.bind(this), MIN_DISPATCH_INTERVAL_MS
                );
            }
        }
    }

    _onActivityEndTimer() {
        var now = new Date().getTime();
        var targetTime = this.lastActivityAtTs + MIN_DISPATCH_INTERVAL_MS;
        if (now >= targetTime) {
            dis.dispatch({
                action: 'user_activity_end'
            });
            this.activityEndTimer = undefined;
        } else {
            this.activityEndTimer = setTimeout(
                this._onActivityEndTimer.bind(this), targetTime - now
            );
        }
    }
}

module.exports = new UserActivity();
