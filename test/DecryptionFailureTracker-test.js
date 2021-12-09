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

import { MatrixEvent } from 'matrix-js-sdk';

import { DecryptionFailure, DecryptionFailureTracker } from '../src/DecryptionFailureTracker';

class MockDecryptionError extends Error {
    constructor(code) {
        super();

        this.code = code || 'MOCK_DECRYPTION_ERROR';
    }
}

function createFailedDecryptionEvent() {
    const event = new MatrixEvent({
        event_id: "event-id-" + Math.random().toString(16).slice(2),
    });
    event.setClearData(event.badEncryptedMessage(":("));
    return event;
}

describe('DecryptionFailureTracker', function() {
    it('tracks a failed decryption', function(done) {
        const failedDecryptionEvent = createFailedDecryptionEvent();

        let count = 0;
        const tracker = new DecryptionFailureTracker((total) => count += total, () => "UnknownError");

        const err = new MockDecryptionError();
        tracker.eventDecrypted(failedDecryptionEvent, err);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Immediately track the newest failures
        tracker.trackFailures();

        expect(count).not.toBe(0, 'should track a failure for an event that failed decryption');

        done();
    });

    it('does not track a failed decryption where the event is subsequently successfully decrypted', (done) => {
        const decryptedEvent = createFailedDecryptionEvent();
        const tracker = new DecryptionFailureTracker((total) => {
            expect(true).toBe(false, 'should not track an event that has since been decrypted correctly');
        }, () => "UnknownError");

        const err = new MockDecryptionError();
        tracker.eventDecrypted(decryptedEvent, err);

        // Indicate successful decryption: clear data can be anything where the msgtype is not m.bad.encrypted
        decryptedEvent.setClearData({});
        tracker.eventDecrypted(decryptedEvent, null);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Immediately track the newest failures
        tracker.trackFailures();
        done();
    });

    it('only tracks a single failure per event, despite multiple failed decryptions for multiple events', (done) => {
        const decryptedEvent = createFailedDecryptionEvent();
        const decryptedEvent2 = createFailedDecryptionEvent();

        let count = 0;
        const tracker = new DecryptionFailureTracker((total) => count += total, () => "UnknownError");

        // Arbitrary number of failed decryptions for both events
        const err = new MockDecryptionError();
        tracker.eventDecrypted(decryptedEvent, err);
        tracker.eventDecrypted(decryptedEvent, err);
        tracker.eventDecrypted(decryptedEvent, err);
        tracker.eventDecrypted(decryptedEvent, err);
        tracker.eventDecrypted(decryptedEvent, err);
        tracker.eventDecrypted(decryptedEvent2, err);
        tracker.eventDecrypted(decryptedEvent2, err);
        tracker.eventDecrypted(decryptedEvent2, err);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Simulated polling of `trackFailures`, an arbitrary number ( > 2 ) times
        tracker.trackFailures();
        tracker.trackFailures();
        tracker.trackFailures();
        tracker.trackFailures();

        expect(count).toBe(2, count + ' failures tracked, should only track a single failure per event');

        done();
    });

    it('should not track a failure for an event that was tracked previously', (done) => {
        const decryptedEvent = createFailedDecryptionEvent();

        let count = 0;
        const tracker = new DecryptionFailureTracker((total) => count += total, () => "UnknownError");

        // Indicate decryption
        const err = new MockDecryptionError();
        tracker.eventDecrypted(decryptedEvent, err);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        tracker.trackFailures();

        // Indicate a second decryption, after having tracked the failure
        tracker.eventDecrypted(decryptedEvent, err);

        tracker.trackFailures();

        expect(count).toBe(1, 'should only track a single failure per event');

        done();
    });

    xit('should not track a failure for an event that was tracked in a previous session', (done) => {
        // This test uses localStorage, clear it beforehand
        localStorage.clear();

        const decryptedEvent = createFailedDecryptionEvent();

        let count = 0;
        const tracker = new DecryptionFailureTracker((total) => count += total, () => "UnknownError");

        // Indicate decryption
        const err = new MockDecryptionError();
        tracker.eventDecrypted(decryptedEvent, err);

        // Pretend "now" is Infinity
        // NB: This saves to localStorage specific to DFT
        tracker.checkFailures(Infinity);

        tracker.trackFailures();

        // Simulate the browser refreshing by destroying tracker and creating a new tracker
        const secondTracker = new DecryptionFailureTracker((total) => count += total, () => "UnknownError");

        //secondTracker.loadTrackedEventHashMap();

        secondTracker.eventDecrypted(decryptedEvent, err);
        secondTracker.checkFailures(Infinity);
        secondTracker.trackFailures();

        expect(count).toBe(1, count + ' failures tracked, should only track a single failure per event');

        done();
    });

    it('should count different error codes separately for multiple failures with different error codes', () => {
        const counts = {};
        const tracker = new DecryptionFailureTracker(
            (total, errorCode) => counts[errorCode] = (counts[errorCode] || 0) + total,
            (error) => error === "UnknownError" ? "UnknownError" : "OlmKeysNotSentError",
        );

        // One failure of ERROR_CODE_1, and effectively two for ERROR_CODE_2
        tracker.addDecryptionFailure(new DecryptionFailure('$event_id1', 'UnknownError'));
        tracker.addDecryptionFailure(new DecryptionFailure('$event_id2', 'OlmKeysNotSentError'));
        tracker.addDecryptionFailure(new DecryptionFailure('$event_id2', 'OlmKeysNotSentError'));
        tracker.addDecryptionFailure(new DecryptionFailure('$event_id3', 'OlmKeysNotSentError'));

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        tracker.trackFailures();

        expect(counts['UnknownError']).toBe(1, 'should track one UnknownError');
        expect(counts['OlmKeysNotSentError']).toBe(2, 'should track two OlmKeysNotSentError');
    });

    it('should map error codes correctly', () => {
        const counts = {};
        const tracker = new DecryptionFailureTracker(
            (total, errorCode) => counts[errorCode] = (counts[errorCode] || 0) + total,
            (errorCode) => 'OlmUnspecifiedError',
        );

        // One failure of ERROR_CODE_1, and effectively two for ERROR_CODE_2
        tracker.addDecryptionFailure(new DecryptionFailure('$event_id1', 'ERROR_CODE_1'));
        tracker.addDecryptionFailure(new DecryptionFailure('$event_id2', 'ERROR_CODE_2'));
        tracker.addDecryptionFailure(new DecryptionFailure('$event_id3', 'ERROR_CODE_3'));

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        tracker.trackFailures();

        expect(counts['OlmUnspecifiedError'])
            .toBe(3, 'should track three OlmUnspecifiedError, got ' + counts['OlmUnspecifiedError']);
    });
});
