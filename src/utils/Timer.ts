/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { IDeferred, defer } from "matrix-js-sdk/src/utils";

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
    private timerHandle?: number;
    private startTs?: number;
    private deferred!: IDeferred<void>;

    public constructor(private timeout: number) {
        this.setNotStarted();
    }

    private setNotStarted(): void {
        this.timerHandle = undefined;
        this.startTs = undefined;
        this.deferred = defer();
        this.deferred.promise = this.deferred.promise.finally(() => {
            this.timerHandle = undefined;
        });
    }

    private onTimeout = (): void => {
        const now = Date.now();
        const elapsed = now - this.startTs!;
        if (elapsed >= this.timeout) {
            this.deferred.resolve();
            this.setNotStarted();
        } else {
            const delta = this.timeout - elapsed;
            this.timerHandle = window.setTimeout(this.onTimeout, delta);
        }
    };

    public changeTimeout(timeout: number): void {
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
    public start(): Timer {
        if (!this.isRunning()) {
            this.startTs = Date.now();
            this.timerHandle = window.setTimeout(this.onTimeout, this.timeout);
        }
        return this;
    }

    /**
     * (re)start the timer. If it's running, reset the timeout. If not, start it.
     * @returns {Timer} the same timer
     */
    public restart(): Timer {
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
    public abort(): Timer {
        if (this.isRunning()) {
            clearTimeout(this.timerHandle);
            this.deferred.reject(new Error("Timer was aborted."));
            this.setNotStarted();
        }
        return this;
    }

    /**
     *promise that will resolve when the timer elapses,
     *or is rejected when abort is called
     *@return {Promise}
     */
    public finished(): Promise<void> {
        return this.deferred.promise;
    }

    public isRunning(): boolean {
        return this.timerHandle !== undefined;
    }
}
