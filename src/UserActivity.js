/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 New Vector Ltd

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

import dis from './dispatcher/dispatcher';
import Timer from './utils/Timer';

// important these are larger than the timeouts of timers
// used with UserActivity.timeWhileActive*,
// such as READ_MARKER_INVIEW_THRESHOLD_MS (timeWhileActiveRecently),
// READ_MARKER_OUTOFVIEW_THRESHOLD_MS (timeWhileActiveRecently),
// READ_RECEIPT_INTERVAL_MS (timeWhileActiveNow) in TimelinePanel

// 'Under a few seconds'. Must be less than 'RECENTLY_ACTIVE_THRESHOLD_MS'
const CURRENTLY_ACTIVE_THRESHOLD_MS = 700;

// 'Under a few minutes'.
const RECENTLY_ACTIVE_THRESHOLD_MS = 2 * 60 * 1000;

/**
 * This class watches for user activity (moving the mouse or pressing a key)
 * and starts/stops attached timers while the user is active.
 *
 * There are two classes of 'active': 'active now' and 'active recently'
 * see doc on the userActive* functions for what these mean.
 */
export default class UserActivity {
    constructor(windowObj, documentObj) {
        this._window = windowObj;
        this._document = documentObj;

        this._attachedActiveNowTimers = [];
        this._attachedActiveRecentlyTimers = [];
        this._activeNowTimeout = new Timer(CURRENTLY_ACTIVE_THRESHOLD_MS);
        this._activeRecentlyTimeout = new Timer(RECENTLY_ACTIVE_THRESHOLD_MS);
        this._onUserActivity = this._onUserActivity.bind(this);
        this._onWindowBlurred = this._onWindowBlurred.bind(this);
        this._onPageVisibilityChanged = this._onPageVisibilityChanged.bind(this);
        this.lastScreenX = 0;
        this.lastScreenY = 0;
    }

    static sharedInstance() {
        if (global.mxUserActivity === undefined) {
            global.mxUserActivity = new UserActivity(window, document);
        }
        return global.mxUserActivity;
    }

    /**
     * Runs the given timer while the user is 'active now', aborting when the user is no longer
     * considered currently active.
     * See userActiveNow() for what it means for a user to be 'active'.
     * Can be called multiple times with the same already running timer, which is a NO-OP.
     * Can be called before the user becomes active, in which case it is only started
     * later on when the user does become active.
     * @param {Timer} timer the timer to use
     */
    timeWhileActiveNow(timer) {
        this._timeWhile(timer, this._attachedActiveNowTimers);
        if (this.userActiveNow()) {
            timer.start();
        }
    }

    /**
     * Runs the given timer while the user is 'active' now or recently,
     * aborting when the user becomes inactive.
     * See userActiveRecently() for what it means for a user to be 'active recently'.
     * Can be called multiple times with the same already running timer, which is a NO-OP.
     * Can be called before the user becomes active, in which case it is only started
     * later on when the user does become active.
     * @param {Timer} timer the timer to use
     */
    timeWhileActiveRecently(timer) {
        this._timeWhile(timer, this._attachedActiveRecentlyTimers);
        if (this.userActiveRecently()) {
            timer.start();
        }
    }

    _timeWhile(timer, attachedTimers) {
        // important this happens first
        const index = attachedTimers.indexOf(timer);
        if (index === -1) {
            attachedTimers.push(timer);
            // remove when done or aborted
            timer.finished().finally(() => {
                const index = attachedTimers.indexOf(timer);
                if (index !== -1) { // should never be -1
                    attachedTimers.splice(index, 1);
                }
            // as we fork the promise here,
            // avoid unhandled rejection warnings
            }).catch((err) => {});
        }
    }

    /**
     * Start listening to user activity
     */
    start() {
        this._document.addEventListener('mousedown', this._onUserActivity);
        this._document.addEventListener('mousemove', this._onUserActivity);
        this._document.addEventListener('keydown', this._onUserActivity);
        this._document.addEventListener("visibilitychange", this._onPageVisibilityChanged);
        this._window.addEventListener("blur", this._onWindowBlurred);
        this._window.addEventListener("focus", this._onUserActivity);
        // can't use document.scroll here because that's only the document
        // itself being scrolled. Need to use addEventListener's useCapture.
        // also this needs to be the wheel event, not scroll, as scroll is
        // fired when the view scrolls down for a new message.
        this._window.addEventListener('wheel', this._onUserActivity, {
            passive: true, capture: true,
        });
    }

    /**
     * Stop tracking user activity
     */
    stop() {
        this._document.removeEventListener('mousedown', this._onUserActivity);
        this._document.removeEventListener('mousemove', this._onUserActivity);
        this._document.removeEventListener('keydown', this._onUserActivity);
        this._window.removeEventListener('wheel', this._onUserActivity, {
            passive: true, capture: true,
        });

        this._document.removeEventListener("visibilitychange", this._onPageVisibilityChanged);
        this._window.removeEventListener("blur", this._onWindowBlurred);
        this._window.removeEventListener("focus", this._onUserActivity);
    }

    /**
     * Return true if the user is currently 'active'
     * A user is 'active' while they are interacting with the app and for a very short (<1s)
     * time after that. This is intended to give a strong indication that the app has the
     * user's attention at any given moment.
     * @returns {boolean} true if user is currently 'active'
     */
    userActiveNow() {
        return this._activeNowTimeout.isRunning();
    }

    /**
     * Return true if the user is currently active or has been recently
     * A user is 'active recently' for a longer period of time (~2 mins) after
     * they have been 'active' and while the app still has the focus. This is
     * intended to indicate when the app may still have the user's attention
     * (or they may have gone to make tea and left the window focused).
     * @returns {boolean} true if user has been active recently
     */
    userActiveRecently() {
        return this._activeRecentlyTimeout.isRunning();
    }

    _onPageVisibilityChanged(e) {
        if (this._document.visibilityState === "hidden") {
            this._activeNowTimeout.abort();
            this._activeRecentlyTimeout.abort();
        } else {
            this._onUserActivity(e);
        }
    }

    _onWindowBlurred() {
        this._activeNowTimeout.abort();
        this._activeRecentlyTimeout.abort();
    }

    _onUserActivity(event) {
        // ignore anything if the window isn't focused
        if (!this._document.hasFocus()) return;

        if (event.screenX && event.type === "mousemove") {
            if (event.screenX === this.lastScreenX && event.screenY === this.lastScreenY) {
                // mouse hasn't actually moved
                return;
            }
            this.lastScreenX = event.screenX;
            this.lastScreenY = event.screenY;
        }

        dis.dispatch({action: 'user_activity'});
        if (!this._activeNowTimeout.isRunning()) {
            this._activeNowTimeout.start();
            dis.dispatch({action: 'user_activity_start'});

            this._runTimersUntilTimeout(this._attachedActiveNowTimers, this._activeNowTimeout);
        } else {
            this._activeNowTimeout.restart();
        }

        if (!this._activeRecentlyTimeout.isRunning()) {
            this._activeRecentlyTimeout.start();

            this._runTimersUntilTimeout(this._attachedActiveRecentlyTimers, this._activeRecentlyTimeout);
        } else {
            this._activeRecentlyTimeout.restart();
        }
    }

    async _runTimersUntilTimeout(attachedTimers, timeout) {
        attachedTimers.forEach((t) => t.start());
        try {
            await timeout.finished();
        } catch (_e) { /* aborted */ }
        attachedTimers.forEach((t) => t.abort());
    }
}
