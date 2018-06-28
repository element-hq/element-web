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

class DecryptionFailure {
    constructor(failedEventId) {
        this.failedEventId = failedEventId;
        this.ts = Date.now();
    }
}

export default class DecryptionFailureTracker {
    // Array of items of type DecryptionFailure. Every `CHECK_INTERVAL_MS`, this list
    // is checked for failures that happened > `GRACE_PERIOD_MS` ago. Those that did
    // are added to `failuresToTrack`.
    failures = [];

    // Every TRACK_INTERVAL_MS (so as to spread the number of hits done on Analytics),
    // one DecryptionFailure of this FIFO is removed and tracked.
    failuresToTrack = [];

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

    // Give events a chance to be decrypted by waiting `GRACE_PERIOD_MS` before moving
    // the failure to `failuresToTrack`.
    static GRACE_PERIOD_MS = 60000;

    constructor(fn) {
        if (!fn || typeof fn !== 'function') {
            throw new Error('DecryptionFailureTracker requires tracking function');
        }

        this.trackDecryptionFailure = fn;
    }

    // loadTrackedEventHashMap() {
    //     this.trackedEventHashMap = JSON.parse(localStorage.getItem('mx-decryption-failure-event-id-hashes')) || {};
    // }

    // saveTrackedEventHashMap() {
    //     localStorage.setItem('mx-decryption-failure-event-id-hashes', JSON.stringify(this.trackedEventHashMap));
    // }

    eventDecrypted(e) {
        if (e.isDecryptionFailure()) {
            this.addDecryptionFailureForEvent(e);
        } else {
            // Could be an event in the failures, remove it
            this.removeDecryptionFailuresForEvent(e);
        }
    }

    addDecryptionFailureForEvent(e) {
        this.failures.push(new DecryptionFailure(e.getId()));
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
            () => this.trackFailure(),
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
        this.failuresToTrack = [];
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

        this.failuresToTrack = [...this.failuresToTrack, ...dedupedFailures];
    }

    /**
     * If there is a failure that should be tracked, call the given trackDecryptionFailure
     * function with the first failure in the FIFO of failures that should be tracked.
     */
    trackFailure() {
        if (this.failuresToTrack.length > 0) {
            // Remove all failures, and expose the number of failures
            this.trackDecryptionFailure(this.failuresToTrack.splice(0).length);
        }
    }
}
