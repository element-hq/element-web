/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type Mocked, type MockedObject } from "jest-mock";
import { HttpApiEvent, type MatrixClient, type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import { decryptExistingEvent, mkDecryptionFailureMatrixEvent } from "matrix-js-sdk/src/testing";
import {
    type CryptoApi,
    DecryptionFailureCode,
    UserVerificationStatus,
    CryptoEvent,
} from "matrix-js-sdk/src/crypto-api";
import { sleep } from "matrix-js-sdk/src/utils";

import { DecryptionFailureTracker, type ErrorProperties } from "../../src/DecryptionFailureTracker";
import { stubClient } from "../test-utils";
import * as Lifecycle from "../../src/Lifecycle";

async function createFailedDecryptionEvent(opts: { sender?: string; code?: DecryptionFailureCode } = {}) {
    return await mkDecryptionFailureMatrixEvent({
        roomId: "!room:id",
        sender: opts.sender ?? "@alice:example.com",
        code: opts.code ?? DecryptionFailureCode.UNKNOWN_ERROR,
        msg: ":(",
    });
}

// wrap tracker.eventDecrypted so that we don't need to have so many `ts-ignore`s
function eventDecrypted(tracker: DecryptionFailureTracker, e: MatrixEvent, nowTs: number): void {
    // @ts-ignore access to private member
    return tracker.eventDecrypted(e, nowTs);
}

describe("DecryptionFailureTracker", function () {
    afterEach(() => {
        localStorage.clear();
    });

    it("tracks a failed decryption for a visible event", async function () {
        const failedDecryptionEvent = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            () => count++,
            () => "UnknownError",
            false,
        );

        tracker.addVisibleEvent(failedDecryptionEvent);
        eventDecrypted(tracker, failedDecryptionEvent, Date.now());

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // should track a failure for an event that failed decryption
        expect(count).not.toBe(0);
    });

    it("tracks a failed decryption with expected raw error for a visible event", async function () {
        const failedDecryptionEvent = await createFailedDecryptionEvent({
            code: DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX,
        });

        let count = 0;
        let reportedRawCode = "";
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (_errCode: string, rawCode: string) => {
                count++;
                reportedRawCode = rawCode;
            },
            () => "UnknownError",
            false,
        );

        tracker.addVisibleEvent(failedDecryptionEvent);
        eventDecrypted(tracker, failedDecryptionEvent, Date.now());

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // should track a failure for an event that failed decryption
        expect(count).not.toBe(0);

        // Should add the rawCode to the event context
        expect(reportedRawCode).toBe("OLM_UNKNOWN_MESSAGE_INDEX");
    });

    it("tracks a failed decryption for an event that becomes visible later", async function () {
        const failedDecryptionEvent = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            () => count++,
            () => "UnknownError",
            false,
        );

        eventDecrypted(tracker, failedDecryptionEvent, Date.now());
        tracker.addVisibleEvent(failedDecryptionEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // should track a failure for an event that failed decryption
        expect(count).not.toBe(0);
    });

    it("tracks visible vs. not visible events", async () => {
        const propertiesByErrorCode: Record<string, ErrorProperties> = {};
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (errorCode: string, rawError: string, properties: ErrorProperties) => {
                propertiesByErrorCode[errorCode] = properties;
            },
            (error: string) => error,
            false,
        );

        // use three different errors so that we can distinguish the reports
        const error1 = DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID;
        const error2 = DecryptionFailureCode.MEGOLM_BAD_ROOM;
        const error3 = DecryptionFailureCode.MEGOLM_MISSING_FIELDS;

        // event that will be marked as visible before it's marked as undecryptable
        const markedVisibleFirst = await createFailedDecryptionEvent({ code: error1 });
        // event that will be marked as undecryptable before it's marked as visible
        const markedUndecryptableFirst = await createFailedDecryptionEvent({ code: error2 });
        // event that is never marked as visible
        const neverVisible = await createFailedDecryptionEvent({ code: error3 });

        tracker.addVisibleEvent(markedVisibleFirst);

        const now = Date.now();
        eventDecrypted(tracker, markedVisibleFirst, now);
        eventDecrypted(tracker, markedUndecryptableFirst, now);
        eventDecrypted(tracker, neverVisible, now);

        tracker.addVisibleEvent(markedUndecryptableFirst);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        expect(propertiesByErrorCode[error1].wasVisibleToUser).toBe(true);
        expect(propertiesByErrorCode[error2].wasVisibleToUser).toBe(true);
        expect(propertiesByErrorCode[error3].wasVisibleToUser).toBe(false);
    });

    it("does not track a failed decryption where the event is subsequently successfully decrypted", async () => {
        const decryptedEvent = await createFailedDecryptionEvent();
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            () => {
                // should not track an event that has since been decrypted correctly
                expect(true).toBe(false);
            },
            () => "UnknownError",
            false,
        );

        tracker.addVisibleEvent(decryptedEvent);
        eventDecrypted(tracker, decryptedEvent, Date.now());

        // Indicate successful decryption.
        await decryptExistingEvent(decryptedEvent, {
            plainType: "m.room.message",
            plainContent: { body: "success" },
        });
        eventDecrypted(tracker, decryptedEvent, Date.now());

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);
    });

    it(
        "does not track a failed decryption where the event is subsequently successfully decrypted " +
            "and later becomes visible",
        async () => {
            const decryptedEvent = await createFailedDecryptionEvent();
            // @ts-ignore access to private constructor
            const tracker = new DecryptionFailureTracker(
                () => {
                    // should not track an event that has since been decrypted correctly
                    expect(true).toBe(false);
                },
                () => "UnknownError",
                false,
            );

            eventDecrypted(tracker, decryptedEvent, Date.now());

            // Indicate successful decryption.
            await decryptExistingEvent(decryptedEvent, {
                plainType: "m.room.message",
                plainContent: { body: "success" },
            });
            eventDecrypted(tracker, decryptedEvent, Date.now());

            tracker.addVisibleEvent(decryptedEvent);

            // Pretend "now" is Infinity
            tracker.checkFailures(Infinity);
        },
    );

    it("only tracks a single failure per event, despite multiple failed decryptions for multiple events", async () => {
        const decryptedEvent = await createFailedDecryptionEvent();
        const decryptedEvent2 = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            () => count++,
            () => "UnknownError",
            false,
        );

        tracker.addVisibleEvent(decryptedEvent);

        // Arbitrary number of failed decryptions for both events
        const now = Date.now();
        eventDecrypted(tracker, decryptedEvent, now);
        eventDecrypted(tracker, decryptedEvent, now);
        eventDecrypted(tracker, decryptedEvent, now);
        eventDecrypted(tracker, decryptedEvent, now);
        eventDecrypted(tracker, decryptedEvent, now);
        eventDecrypted(tracker, decryptedEvent2, now);
        eventDecrypted(tracker, decryptedEvent2, now);
        tracker.addVisibleEvent(decryptedEvent2);
        eventDecrypted(tracker, decryptedEvent2, now);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Simulated polling of `checkFailures`, an arbitrary number ( > 2 ) times
        tracker.checkFailures(Infinity);
        tracker.checkFailures(Infinity);

        // should only track a single failure per event
        expect(count).toBe(2);
    });

    it("should not track a failure for an event that was tracked previously", async () => {
        const decryptedEvent = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            () => count++,
            () => "UnknownError",
        );
        await tracker.start(mockClient());

        tracker.addVisibleEvent(decryptedEvent);

        // Indicate decryption
        eventDecrypted(tracker, decryptedEvent, Date.now());

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Indicate a second decryption, after having tracked the failure
        eventDecrypted(tracker, decryptedEvent, Date.now());
        tracker.checkFailures(Infinity);

        // should only track a single failure per event
        expect(count).toBe(1);
    });

    it("should not report a failure for an event that was reported in a previous session", async () => {
        const decryptedEvent = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            () => count++,
            () => "UnknownError",
        );
        await tracker.start(mockClient());

        tracker.addVisibleEvent(decryptedEvent);

        // Indicate decryption
        eventDecrypted(tracker, decryptedEvent, Date.now());

        // Pretend "now" is Infinity
        // NB: This saves to localStorage specific to DFT
        tracker.checkFailures(Infinity);

        // Simulate the browser refreshing by destroying tracker and creating a new tracker
        // @ts-ignore access to private constructor
        const secondTracker = new DecryptionFailureTracker(
            () => count++,
            () => "UnknownError",
        );
        await secondTracker.start(mockClient());

        secondTracker.addVisibleEvent(decryptedEvent);

        eventDecrypted(secondTracker, decryptedEvent, Date.now());
        secondTracker.checkFailures(Infinity);

        // should only track a single failure per event
        expect(count).toBe(1);
    });

    it("should report a failure for an event that was tracked but not reported in a previous session", async () => {
        const decryptedEvent = await createFailedDecryptionEvent();

        let count = 0;

        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            () => count++,
            () => "UnknownError",
        );
        await tracker.start(mockClient());

        tracker.addVisibleEvent(decryptedEvent);

        // Indicate decryption
        eventDecrypted(tracker, decryptedEvent, Date.now());

        // we do *not* call `checkFailures` here
        expect(count).toBe(0);

        // Simulate the browser refreshing by destroying tracker and creating a new tracker
        // @ts-ignore access to private constructor
        const secondTracker = new DecryptionFailureTracker(
            () => count++,
            () => "UnknownError",
        );
        await secondTracker.start(mockClient());

        secondTracker.addVisibleEvent(decryptedEvent);

        eventDecrypted(secondTracker, decryptedEvent, Date.now());
        secondTracker.checkFailures(Infinity);
        expect(count).toBe(1);
    });

    it("should report a failure for an event that was reported before a logout/login cycle", async () => {
        const decryptedEvent = await createFailedDecryptionEvent();

        let count = 0;

        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            () => count++,
            () => "UnknownError",
        );
        await tracker.start(mockClient());

        tracker.addVisibleEvent(decryptedEvent);

        // Indicate decryption
        eventDecrypted(tracker, decryptedEvent, Date.now());
        tracker.checkFailures(Infinity);
        expect(count).toBe(1);

        // Simulate a logout/login cycle
        await Lifecycle.onLoggedOut();
        await tracker.start(mockClient());

        tracker.addVisibleEvent(decryptedEvent);
        eventDecrypted(tracker, decryptedEvent, Date.now());
        tracker.checkFailures(Infinity);
        expect(count).toBe(2);
    });

    it("should count different error codes separately for multiple failures with different error codes", async () => {
        const counts: Record<string, number> = {};

        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (errorCode: string) => (counts[errorCode] = (counts[errorCode] || 0) + 1),
            (error: DecryptionFailureCode) =>
                error === DecryptionFailureCode.UNKNOWN_ERROR ? "UnknownError" : "OlmKeysNotSentError",
            false,
        );

        const decryptedEvent1 = await createFailedDecryptionEvent({
            code: DecryptionFailureCode.UNKNOWN_ERROR,
        });
        const decryptedEvent2 = await createFailedDecryptionEvent({
            code: DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID,
        });
        const decryptedEvent3 = await createFailedDecryptionEvent({
            code: DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID,
        });

        tracker.addVisibleEvent(decryptedEvent1);
        tracker.addVisibleEvent(decryptedEvent2);
        tracker.addVisibleEvent(decryptedEvent3);

        // One failure of UNKNOWN_ERROR, and effectively two for MEGOLM_UNKNOWN_INBOUND_SESSION_ID
        const now = Date.now();
        eventDecrypted(tracker, decryptedEvent1, now);
        eventDecrypted(tracker, decryptedEvent2, now);
        eventDecrypted(tracker, decryptedEvent2, now);
        eventDecrypted(tracker, decryptedEvent3, now);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        //expect(counts['UnknownError']).toBe(1, 'should track one UnknownError');
        expect(counts["OlmKeysNotSentError"]).toBe(2);
    });

    it("should aggregate error codes correctly", async () => {
        const counts: Record<string, number> = {};

        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (errorCode: string) => (counts[errorCode] = (counts[errorCode] || 0) + 1),
            (_errorCode: string) => "OlmUnspecifiedError",
            false,
        );

        const decryptedEvent1 = await createFailedDecryptionEvent({
            code: DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID,
        });
        const decryptedEvent2 = await createFailedDecryptionEvent({
            code: DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX,
        });
        const decryptedEvent3 = await createFailedDecryptionEvent({
            code: DecryptionFailureCode.UNKNOWN_ERROR,
        });

        tracker.addVisibleEvent(decryptedEvent1);
        tracker.addVisibleEvent(decryptedEvent2);
        tracker.addVisibleEvent(decryptedEvent3);

        const now = Date.now();
        eventDecrypted(tracker, decryptedEvent1, now);
        eventDecrypted(tracker, decryptedEvent2, now);
        eventDecrypted(tracker, decryptedEvent3, now);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        expect(counts["OlmUnspecifiedError"]).toBe(3);
    });

    it("should remap error codes correctly", async () => {
        const counts: Record<string, number> = {};

        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (errorCode: string) => (counts[errorCode] = (counts[errorCode] || 0) + 1),
            (errorCode: string) => Array.from(errorCode).reverse().join(""),
            false,
        );

        const decryptedEvent = await createFailedDecryptionEvent({
            code: DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX,
        });
        tracker.addVisibleEvent(decryptedEvent);
        eventDecrypted(tracker, decryptedEvent, Date.now());

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // should track remapped error code
        expect(counts["XEDNI_EGASSEM_NWONKNU_MLO"]).toBe(1);
    });

    it("default error code mapper maps error codes correctly", async () => {
        const errorCodes: string[] = [];

        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (errorCode: string) => {
                errorCodes.push(errorCode);
            },
            // @ts-ignore access to private member
            DecryptionFailureTracker.instance.errorCodeMapFn,
            false,
        );

        const now = Date.now();

        async function createAndTrackEventWithError(code: DecryptionFailureCode) {
            const event = await createFailedDecryptionEvent({ code });
            tracker.addVisibleEvent(event);
            eventDecrypted(tracker, event, now);
            return event;
        }

        await createAndTrackEventWithError(DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID);
        await createAndTrackEventWithError(DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX);
        await createAndTrackEventWithError(DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP);
        await createAndTrackEventWithError(DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED);
        await createAndTrackEventWithError(DecryptionFailureCode.HISTORICAL_MESSAGE_WORKING_BACKUP);
        await createAndTrackEventWithError(DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED);
        await createAndTrackEventWithError(DecryptionFailureCode.MEGOLM_KEY_WITHHELD);
        await createAndTrackEventWithError(DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE);
        await createAndTrackEventWithError(DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED);
        await createAndTrackEventWithError(DecryptionFailureCode.UNSIGNED_SENDER_DEVICE);
        await createAndTrackEventWithError(DecryptionFailureCode.UNKNOWN_ERROR);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        expect(errorCodes).toEqual([
            "OlmKeysNotSentError",
            "OlmIndexError",
            "HistoricalMessage",
            "HistoricalMessage",
            "HistoricalMessage",
            "ExpectedDueToMembership",
            "OlmKeysNotSentError",
            "RoomKeysWithheldForUnverifiedDevice",
            "ExpectedVerificationViolation",
            "ExpectedSentByInsecureDevice",
            "UnknownError",
        ]);
    });

    it("tracks late decryptions vs. undecryptable", async () => {
        const propertiesByErrorCode: Record<string, ErrorProperties> = {};
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (errorCode: string, rawError: string, properties: ErrorProperties) => {
                propertiesByErrorCode[errorCode] = properties;
            },
            (error: string) => error,
            false,
        );

        // use three different errors so that we can distinguish the reports
        const error1 = DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID;
        const error2 = DecryptionFailureCode.MEGOLM_BAD_ROOM;
        const error3 = DecryptionFailureCode.MEGOLM_MISSING_FIELDS;

        // event that will be slow to decrypt
        const lateDecryption = await createFailedDecryptionEvent({ code: error1 });
        // event that will be so slow to decrypt, it gets counted as undecryptable
        const veryLateDecryption = await createFailedDecryptionEvent({ code: error2 });
        // event that never gets decrypted
        const neverDecrypted = await createFailedDecryptionEvent({ code: error3 });

        tracker.addVisibleEvent(lateDecryption);
        tracker.addVisibleEvent(veryLateDecryption);
        tracker.addVisibleEvent(neverDecrypted);

        const now = Date.now();
        eventDecrypted(tracker, lateDecryption, now);
        eventDecrypted(tracker, veryLateDecryption, now);
        eventDecrypted(tracker, neverDecrypted, now);

        await decryptExistingEvent(lateDecryption, {
            plainType: "m.room.message",
            plainContent: { body: "success" },
        });
        await decryptExistingEvent(veryLateDecryption, {
            plainType: "m.room.message",
            plainContent: { body: "success" },
        });
        eventDecrypted(tracker, lateDecryption, now + 40000);
        eventDecrypted(tracker, veryLateDecryption, now + 100000);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        expect(propertiesByErrorCode[error1].timeToDecryptMillis).toEqual(40000);
        expect(propertiesByErrorCode[error2].timeToDecryptMillis).toEqual(-1);
        expect(propertiesByErrorCode[error3].timeToDecryptMillis).toEqual(-1);
    });

    it("listens for client events", async () => {
        // Test that the decryption failure tracker registers the right event
        // handlers on start, and unregisters them when the client logs out.
        const client = mockClient();

        let errorCount: number = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (errorCode: string, rawError: string, properties: ErrorProperties) => {
                errorCount++;
            },
            (error: string) => error,
            false,
        );

        // Calling .start will start some intervals.  This test shouldn't run
        // long enough for the timers to fire, but we'll use fake timers just
        // to be safe.
        jest.useFakeTimers();
        await tracker.start(client);

        // If the client fails to decrypt, it should get tracked
        const failedDecryption = await createFailedDecryptionEvent();
        client.emit(MatrixEventEvent.Decrypted, failedDecryption);

        tracker.checkFailures(Infinity);

        expect(errorCount).toEqual(1);

        client.emit(HttpApiEvent.SessionLoggedOut, {} as any);

        // After the client has logged out, we shouldn't be listening to events
        // any more, so even if the client emits an event regarding a failed
        // decryption, we won't track it.
        const anotherFailedDecryption = await createFailedDecryptionEvent();
        client.emit(MatrixEventEvent.Decrypted, anotherFailedDecryption);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        expect(errorCount).toEqual(1);

        jest.useRealTimers();
    });

    it("tracks client information", async () => {
        const client = mockClient();
        const propertiesByErrorCode: Record<string, ErrorProperties> = {};
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (errorCode: string, rawError: string, properties: ErrorProperties) => {
                propertiesByErrorCode[errorCode] = properties;
            },
            (error: string) => error,
            false,
        );

        // @ts-ignore access to private method
        await tracker.calculateClientProperties(client);
        // @ts-ignore access to private method
        await tracker.registerHandlers(client);

        // use three different errors so that we can distinguish the reports
        const error1 = DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID;
        const error2 = DecryptionFailureCode.MEGOLM_BAD_ROOM;
        const error3 = DecryptionFailureCode.MEGOLM_MISSING_FIELDS;

        // event from a federated user (@alice:example.com)
        const federatedDecryption = await createFailedDecryptionEvent({
            code: error1,
        });
        // event from a local user
        const localDecryption = await createFailedDecryptionEvent({
            sender: "@bob:matrix.org",
            code: error2,
        });

        tracker.addVisibleEvent(federatedDecryption);
        tracker.addVisibleEvent(localDecryption);

        const now = Date.now();
        eventDecrypted(tracker, federatedDecryption, now);

        mocked(client.getCrypto()!.getUserVerificationStatus).mockResolvedValue(
            new UserVerificationStatus(true, true, false),
        );
        client.emit(CryptoEvent.KeysChanged, {});
        await sleep(100);
        eventDecrypted(tracker, localDecryption, now);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        expect(propertiesByErrorCode[error1].isMatrixDotOrg).toBe(true);
        expect(propertiesByErrorCode[error1].cryptoSDK).toEqual("Rust");

        expect(propertiesByErrorCode[error1].isFederated).toBe(true);
        expect(propertiesByErrorCode[error1].userTrustsOwnIdentity).toEqual(false);
        expect(propertiesByErrorCode[error2].isFederated).toBe(false);
        expect(propertiesByErrorCode[error2].userTrustsOwnIdentity).toEqual(true);

        // change client params, and make sure the reports the right values
        client.getDomain.mockReturnValue("example.com");
        mocked(client.getCrypto()!.getVersion).mockReturnValue("Olm 0.0.0");
        // @ts-ignore access to private method
        await tracker.calculateClientProperties(client);

        const anotherFailure = await createFailedDecryptionEvent({
            code: error3,
        });
        tracker.addVisibleEvent(anotherFailure);
        eventDecrypted(tracker, anotherFailure, now);
        tracker.checkFailures(Infinity);
        expect(propertiesByErrorCode[error3].isMatrixDotOrg).toBe(false);
        expect(propertiesByErrorCode[error3].cryptoSDK).toEqual("Legacy");
    });

    it("keeps the original timestamp after repeated decryption failures", async () => {
        const failedDecryptionEvent = await createFailedDecryptionEvent();

        let failure: ErrorProperties | undefined;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (errorCode: string, rawError: string, properties: ErrorProperties) => {
                failure = properties;
            },
            () => "UnknownError",
            false,
        );

        tracker.addVisibleEvent(failedDecryptionEvent);

        const now = Date.now();
        eventDecrypted(tracker, failedDecryptionEvent, now);
        eventDecrypted(tracker, failedDecryptionEvent, now + 20000);
        await decryptExistingEvent(failedDecryptionEvent, {
            plainType: "m.room.message",
            plainContent: { body: "success" },
        });
        eventDecrypted(tracker, failedDecryptionEvent, now + 50000);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // the time to decrypt should be relative to the first time we failed
        // to decrypt, not the second
        expect(failure?.timeToDecryptMillis).toEqual(50000);
    });
});

function mockClient(): MockedObject<MatrixClient> {
    const client = mocked(stubClient());
    const mockCrypto = {
        getVersion: jest.fn().mockReturnValue("Rust SDK 0.7.0 (61b175b), Vodozemac 0.5.1"),
        getUserVerificationStatus: jest.fn().mockResolvedValue(new UserVerificationStatus(false, false, false)),
    } as unknown as Mocked<CryptoApi>;
    client.getCrypto.mockReturnValue(mockCrypto);

    // @ts-ignore
    client.stopClient = jest.fn(() => {});
    // @ts-ignore
    client.removeAllListeners = jest.fn(() => {});

    client.store = { destroy: jest.fn(() => {}) } as any;

    return client;
}
