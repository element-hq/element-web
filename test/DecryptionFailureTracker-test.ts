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

import { decryptExistingEvent, mkDecryptionFailureMatrixEvent } from "matrix-js-sdk/src/testing";
import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";

import { DecryptionFailureTracker } from "../src/DecryptionFailureTracker";

async function createFailedDecryptionEvent(code?: DecryptionFailureCode) {
    return await mkDecryptionFailureMatrixEvent({
        roomId: "!room:id",
        sender: "@alice:example.com",
        code: code ?? DecryptionFailureCode.UNKNOWN_ERROR,
        msg: ":(",
    });
}

describe("DecryptionFailureTracker", function () {
    it("tracks a failed decryption for a visible event", async function () {
        const failedDecryptionEvent = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (total: number) => (count += total),
            () => "UnknownError",
        );

        tracker.addVisibleEvent(failedDecryptionEvent);
        tracker.eventDecrypted(failedDecryptionEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Immediately track the newest failures
        tracker.trackFailures();

        // should track a failure for an event that failed decryption
        expect(count).not.toBe(0);
    });

    it("tracks a failed decryption with expected raw error for a visible event", async function () {
        const failedDecryptionEvent = await createFailedDecryptionEvent(
            DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX,
        );

        let count = 0;
        let reportedRawCode = "";
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (total: number, _errCode: string, rawCode: string) => {
                count += total;
                reportedRawCode = rawCode;
            },
            () => "UnknownError",
        );

        tracker.addVisibleEvent(failedDecryptionEvent);
        tracker.eventDecrypted(failedDecryptionEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Immediately track the newest failures
        tracker.trackFailures();

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
            (total: number) => (count += total),
            () => "UnknownError",
        );

        tracker.eventDecrypted(failedDecryptionEvent);
        tracker.addVisibleEvent(failedDecryptionEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Immediately track the newest failures
        tracker.trackFailures();

        // should track a failure for an event that failed decryption
        expect(count).not.toBe(0);
    });

    it("does not track a failed decryption for an event that never becomes visible", async function () {
        const failedDecryptionEvent = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (total: number) => (count += total),
            () => "UnknownError",
        );

        tracker.eventDecrypted(failedDecryptionEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Immediately track the newest failures
        tracker.trackFailures();

        // should not track a failure for an event that never became visible
        expect(count).toBe(0);
    });

    it("does not track a failed decryption where the event is subsequently successfully decrypted", async () => {
        const decryptedEvent = await createFailedDecryptionEvent();
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (_total: number) => {
                // should not track an event that has since been decrypted correctly
                expect(true).toBe(false);
            },
            () => "UnknownError",
        );

        tracker.addVisibleEvent(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);

        // Indicate successful decryption.
        await decryptExistingEvent(decryptedEvent, {
            plainType: "m.room.message",
            plainContent: { body: "success" },
        });
        tracker.eventDecrypted(decryptedEvent, null);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Immediately track the newest failures
        tracker.trackFailures();
    });

    it(
        "does not track a failed decryption where the event is subsequently successfully decrypted " +
            "and later becomes visible",
        async () => {
            const decryptedEvent = await createFailedDecryptionEvent();
            // @ts-ignore access to private constructor
            const tracker = new DecryptionFailureTracker(
                (_total: number) => {
                    // should not track an event that has since been decrypted correctly
                    expect(true).toBe(false);
                },
                () => "UnknownError",
            );

            tracker.eventDecrypted(decryptedEvent);

            // Indicate successful decryption.
            await decryptExistingEvent(decryptedEvent, {
                plainType: "m.room.message",
                plainContent: { body: "success" },
            });
            tracker.eventDecrypted(decryptedEvent);

            tracker.addVisibleEvent(decryptedEvent);

            // Pretend "now" is Infinity
            tracker.checkFailures(Infinity);

            // Immediately track the newest failures
            tracker.trackFailures();
        },
    );

    it("only tracks a single failure per event, despite multiple failed decryptions for multiple events", async () => {
        const decryptedEvent = await createFailedDecryptionEvent();
        const decryptedEvent2 = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (total: number) => (count += total),
            () => "UnknownError",
        );

        tracker.addVisibleEvent(decryptedEvent);

        // Arbitrary number of failed decryptions for both events
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent2);
        tracker.eventDecrypted(decryptedEvent2);
        tracker.addVisibleEvent(decryptedEvent2);
        tracker.eventDecrypted(decryptedEvent2);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Simulated polling of `trackFailures`, an arbitrary number ( > 2 ) times
        tracker.trackFailures();
        tracker.trackFailures();
        tracker.trackFailures();
        tracker.trackFailures();

        // should only track a single failure per event
        expect(count).toBe(2);
    });

    it("should not track a failure for an event that was tracked previously", async () => {
        const decryptedEvent = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (total: number) => (count += total),
            () => "UnknownError",
        );

        tracker.addVisibleEvent(decryptedEvent);

        // Indicate decryption
        tracker.eventDecrypted(decryptedEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        tracker.trackFailures();

        // Indicate a second decryption, after having tracked the failure
        tracker.eventDecrypted(decryptedEvent);

        tracker.trackFailures();

        // should only track a single failure per event
        expect(count).toBe(1);
    });

    it.skip("should not track a failure for an event that was tracked in a previous session", async () => {
        // This test uses localStorage, clear it beforehand
        localStorage.clear();

        const decryptedEvent = await createFailedDecryptionEvent();

        let count = 0;
        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (total: number) => (count += total),
            () => "UnknownError",
        );

        tracker.addVisibleEvent(decryptedEvent);

        // Indicate decryption
        tracker.eventDecrypted(decryptedEvent);

        // Pretend "now" is Infinity
        // NB: This saves to localStorage specific to DFT
        tracker.checkFailures(Infinity);

        tracker.trackFailures();

        // Simulate the browser refreshing by destroying tracker and creating a new tracker
        // @ts-ignore access to private constructor
        const secondTracker = new DecryptionFailureTracker(
            (total: number) => (count += total),
            () => "UnknownError",
        );

        secondTracker.addVisibleEvent(decryptedEvent);

        //secondTracker.loadTrackedEvents();

        secondTracker.eventDecrypted(decryptedEvent);
        secondTracker.checkFailures(Infinity);
        secondTracker.trackFailures();

        // should only track a single failure per event
        expect(count).toBe(1);
    });

    it("should count different error codes separately for multiple failures with different error codes", async () => {
        const counts: Record<string, number> = {};

        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (total: number, errorCode: string) => (counts[errorCode] = (counts[errorCode] || 0) + total),
            (error: DecryptionFailureCode) =>
                error === DecryptionFailureCode.UNKNOWN_ERROR ? "UnknownError" : "OlmKeysNotSentError",
        );

        const decryptedEvent1 = await createFailedDecryptionEvent(DecryptionFailureCode.UNKNOWN_ERROR);
        const decryptedEvent2 = await createFailedDecryptionEvent(
            DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID,
        );
        const decryptedEvent3 = await createFailedDecryptionEvent(
            DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID,
        );

        tracker.addVisibleEvent(decryptedEvent1);
        tracker.addVisibleEvent(decryptedEvent2);
        tracker.addVisibleEvent(decryptedEvent3);

        // One failure of ERROR_CODE_1, and effectively two for ERROR_CODE_2
        tracker.eventDecrypted(decryptedEvent1);
        tracker.eventDecrypted(decryptedEvent2);
        tracker.eventDecrypted(decryptedEvent2);
        tracker.eventDecrypted(decryptedEvent3);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        tracker.trackFailures();

        //expect(counts['UnknownError']).toBe(1, 'should track one UnknownError');
        expect(counts["OlmKeysNotSentError"]).toBe(2);
    });

    it("should aggregate error codes correctly", async () => {
        const counts: Record<string, number> = {};

        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (total: number, errorCode: string) => (counts[errorCode] = (counts[errorCode] || 0) + total),
            (_errorCode: string) => "OlmUnspecifiedError",
        );

        const decryptedEvent1 = await createFailedDecryptionEvent(
            DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID,
        );
        const decryptedEvent2 = await createFailedDecryptionEvent(DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX);
        const decryptedEvent3 = await createFailedDecryptionEvent(DecryptionFailureCode.UNKNOWN_ERROR);

        tracker.addVisibleEvent(decryptedEvent1);
        tracker.addVisibleEvent(decryptedEvent2);
        tracker.addVisibleEvent(decryptedEvent3);

        tracker.eventDecrypted(decryptedEvent1);
        tracker.eventDecrypted(decryptedEvent2);
        tracker.eventDecrypted(decryptedEvent3);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        tracker.trackFailures();

        expect(counts["OlmUnspecifiedError"]).toBe(3);
    });

    it("should remap error codes correctly", async () => {
        const counts: Record<string, number> = {};

        // @ts-ignore access to private constructor
        const tracker = new DecryptionFailureTracker(
            (total: number, errorCode: string) => (counts[errorCode] = (counts[errorCode] || 0) + total),
            (errorCode: string) => Array.from(errorCode).reverse().join(""),
        );

        const decryptedEvent = await createFailedDecryptionEvent(DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX);
        tracker.addVisibleEvent(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        tracker.trackFailures();

        // should track remapped error code
        expect(counts["XEDNI_EGASSEM_NWONKNU_MLO"]).toBe(1);
    });
});
