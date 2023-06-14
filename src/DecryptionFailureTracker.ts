/*
Copyright 2018 - 2021 The Matrix.org Foundation C.I.C.

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

import { DecryptionError } from "matrix-js-sdk/src/crypto/algorithms";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Error as ErrorEvent } from "@matrix-org/analytics-events/types/typescript/Error";

import { PosthogAnalytics } from "./PosthogAnalytics";

export class DecryptionFailure {
    public readonly ts: number;

    public constructor(public readonly failedEventId: string, public readonly errorCode: string) {
        this.ts = Date.now();
    }
}

type ErrorCode = "OlmKeysNotSentError" | "OlmIndexError" | "UnknownError" | "OlmUnspecifiedError";

type TrackingFn = (count: number, trackedErrCode: ErrorCode, rawError: string) => void;

export type ErrCodeMapFn = (errcode: string) => ErrorCode;

export class DecryptionFailureTracker {
    private static internalInstance = new DecryptionFailureTracker(
        (total, errorCode, rawError) => {
            for (let i = 0; i < total; i++) {
                PosthogAnalytics.instance.trackEvent<ErrorEvent>({
                    eventName: "Error",
                    domain: "E2EE",
                    name: errorCode,
                    context: `mxc_crypto_error_type_${rawError}`,
                });
            }
        },
        (errorCode) => {
            // Map JS-SDK error codes to tracker codes for aggregation
            switch (errorCode) {
                case "MEGOLM_UNKNOWN_INBOUND_SESSION_ID":
                    return "OlmKeysNotSentError";
                case "OLM_UNKNOWN_MESSAGE_INDEX":
                    return "OlmIndexError";
                case undefined:
                    return "OlmUnspecifiedError";
                default:
                    return "UnknownError";
            }
        },
    );

    // Map of event IDs to DecryptionFailure items.
    public failures: Map<string, DecryptionFailure> = new Map();

    // Set of event IDs that have been visible to the user.
    public visibleEvents: Set<string> = new Set();

    // Map of visible event IDs to `DecryptionFailure`s. Every
    // `CHECK_INTERVAL_MS`, this map is checked for failures that
    // happened > `GRACE_PERIOD_MS` ago. Those that did are
    // accumulated in `failureCounts`.
    public visibleFailures: Map<string, DecryptionFailure> = new Map();

    // A histogram of the number of failures that will be tracked at the next tracking
    // interval, split by failure error code.
    public failureCounts: Record<string, number> = {
        // [errorCode]: 42
    };

    // Event IDs of failures that were tracked previously
    public trackedEvents: Set<string> = new Set();

    // Set to an interval ID when `start` is called
    public checkInterval: number | null = null;
    public trackInterval: number | null = null;

    // Spread the load on `Analytics` by tracking at a low frequency, `TRACK_INTERVAL_MS`.
    public static TRACK_INTERVAL_MS = 60000;

    // Call `checkFailures` every `CHECK_INTERVAL_MS`.
    public static CHECK_INTERVAL_MS = 5000;

    // Give events a chance to be decrypted by waiting `GRACE_PERIOD_MS` before counting
    // the failure in `failureCounts`.
    public static GRACE_PERIOD_MS = 4000;

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
    private constructor(private readonly fn: TrackingFn, private readonly errorCodeMapFn: ErrCodeMapFn) {
        if (!fn || typeof fn !== "function") {
            throw new Error("DecryptionFailureTracker requires tracking function");
        }

        if (typeof errorCodeMapFn !== "function") {
            throw new Error("DecryptionFailureTracker second constructor argument should be a function");
        }
    }

    public static get instance(): DecryptionFailureTracker {
        return DecryptionFailureTracker.internalInstance;
    }

    // loadTrackedEvents() {
    //     this.trackedEvents = new Set(JSON.parse(localStorage.getItem('mx-decryption-failure-event-ids')) || []);
    // }

    // saveTrackedEvents() {
    //     localStorage.setItem('mx-decryption-failure-event-ids', JSON.stringify([...this.trackedEvents]));
    // }

    public eventDecrypted(e: MatrixEvent, err: DecryptionError): void {
        // for now we only track megolm decrytion failures
        if (e.getWireContent().algorithm != "m.megolm.v1.aes-sha2") {
            return;
        }
        if (err) {
            this.addDecryptionFailure(new DecryptionFailure(e.getId()!, err.code));
        } else {
            // Could be an event in the failures, remove it
            this.removeDecryptionFailuresForEvent(e);
        }
    }

    public addVisibleEvent(e: MatrixEvent): void {
        const eventId = e.getId()!;

        if (this.trackedEvents.has(eventId)) {
            return;
        }

        this.visibleEvents.add(eventId);
        if (this.failures.has(eventId) && !this.visibleFailures.has(eventId)) {
            this.visibleFailures.set(eventId, this.failures.get(eventId)!);
        }
    }

    public addDecryptionFailure(failure: DecryptionFailure): void {
        const eventId = failure.failedEventId;

        if (this.trackedEvents.has(eventId)) {
            return;
        }

        this.failures.set(eventId, failure);
        if (this.visibleEvents.has(eventId) && !this.visibleFailures.has(eventId)) {
            this.visibleFailures.set(eventId, failure);
        }
    }

    public removeDecryptionFailuresForEvent(e: MatrixEvent): void {
        const eventId = e.getId()!;
        this.failures.delete(eventId);
        this.visibleFailures.delete(eventId);
    }

    /**
     * Start checking for and tracking failures.
     */
    public start(): void {
        this.checkInterval = window.setInterval(
            () => this.checkFailures(Date.now()),
            DecryptionFailureTracker.CHECK_INTERVAL_MS,
        );

        this.trackInterval = window.setInterval(() => this.trackFailures(), DecryptionFailureTracker.TRACK_INTERVAL_MS);
    }

    /**
     * Clear state and stop checking for and tracking failures.
     */
    public stop(): void {
        if (this.checkInterval) clearInterval(this.checkInterval);
        if (this.trackInterval) clearInterval(this.trackInterval);

        this.failures = new Map();
        this.visibleEvents = new Set();
        this.visibleFailures = new Map();
        this.failureCounts = {};
    }

    /**
     * Mark failures that occurred before nowTs - GRACE_PERIOD_MS as failures that should be
     * tracked. Only mark one failure per event ID.
     * @param {number} nowTs the timestamp that represents the time now.
     */
    public checkFailures(nowTs: number): void {
        const failuresGivenGrace: Set<DecryptionFailure> = new Set();
        const failuresNotReady: Map<string, DecryptionFailure> = new Map();
        for (const [eventId, failure] of this.visibleFailures) {
            if (nowTs > failure.ts + DecryptionFailureTracker.GRACE_PERIOD_MS) {
                failuresGivenGrace.add(failure);
                this.trackedEvents.add(eventId);
            } else {
                failuresNotReady.set(eventId, failure);
            }
        }
        this.visibleFailures = failuresNotReady;

        // Commented out for now for expediency, we need to consider unbound nature of storing
        // this in localStorage
        // this.saveTrackedEvents();

        this.aggregateFailures(failuresGivenGrace);
    }

    private aggregateFailures(failures: Set<DecryptionFailure>): void {
        for (const failure of failures) {
            const errorCode = failure.errorCode;
            this.failureCounts[errorCode] = (this.failureCounts[errorCode] || 0) + 1;
        }
    }

    /**
     * If there are failures that should be tracked, call the given trackDecryptionFailure
     * function with the number of failures that should be tracked.
     */
    public trackFailures(): void {
        for (const errorCode of Object.keys(this.failureCounts)) {
            if (this.failureCounts[errorCode] > 0) {
                const trackedErrorCode = this.errorCodeMapFn(errorCode);

                this.fn(this.failureCounts[errorCode], trackedErrorCode, errorCode);
                this.failureCounts[errorCode] = 0;
            }
        }
    }
}
