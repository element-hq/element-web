/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import ScalableBloomFilter from "bloom-filters/dist/bloom/scalable-bloom-filter";
import { HttpApiEvent, type MatrixClient, MatrixEventEvent, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type Error as ErrorEvent } from "@matrix-org/analytics-events/types/typescript/Error";
import { DecryptionFailureCode, CryptoEvent } from "matrix-js-sdk/src/crypto-api";

import { PosthogAnalytics } from "./PosthogAnalytics";
import { MEGOLM_ENCRYPTION_ALGORITHM } from "./utils/crypto";

/** The key that we use to store the `reportedEvents` bloom filter in localstorage */
const DECRYPTION_FAILURE_STORAGE_KEY = "mx_decryption_failure_event_ids";

export class DecryptionFailure {
    /**
     * The time between our initial failure to decrypt and our successful
     * decryption (if we managed to decrypt).
     */
    public timeToDecryptMillis?: number;

    public constructor(
        public readonly failedEventId: string,
        public readonly errorCode: DecryptionFailureCode,
        /**
         * The time that we failed to decrypt the event.  If we failed to decrypt
         * multiple times, this will be the time of the first failure.
         */
        public readonly ts: number,
        /**
         * Is the sender on a different server from us?
         */
        public readonly isFederated: boolean | undefined,
        /**
         * Was the failed event ever visible to the user?
         */
        public wasVisibleToUser: boolean,
        /**
         * Has the user verified their own cross-signing identity, as of the most
         * recent decryption attempt for this event?
         */
        public userTrustsOwnIdentity: boolean | undefined,
    ) {}
}

type ErrorCode = ErrorEvent["name"];
/** Properties associated with decryption errors, for classifying the error. */
export type ErrorProperties = Omit<ErrorEvent, "eventName" | "domain" | "name" | "context">;
type TrackingFn = (trackedErrCode: ErrorCode, rawError: string, properties: ErrorProperties) => void;
export type ErrCodeMapFn = (errcode: DecryptionFailureCode) => ErrorCode;

export class DecryptionFailureTracker {
    private static internalInstance = new DecryptionFailureTracker(
        (errorCode, rawError, properties) => {
            const event: ErrorEvent = {
                eventName: "Error",
                domain: "E2EE",
                name: errorCode,
                context: `mxc_crypto_error_type_${rawError}`,
                ...properties,
            };
            PosthogAnalytics.instance.trackEvent<ErrorEvent>(event);
        },
        (errorCode) => {
            // Map JS-SDK error codes to tracker codes for aggregation
            switch (errorCode) {
                case DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID:
                case DecryptionFailureCode.MEGOLM_KEY_WITHHELD:
                    return "OlmKeysNotSentError";
                case DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE:
                    return "RoomKeysWithheldForUnverifiedDevice";
                case DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX:
                    return "OlmIndexError";
                case DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP:
                case DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED:
                case DecryptionFailureCode.HISTORICAL_MESSAGE_WORKING_BACKUP:
                    return "HistoricalMessage";
                case DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED:
                    return "ExpectedDueToMembership";
                case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
                    return "ExpectedVerificationViolation";
                case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                    return "ExpectedSentByInsecureDevice";
                default:
                    return "UnknownError";
            }
        },
    );

    /** Map of event IDs to `DecryptionFailure` items.
     *
     * Every `CHECK_INTERVAL_MS`, this map is checked for failures that happened >
     * `MAXIMUM_LATE_DECRYPTION_PERIOD` ago (considered undecryptable), or
     * decryptions that took > `GRACE_PERIOD_MS` (considered late decryptions).
     *
     * Any such events are then reported via the `TrackingFn`.
     */
    public failures: Map<string, DecryptionFailure> = new Map();

    /** Set of event IDs that have been visible to the user.
     *
     * This will only contain events that are not already in `reportedEvents`.
     */
    public visibleEvents: Set<string> = new Set();

    /** Bloom filter tracking event IDs of failures that were reported previously */
    private reportedEvents: ScalableBloomFilter = new ScalableBloomFilter();

    /** Set to an interval ID when `start` is called */
    public checkInterval: number | null = null;
    public trackInterval: number | null = null;

    /** Call `checkFailures` every `CHECK_INTERVAL_MS`. */
    public static CHECK_INTERVAL_MS = 40000;

    /** If the event is successfully decrypted in less than 4s, we don't report. */
    public static GRACE_PERIOD_MS = 4000;

    /** Maximum time for an event to be decrypted to be considered a late
     * decryption.  If it takes longer, we consider it undecryptable. */
    public static MAXIMUM_LATE_DECRYPTION_PERIOD = 60000;

    /** Properties that will be added to all reported events (mainly reporting
     * information about the Matrix client). */
    private baseProperties?: ErrorProperties = {};

    /** The user's domain (homeserver name). */
    private userDomain?: string;

    /** Whether the user has verified their own cross-signing keys. */
    private userTrustsOwnIdentity: boolean | undefined = undefined;

    /** Whether we are currently checking our own verification status. */
    private checkingVerificationStatus: boolean = false;

    /** Whether we should retry checking our own verification status after we're
     * done our current check. i.e. we got notified that our keys changed while
     * we were already checking, so the result could be out of date. */
    private retryVerificationStatus: boolean = false;

    /**
     * Create a new DecryptionFailureTracker.
     *
     * Call `start(client)` to start the tracker.  The tracker will listen for
     * decryption events on the client and track decryption failures, and will
     * automatically stop tracking when the client logs out.
     *
     * @param {function} fn The tracking function, which will be called when failures
     * are tracked. The function should have a signature `(trackedErrorCode, rawError, properties) => {...}`,
     * where `errorCode` matches the output of `errorCodeMapFn`, `rawError` is the original
     * error (that is, the input to `errorCodeMapFn`), and `properties` is a map of the
     * error properties for classifying the error.
     *
     * @param {function} errorCodeMapFn The function used to map decryption failure reason  codes to the
     * `trackedErrorCode`.
     *
     * @param {boolean} checkReportedEvents Check if we have already reported an event.
     * Defaults to `true`. This is only used for tests, to avoid possible false positives from
     * the Bloom filter. This should be set to `false` for all tests except for those
     * that specifically test the `reportedEvents` functionality.
     */
    private constructor(
        private readonly fn: TrackingFn,
        private readonly errorCodeMapFn: ErrCodeMapFn,
        private readonly checkReportedEvents: boolean = true,
    ) {
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

    private loadReportedEvents(): void {
        const storedFailures = localStorage.getItem(DECRYPTION_FAILURE_STORAGE_KEY);
        if (storedFailures) {
            this.reportedEvents = ScalableBloomFilter.fromJSON(JSON.parse(storedFailures));
        } else {
            this.reportedEvents = new ScalableBloomFilter();
        }
    }

    private saveReportedEvents(): void {
        localStorage.setItem(DECRYPTION_FAILURE_STORAGE_KEY, JSON.stringify(this.reportedEvents.saveAsJSON()));
    }

    /** Callback for when an event is decrypted.
     *
     * This function is called by our `MatrixEventEvent.Decrypted` event
     * handler after a decryption attempt on an event, whether the decryption
     * is successful or not.
     *
     * @param e the event that was decrypted
     *
     * @param nowTs the current timestamp
     */
    private eventDecrypted(e: MatrixEvent, nowTs: number): void {
        // for now we only track megolm decryption failures
        if (e.getWireContent().algorithm != MEGOLM_ENCRYPTION_ALGORITHM) {
            return;
        }
        const errCode = e.decryptionFailureReason;
        if (errCode === null) {
            // Could be an event in the failures, remove it
            this.removeDecryptionFailuresForEvent(e, nowTs);
            return;
        }

        const eventId = e.getId()!;

        // if it's already reported, we don't need to do anything
        if (this.reportedEvents.has(eventId) && this.checkReportedEvents) {
            return;
        }

        // if we already have a record of this event, use the previously-recorded timestamp
        const failure = this.failures.get(eventId);
        const ts = failure ? failure.ts : nowTs;

        const sender = e.getSender();
        const senderDomain = sender?.replace(/^.*?:/, "");
        let isFederated: boolean | undefined;
        if (this.userDomain !== undefined && senderDomain !== undefined) {
            isFederated = this.userDomain !== senderDomain;
        }

        const wasVisibleToUser = this.visibleEvents.has(eventId);
        this.failures.set(
            eventId,
            new DecryptionFailure(eventId, errCode, ts, isFederated, wasVisibleToUser, this.userTrustsOwnIdentity),
        );
    }

    public addVisibleEvent(e: MatrixEvent): void {
        const eventId = e.getId()!;

        // if it's already reported, we don't need to do anything
        if (this.reportedEvents.has(eventId) && this.checkReportedEvents) {
            return;
        }

        // if we've already marked the event as a failure, mark it as visible
        // in the failure object
        const failure = this.failures.get(eventId);
        if (failure) {
            failure.wasVisibleToUser = true;
        }

        this.visibleEvents.add(eventId);
    }

    public removeDecryptionFailuresForEvent(e: MatrixEvent, nowTs: number): void {
        const eventId = e.getId()!;
        const failure = this.failures.get(eventId);
        if (failure) {
            this.failures.delete(eventId);

            const timeToDecryptMillis = nowTs - failure.ts;
            if (timeToDecryptMillis < DecryptionFailureTracker.GRACE_PERIOD_MS) {
                // the event decrypted on time, so we don't need to report it
                return;
            } else if (timeToDecryptMillis <= DecryptionFailureTracker.MAXIMUM_LATE_DECRYPTION_PERIOD) {
                // The event is a late decryption, so store the time it took.
                // If the time to decrypt is longer than
                // MAXIMUM_LATE_DECRYPTION_PERIOD, we consider the event as
                // undecryptable, and leave timeToDecryptMillis undefined
                failure.timeToDecryptMillis = timeToDecryptMillis;
            }
            this.reportFailure(failure);
        }
    }

    private async handleKeysChanged(client: MatrixClient): Promise<void> {
        if (this.checkingVerificationStatus) {
            // Flag that we'll need to do another check once the current check completes.
            this.retryVerificationStatus = true;
            return;
        }

        this.checkingVerificationStatus = true;
        try {
            do {
                this.retryVerificationStatus = false;
                this.userTrustsOwnIdentity = (
                    await client.getCrypto()!.getUserVerificationStatus(client.getUserId()!)
                ).isCrossSigningVerified();
            } while (this.retryVerificationStatus);
        } finally {
            this.checkingVerificationStatus = false;
        }
    }

    /**
     * Start checking for and tracking failures.
     */
    public async start(client: MatrixClient): Promise<void> {
        this.loadReportedEvents();
        await this.calculateClientProperties(client);
        this.registerHandlers(client);
        this.checkInterval = window.setInterval(
            () => this.checkFailures(Date.now()),
            DecryptionFailureTracker.CHECK_INTERVAL_MS,
        );
    }

    private async calculateClientProperties(client: MatrixClient): Promise<void> {
        const baseProperties: ErrorProperties = {};
        this.baseProperties = baseProperties;

        this.userDomain = client.getDomain() ?? undefined;
        if (this.userDomain === "matrix.org") {
            baseProperties.isMatrixDotOrg = true;
        } else if (this.userDomain !== undefined) {
            baseProperties.isMatrixDotOrg = false;
        }

        const crypto = client.getCrypto();
        if (crypto) {
            const version = crypto.getVersion();
            if (version.startsWith("Rust SDK")) {
                baseProperties.cryptoSDK = "Rust";
            } else {
                baseProperties.cryptoSDK = "Legacy";
            }
            this.userTrustsOwnIdentity = (
                await crypto.getUserVerificationStatus(client.getUserId()!)
            ).isCrossSigningVerified();
        }
    }

    private registerHandlers(client: MatrixClient): void {
        // After the client attempts to decrypt an event, we examine it to see
        // if it needs to be reported.
        const decryptedHandler = (e: MatrixEvent): void => this.eventDecrypted(e, Date.now());
        // When our keys change, we check if the cross-signing keys are now trusted.
        const keysChangedHandler = (): void => {
            this.handleKeysChanged(client).catch((e) => {
                console.log("Error handling KeysChanged event", e);
            });
        };
        // When logging out, remove our handlers and destroy state
        const loggedOutHandler = (): void => {
            client.removeListener(MatrixEventEvent.Decrypted, decryptedHandler);
            client.removeListener(CryptoEvent.KeysChanged, keysChangedHandler);
            client.removeListener(HttpApiEvent.SessionLoggedOut, loggedOutHandler);
            this.stop();
        };

        client.on(MatrixEventEvent.Decrypted, decryptedHandler);
        client.on(CryptoEvent.KeysChanged, keysChangedHandler);
        client.on(HttpApiEvent.SessionLoggedOut, loggedOutHandler);
    }

    /**
     * Clear state and stop checking for and tracking failures.
     */
    private stop(): void {
        if (this.checkInterval) clearInterval(this.checkInterval);
        if (this.trackInterval) clearInterval(this.trackInterval);

        this.userTrustsOwnIdentity = undefined;
        this.failures = new Map();
        this.visibleEvents = new Set();
    }

    /**
     * Mark failures as undecryptable or late. Only mark one failure per event ID.
     *
     * @param {number} nowTs the timestamp that represents the time now.
     */
    public checkFailures(nowTs: number): void {
        const failuresNotReady: Map<string, DecryptionFailure> = new Map();
        for (const [eventId, failure] of this.failures) {
            if (
                failure.timeToDecryptMillis !== undefined ||
                nowTs > failure.ts + DecryptionFailureTracker.MAXIMUM_LATE_DECRYPTION_PERIOD
            ) {
                // we report failures under two conditions:
                // - if `timeToDecryptMillis` is set, we successfully decrypted
                //   the event, but we got the key late.  We report it so that we
                //   have the late decrytion stats.
                // - we haven't decrypted yet and it's past the time for it to be
                //   considered a "late" decryption, so we count it as
                //   undecryptable.
                this.reportFailure(failure);
            } else {
                // the event isn't old enough, so we still need to keep track of it
                failuresNotReady.set(eventId, failure);
            }
        }
        this.failures = failuresNotReady;

        this.saveReportedEvents();
    }

    /**
     * If there are failures that should be tracked, call the given trackDecryptionFailure
     * function with the failures that should be tracked.
     */
    private reportFailure(failure: DecryptionFailure): void {
        const errorCode = failure.errorCode;
        const trackedErrorCode = this.errorCodeMapFn(errorCode);
        const properties: ErrorProperties = {
            timeToDecryptMillis: failure.timeToDecryptMillis ?? -1,
            wasVisibleToUser: failure.wasVisibleToUser,
        };
        if (failure.isFederated !== undefined) {
            properties.isFederated = failure.isFederated;
        }
        if (failure.userTrustsOwnIdentity !== undefined) {
            properties.userTrustsOwnIdentity = failure.userTrustsOwnIdentity;
        }
        if (this.baseProperties) {
            Object.assign(properties, this.baseProperties);
        }
        this.fn(trackedErrorCode, errorCode, properties);

        this.reportedEvents.add(failure.failedEventId);
        // once we've added it to reportedEvents, we won't check
        // visibleEvents for it any more
        this.visibleEvents.delete(failure.failedEventId);
    }
}
