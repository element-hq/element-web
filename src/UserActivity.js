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

var MIN_DISPATCH_INTERVAL = 1 * 1000;

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
        document.onmousemove = this._onUserActivity.bind(this);
        document.onkeypress = this._onUserActivity.bind(this);
        this.lastActivityAtTs = new Date().getTime();
        this.lastDispatchAtTs = 0;
    }

    /**
     * Stop tracking user activity
     */
    stop() {
        document.onmousemove = undefined;
        document.onkeypress = undefined;
    }

    _onUserActivity(event) {
        if (event.screenX) {
            if (event.screenX === this.lastScreenX &&
                event.screenY === this.lastScreenY)
            {
                // mouse hasn't actually moved
                return;
            }
            this.lastScreenX = event.screenX;
            this.lastScreenY = event.screenY;
        }

        this.lastActivityAtTs = (new Date).getTime();
        if (this.lastDispatchAtTs < this.lastActivityAtTs - MIN_DISPATCH_INTERVAL) {
            this.lastDispatchAtTs = this.lastActivityAtTs;
            dis.dispatch({
                action: 'user_activity'
            });
        }
    }
}

module.exports = new UserActivity();
