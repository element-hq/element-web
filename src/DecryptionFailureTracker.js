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

export class DecryptionFailure {
    constructor(failedEventId, errorCode) {
        this.failedEventId = failedEventId;
        this.errorCode = errorCode;
        this.ts = Date.now();
    }
}

export class DecryptionFailureTracker {
    // Array of items of type DecryptionFailure. Every `CHECK_INTERVAL_MS`, this list
    // is checked for failures that happened > `GRACE_PERIOD_MS` ago. Those that did
    // are accumulated in `failureCounts`.
    failures = [];

    // A histogram of the number of failures that will be tracked at the next tracking
    // interval, split by failure error code.
    failureCounts = {
        // [errorCode]: 42
    };

    // Event IDs of failures that were tracked previously
    trackedEventHashMap = {
        // [eventId]: true
    };

    // Set to an interval ID when `start` is called
    checkInterval = null;
    trackInterval = null;

    // Spread the load on `Analytics` by tracking at a low frequency, `TRACK_INTERVAL_MS`.
    static TRACK_INTERVAL_MS = 60000;

    // Call `checkFailures` every `CHECK_INTERVAL_MS`.
    static CHECK_INTERVAL_MS = 5000;

    // Give events a chance to be decrypted by waiting `GRACE_PERIOD_MS` before counting
    // the failure in `failureCounts`.
    static GRACE_PERIOD_MS = 60000;

    /**
     * Create a new DecryptionFailureTracker.
     *
     * Call `eventDecrypted(event, err)` on this instance when an event is decrypted.
     *
     * Call `start()` to start the tracker, and `stop()` to stop tracking.
     *
     * @param {function} fn The tracking function, which will be called when failures
     * are tracked. The function should have a signature `(count, trackedErrorCode) => {...}`,
     * where `count` is the number of failures and `errorCode` matches the `.code` of
     * provided DecryptionError errors (by default, unless `errorCodeMapFn` is specified.
     * @param {function?} errorCodeMapFn The function used to map error codes to the
     * trackedErrorCode. If not provided, the `.code` of errors will be used.
     */
    constructor(fn, errorCodeMapFn) {
        if (!fn || typeof fn !== 'function') {
            throw new Error('DecryptionFailureTracker requires tracking function');
        }

        if (errorCodeMapFn && typeof errorCodeMapFn !== 'function') {
            throw new Error('DecryptionFailureTracker second constructor argument should be a function');
        }

        this._trackDecryptionFailure = fn;
        this._mapErrorCode = errorCodeMapFn;
    }

    // loadTrackedEventHashMap() {
    //     this.trackedEventHashMap = JSON.parse(localStorage.getItem('mx-decryption-failure-event-id-hashes')) || {};
    // }

    // saveTrackedEventHashMap() {
    //     localStorage.setItem('mx-decryption-failure-event-id-hashes', JSON.stringify(this.trackedEventHashMap));
    // }

    eventDecrypted(e, err) {
        if (err) {
            this.addDecryptionFailure(new DecryptionFailure(e.getId(), err.code));
        } else {
            // Could be an event in the failures, remove it
            this.removeDecryptionFailuresForEvent(e);
        }
    }

    addDecryptionFailure(failure) {
        this.failures.push(failure);
    }

    removeDecryptionFailuresForEvent(e) {
        this.failures = this.failures.filter((f) => f.failedEventId !== e.getId());
    }

    /**
     * Start checking for and tracking failures.
     */
    start() {
        this.checkInterval = setInterval(
            () => this.checkFailures(Date.now()),
            DecryptionFailureTracker.CHECK_INTERVAL_MS,
        );

        this.trackInterval = setInterval(
            () => this.trackFailures(),
            DecryptionFailureTracker.TRACK_INTERVAL_MS,
        );
    }

    /**
     * Clear state and stop checking for and tracking failures.
     */
    stop() {
        clearInterval(this.checkInterval);
        clearInterval(this.trackInterval);

        this.failures = [];
        this.failureCounts = {};
    }

    /**
     * Mark failures that occured before nowTs - GRACE_PERIOD_MS as failures that should be
     * tracked. Only mark one failure per event ID.
     * @param {number} nowTs the timestamp that represents the time now.
     */
    checkFailures(nowTs) {
        const failuresGivenGrace = [];
        const failuresNotReady = [];
        while (this.failures.length > 0) {
            const f = this.failures.shift();
            if (nowTs > f.ts + DecryptionFailureTracker.GRACE_PERIOD_MS) {
                failuresGivenGrace.push(f);
            } else {
                failuresNotReady.push(f);
            }
        }
        this.failures = failuresNotReady;

        // Only track one failure per event
        const dedupedFailuresMap = failuresGivenGrace.reduce(
            (map, failure) => {
                if (!this.trackedEventHashMap[failure.failedEventId]) {
                    return map.set(failure.failedEventId, failure);
                } else {
                    return map;
                }
            },
            // Use a map to preseve key ordering
            new Map(),
        );

        const trackedEventIds = [...dedupedFailuresMap.keys()];

        this.trackedEventHashMap = trackedEventIds.reduce(
            (result, eventId) => ({...result, [eventId]: true}),
            this.trackedEventHashMap,
        );

        // Commented out for now for expediency, we need to consider unbound nature of storing
        // this in localStorage
        // this.saveTrackedEventHashMap();

        const dedupedFailures = dedupedFailuresMap.values();

        this._aggregateFailures(dedupedFailures);
    }

    _aggregateFailures(failures) {
        for (const failure of failures) {
            const errorCode = failure.errorCode;
            this.failureCounts[errorCode] = (this.failureCounts[errorCode] || 0) + 1;
        }
    }

    /**
     * If there are failures that should be tracked, call the given trackDecryptionFailure
     * function with the number of failures that should be tracked.
     */
    trackFailures() {
        for (const errorCode of Object.keys(this.failureCounts)) {
            if (this.failureCounts[errorCode] > 0) {
                const trackedErrorCode = this._mapErrorCode ? this._mapErrorCode(errorCode) : errorCode;

                this._trackDecryptionFailure(this.failureCounts[errorCode], trackedErrorCode);
                this.failureCounts[errorCode] = 0;
            }
        }
    }
}
