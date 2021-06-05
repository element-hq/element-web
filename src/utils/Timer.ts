/*
Copyright 2018, 2021 The Matrix.org Foundation C.I.C.

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
    private timerHandle: NodeJS.Timeout;
    private startTs: number;
    private promise: Promise<void>;
    private resolve: () => void;
    private reject: (Error) => void;

    constructor(private timeout: number) {
        this.setNotStarted();
    }

    private setNotStarted() {
        this.timerHandle = null;
        this.startTs = null;
        this.promise = new Promise<void>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        }).finally(() => {
            this.timerHandle = null;
        });
    }

    private onTimeout = () => {
        const now = Date.now();
        const elapsed = now - this.startTs;
        if (elapsed >= this.timeout) {
            this.resolve();
            this.setNotStarted();
        } else {
            const delta = this.timeout - elapsed;
            this.timerHandle = setTimeout(this.onTimeout, delta);
        }
    }

    changeTimeout(timeout: number) {
        if (timeout === this.timeout) {
            return;
        }
        const isSmallerTimeout = timeout < this.timeout;
        this.timeout = timeout;
        if (this.isRunning() && isSmallerTimeout) {
            clearTimeout(this.timerHandle);
            this.onTimeout();
        }
    }

    /**
     * if not started before, starts the timer.
     * @returns {Timer} the same timer
     */
    start() {
        if (!this.isRunning()) {
            this.startTs = Date.now();
            this.timerHandle = setTimeout(this.onTimeout, this.timeout);
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
            this.startTs = Date.now();
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
            clearTimeout(this.timerHandle);
            this.reject(new Error("Timer was aborted."));
            this.setNotStarted();
        }
        return this;
    }

    /**
     *promise that will resolve when the timer elapses,
     *or is rejected when abort is called
     *@return {Promise}
     */
    finished() {
        return this.promise;
    }

    isRunning() {
        return this.timerHandle !== null;
    }
}
