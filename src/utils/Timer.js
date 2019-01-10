/*
Copyright 2018 New Vector Ltd

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

/**
A countdown timer, exposing a promise api.
A timer starts in a non-started state,
and needs to be started by calling `start()`` on it first.

Timers can be `abort()`-ed which makes the promise reject prematurely.

Once a timer is finished or aborted, it can't be started again
(because the promise should not be replaced). Instead, create
a new one through `clone()` or `cloneIfRun()`.
*/
export default class Timer {
    constructor(timeout) {
        this._timeout = timeout;
        this._onTimeout = this._onTimeout.bind(this);
        this._setNotStarted();
    }

    _setNotStarted() {
        this._timerHandle = null;
        this._startTs = null;
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        }).finally(() => {
            this._timerHandle = null;
        });
    }

    _onTimeout() {
        const now = Date.now();
        const elapsed = now - this._startTs;
        if (elapsed >= this._timeout) {
            this._resolve();
            this._setNotStarted();
        } else {
            const delta = this._timeout - elapsed;
            this._timerHandle = setTimeout(this._onTimeout, delta);
        }
    }

    changeTimeout(timeout) {
        if (timeout === this._timeout) {
            return;
        }
        const isSmallerTimeout = timeout < this._timeout;
        this._timeout = timeout;
        if (this.isRunning() && isSmallerTimeout) {
            clearTimeout(this._timerHandle);
            this._onTimeout();
        }
    }

    /**
     * if not started before, starts the timer.
     * @returns {Timer} the same timer
     */
    start() {
        if (!this.isRunning()) {
            this._startTs = Date.now();
            this._timerHandle = setTimeout(this._onTimeout, this._timeout);
        }
        return this;
    }

    /**
     * (re)start the timer. If it's running, reset the timeout. If not, start it.
     * @returns {Timer} the same timer
     */
    restart() {
        if (this.isRunning()) {
            // don't clearTimeout here as this method
            // can be called in fast succession,
            // instead just take note and compare
            // when the already running timeout expires
            this._startTs = Date.now();
            return this;
        } else {
            return this.start();
        }
    }

    /**
     * if the timer is running, abort it,
     * and reject the promise for this timer.
     * @returns {Timer} the same timer
     */
    abort() {
        if (this.isRunning()) {
            clearTimeout(this._timerHandle);
            this._reject(new Error("Timer was aborted."));
            this._setNotStarted();
        }
        return this;
    }

    /**
     *promise that will resolve when the timer elapses,
     *or is rejected when abort is called
     *@return {Promise}
     */
    finished() {
        return this._promise;
    }

    isRunning() {
        return this._timerHandle !== null;
    }
}
