/*
Copyright 2017 New Vector Ltd
Copyright 2019 The Matrix.org Foundaction C.I.C.

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

import { logger } from "../../src/logger";
import { MatrixEvent } from "../../src/models/event";

describe("MatrixEvent", () => {
    describe(".attemptDecryption", () => {
        let encryptedEvent;

        beforeEach(() => {
            encryptedEvent = new MatrixEvent({
                id: 'test_encrypted_event',
                type: 'm.room.encrypted',
                content: {
                    ciphertext: 'secrets',
                },
            });
        });

        it('should retry decryption if a retry is queued', () => {
            let callCount = 0;

            let prom2;
            let prom2Fulfilled = false;

            const crypto = {
                decryptEvent: function() {
                    ++callCount;
                    logger.log(`decrypt: ${callCount}`);
                    if (callCount == 1) {
                        // schedule a second decryption attempt while
                        // the first one is still running.
                        prom2 = encryptedEvent.attemptDecryption(crypto);
                        prom2.then(() => prom2Fulfilled = true);

                        const error = new Error("nope");
                        error.name = 'DecryptionError';
                        return Promise.reject(error);
                    } else {
                        expect(prom2Fulfilled).toBe(
                            false, 'second attemptDecryption resolved too soon');

                        return Promise.resolve({
                            clearEvent: {
                                type: 'm.room.message',
                            },
                        });
                    }
                },
            };

            return encryptedEvent.attemptDecryption(crypto).then(() => {
                expect(callCount).toEqual(2);
                expect(encryptedEvent.getType()).toEqual('m.room.message');

                // make sure the second attemptDecryption resolves
                return prom2;
            });
        });
    });
});
