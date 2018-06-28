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

import expect from 'expect';

import DecryptionFailureTracker from '../src/DecryptionFailureTracker';

import { MatrixEvent } from 'matrix-js-sdk';

function createFailedDecryptionEvent() {
    const event = new MatrixEvent({
        event_id: "event-id-" + Math.random().toString(16).slice(2),
    });
    event._setClearData(
        event._badEncryptedMessage(":("),
    );
    return event;
}

describe('DecryptionFailureTracker', function() {
    it('tracks a failed decryption', function(done) {
        const failedDecryptionEvent = createFailedDecryptionEvent();

        let count = 0;
        const tracker = new DecryptionFailureTracker((total) => count += total);

        tracker.eventDecrypted(failedDecryptionEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Immediately track the newest failure, if there is one
        tracker.trackFailure();

        expect(count).toNotBe(0, 'should track a failure for an event that failed decryption');

        done();
    });

    it('does not track a failed decryption where the event is subsequently successfully decrypted', (done) => {
        const decryptedEvent = createFailedDecryptionEvent();
        const tracker = new DecryptionFailureTracker((total) => {
            expect(true).toBe(false, 'should not track an event that has since been decrypted correctly');
        });

        tracker.eventDecrypted(decryptedEvent);

        // Indicate successful decryption: clear data can be anything where the msgtype is not m.bad.encrypted
        decryptedEvent._setClearData({});
        tracker.eventDecrypted(decryptedEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Immediately track the newest failure, if there is one
        tracker.trackFailure();
        done();
    });

    it('only tracks a single failure per event, despite multiple failed decryptions for multiple events', (done) => {
        const decryptedEvent = createFailedDecryptionEvent();
        const decryptedEvent2 = createFailedDecryptionEvent();

        let count = 0;
        const tracker = new DecryptionFailureTracker((total) => count += total);

        // Arbitrary number of failed decryptions for both events
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent);
        tracker.eventDecrypted(decryptedEvent2);
        tracker.eventDecrypted(decryptedEvent2);
        tracker.eventDecrypted(decryptedEvent2);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        // Simulated polling of `trackFailure`, an arbitrary number ( > 2 ) times
        tracker.trackFailure();
        tracker.trackFailure();
        tracker.trackFailure();
        tracker.trackFailure();

        expect(count).toBe(2, count + ' failures tracked, should only track a single failure per event');

        done();
    });

    it('should not track a failure for an event that was tracked previously', (done) => {
        const decryptedEvent = createFailedDecryptionEvent();

        let count = 0;
        const tracker = new DecryptionFailureTracker((total) => count += total);

        // Indicate decryption
        tracker.eventDecrypted(decryptedEvent);

        // Pretend "now" is Infinity
        tracker.checkFailures(Infinity);

        tracker.trackFailure();

        // Indicate a second decryption, after having tracked the failure
        tracker.eventDecrypted(decryptedEvent);

        tracker.trackFailure();

        expect(count).toBe(1, 'should only track a single failure per event');

        done();
    });

    xit('should not track a failure for an event that was tracked in a previous session', (done) => {
        // This test uses localStorage, clear it beforehand
        localStorage.clear();

        const decryptedEvent = createFailedDecryptionEvent();

        let count = 0;
        const tracker = new DecryptionFailureTracker((total) => count += total);

        // Indicate decryption
        tracker.eventDecrypted(decryptedEvent);

        // Pretend "now" is Infinity
        // NB: This saves to localStorage specific to DFT
        tracker.checkFailures(Infinity);

        tracker.trackFailure();

        // Simulate the browser refreshing by destroying tracker and creating a new tracker
        const secondTracker = new DecryptionFailureTracker((total) => count += total);

        //secondTracker.loadTrackedEventHashMap();

        secondTracker.eventDecrypted(decryptedEvent);
        secondTracker.checkFailures(Infinity);
        secondTracker.trackFailure();

        expect(count).toBe(1, count + ' failures tracked, should only track a single failure per event');

        done();
    });
});
