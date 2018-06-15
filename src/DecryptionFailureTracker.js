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

    // Spread the load on `Analytics` by sending at most 1 event per
    // `TRACK_INTERVAL_MS`.
    static TRACK_INTERVAL_MS = 1000;

    // Call `checkFailures` every `CHECK_INTERVAL_MS`.
    static CHECK_INTERVAL_MS = 5000;

    // Give events a chance to be decrypted by waiting `GRACE_PERIOD_MS` before moving
    // the failure to `failuresToTrack`.
    static GRACE_PERIOD_MS = 5000;

    constructor(fn) {
        if (!fn || typeof fn !== 'function') {
            throw new Error('DecryptionFailureTracker requires tracking function');
        }

        this.trackDecryptionFailure = fn;
    }

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
     * @return {function} a function that clears state and causes DFT to stop checking for
     * and tracking failures.
     */
    start() {
        const checkInterval = setInterval(
            () => this.checkFailures(Date.now()),
            DecryptionFailureTracker.CHECK_INTERVAL_MS,
        );

        const trackInterval = setInterval(
            () => this.trackFailure(),
            DecryptionFailureTracker.TRACK_INTERVAL_MS,
        );

        return () => {
            clearInterval(checkInterval);
            clearInterval(trackInterval);

            this.failures = [];
            this.failuresToTrack = [];
        };
    }

    /**
     * Mark failures that occured before nowTs - GRACE_PERIOD_MS as failures that should be
     * tracked. Only mark one failure per event ID.
     * @param {number} nowTs the timestamp that represents the time now.
     */
    checkFailures(nowTs) {
        const failuresGivenGrace = this.failures.filter(
            (f) => nowTs > f.ts + DecryptionFailureTracker.GRACE_PERIOD_MS,
        );

        // Only track one failure per event
        const dedupedFailuresMap = failuresGivenGrace.reduce(
            (result, failure) => ({...result, [failure.failedEventId]: failure}),
            {},
        );
        const dedupedFailures = Object.keys(dedupedFailuresMap).map((k) => dedupedFailuresMap[k]);

        this.failuresToTrack = [...this.failuresToTrack, ...dedupedFailures];
    }

    /**
     * If there is a failure that should be tracked, call the given trackDecryptionFailure
     * function with the first failure in the FIFO of failures that should be tracked.
     */
    trackFailure() {
        if (this.failuresToTrack.length > 0) {
            this.trackDecryptionFailure(this.failuresToTrack.shift());
        }
    }
}
