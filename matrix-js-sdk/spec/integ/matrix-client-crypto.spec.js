/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

/* This file consists of a set of integration tests which try to simulate
 * communication via an Olm-encrypted room between two users, Alice and Bob.
 *
 * Note that megolm (group) conversation is not tested here.
 *
 * See also `megolm.spec.js`.
 */

// load olm before the sdk if possible
import '../olm-loader';

import { logger } from '../../src/logger';
import * as testUtils from "../test-utils";
import { TestClient } from "../TestClient";
import { CRYPTO_ENABLED } from "../../src/client";

let aliTestClient;
const roomId = "!room:localhost";
const aliUserId = "@ali:localhost";
const aliDeviceId = "zxcvb";
const aliAccessToken = "aseukfgwef";
let bobTestClient;
const bobUserId = "@bob:localhost";
const bobDeviceId = "bvcxz";
const bobAccessToken = "fewgfkuesa";
let aliMessages;
let bobMessages;

function bobUploadsDeviceKeys() {
    bobTestClient.expectDeviceKeyUpload();
    return Promise.all([
        bobTestClient.client.uploadKeys(),
        bobTestClient.httpBackend.flush(),
    ]).then(() => {
        expect(Object.keys(bobTestClient.deviceKeys).length).not.toEqual(0);
    });
}

/**
 * Set an expectation that ali will query bobs keys; then flush the http request.
 *
 * @return {promise} resolves once the http request has completed.
 */
function expectAliQueryKeys() {
    // can't query keys before bob has uploaded them
    expect(bobTestClient.deviceKeys).toBeTruthy();

    const bobKeys = {};
    bobKeys[bobDeviceId] = bobTestClient.deviceKeys;
    aliTestClient.httpBackend.when("POST", "/keys/query")
            .respond(200, function(path, content) {
        expect(content.device_keys[bobUserId]).toEqual(
            [],
            "Expected Alice to key query for " + bobUserId + ", got " +
            Object.keys(content.device_keys),
        );
        const result = {};
        result[bobUserId] = bobKeys;
        return { device_keys: result };
    });
    return aliTestClient.httpBackend.flush("/keys/query", 1);
}

/**
 * Set an expectation that bob will query alis keys; then flush the http request.
 *
 * @return {promise} which resolves once the http request has completed.
 */
function expectBobQueryKeys() {
    // can't query keys before ali has uploaded them
    expect(aliTestClient.deviceKeys).toBeTruthy();

    const aliKeys = {};
    aliKeys[aliDeviceId] = aliTestClient.deviceKeys;
    logger.log("query result will be", aliKeys);

    bobTestClient.httpBackend.when(
        "POST", "/keys/query",
    ).respond(200, function(path, content) {
        expect(content.device_keys[aliUserId]).toEqual(
            [],
            "Expected Bob to key query for " + aliUserId + ", got " +
            Object.keys(content.device_keys),
        );
        const result = {};
        result[aliUserId] = aliKeys;
        return { device_keys: result };
    });
    return bobTestClient.httpBackend.flush("/keys/query", 1);
}

/**
 * Set an expectation that ali will claim one of bob's keys; then flush the http request.
 *
 * @return {promise} resolves once the http request has completed.
 */
function expectAliClaimKeys() {
    return bobTestClient.awaitOneTimeKeyUpload().then((keys) => {
        aliTestClient.httpBackend.when(
            "POST", "/keys/claim",
        ).respond(200, function(path, content) {
            const claimType = content.one_time_keys[bobUserId][bobDeviceId];
            expect(claimType).toEqual("signed_curve25519");
            let keyId = null;
            for (keyId in keys) {
                if (bobTestClient.oneTimeKeys.hasOwnProperty(keyId)) {
                    if (keyId.indexOf(claimType + ":") === 0) {
                        break;
                    }
                }
            }
            const result = {};
            result[bobUserId] = {};
            result[bobUserId][bobDeviceId] = {};
            result[bobUserId][bobDeviceId][keyId] = keys[keyId];
            return { one_time_keys: result };
        });
    }).then(() => {
        // it can take a while to process the key query, so give it some extra
        // time, and make sure the claim actually happens rather than ploughing on
        // confusingly.
        return aliTestClient.httpBackend.flush("/keys/claim", 1, 500).then((r) => {
            expect(r).toEqual(1, "Ali did not claim Bob's keys");
        });
    });
}

function aliDownloadsKeys() {
    // can't query keys before bob has uploaded them
    expect(bobTestClient.getSigningKey()).toBeTruthy();

    const p1 = aliTestClient.client.downloadKeys([bobUserId]).then(function() {
        return aliTestClient.client.getStoredDevicesForUser(bobUserId);
    }).then((devices) => {
        expect(devices.length).toEqual(1);
        expect(devices[0].deviceId).toEqual("bvcxz");
    });
    const p2 = expectAliQueryKeys();

    // check that the localStorage is updated as we expect (not sure this is
    // an integration test, but meh)
    return Promise.all([p1, p2]).then(() => {
        return aliTestClient.client.crypto.deviceList.saveIfDirty();
    }).then(() => {
        aliTestClient.cryptoStore.getEndToEndDeviceData(null, (data) => {
            const devices = data.devices[bobUserId];
            expect(devices[bobDeviceId].keys).toEqual(bobTestClient.deviceKeys.keys);
            expect(devices[bobDeviceId].verified).
                toBe(0); // DeviceVerification.UNVERIFIED
        });
    });
}

function aliEnablesEncryption() {
    return aliTestClient.client.setRoomEncryption(roomId, {
        algorithm: "m.olm.v1.curve25519-aes-sha2",
    }).then(function() {
        expect(aliTestClient.client.isRoomEncrypted(roomId)).toBeTruthy();
    });
}

function bobEnablesEncryption() {
    return bobTestClient.client.setRoomEncryption(roomId, {
        algorithm: "m.olm.v1.curve25519-aes-sha2",
    }).then(function() {
       expect(bobTestClient.client.isRoomEncrypted(roomId)).toBeTruthy();
    });
}

/**
 * Ali sends a message, first claiming e2e keys. Set the expectations and
 * check the results.
 *
 * @return {promise} which resolves to the ciphertext for Bob's device.
 */
function aliSendsFirstMessage() {
    return Promise.all([
        sendMessage(aliTestClient.client),
        expectAliQueryKeys()
            .then(expectAliClaimKeys)
            .then(expectAliSendMessageRequest),
    ]).then(function([_, ciphertext]) {
        return ciphertext;
    });
}

/**
 * Ali sends a message without first claiming e2e keys. Set the expectations
 * and check the results.
 *
 * @return {promise} which resolves to the ciphertext for Bob's device.
 */
function aliSendsMessage() {
    return Promise.all([
        sendMessage(aliTestClient.client),
        expectAliSendMessageRequest(),
    ]).then(function([_, ciphertext]) {
        return ciphertext;
    });
}

/**
 * Bob sends a message, first querying (but not claiming) e2e keys. Set the
 * expectations and check the results.
 *
 * @return {promise} which resolves to the ciphertext for Ali's device.
 */
function bobSendsReplyMessage() {
    return Promise.all([
        sendMessage(bobTestClient.client),
        expectBobQueryKeys()
            .then(expectBobSendMessageRequest),
    ]).then(function([_, ciphertext]) {
        return ciphertext;
    });
}

/**
 * Set an expectation that Ali will send a message, and flush the request
 *
 * @return {promise} which resolves to the ciphertext for Bob's device.
 */
function expectAliSendMessageRequest() {
    return expectSendMessageRequest(aliTestClient.httpBackend).then(function(content) {
        aliMessages.push(content);
        expect(Object.keys(content.ciphertext)).toEqual([bobTestClient.getDeviceKey()]);
        const ciphertext = content.ciphertext[bobTestClient.getDeviceKey()];
        expect(ciphertext).toBeTruthy();
        return ciphertext;
    });
}

/**
 * Set an expectation that Bob will send a message, and flush the request
 *
 * @return {promise} which resolves to the ciphertext for Bob's device.
 */
function expectBobSendMessageRequest() {
    return expectSendMessageRequest(bobTestClient.httpBackend).then(function(content) {
        bobMessages.push(content);
        const aliKeyId = "curve25519:" + aliDeviceId;
        const aliDeviceCurve25519Key = aliTestClient.deviceKeys.keys[aliKeyId];
        expect(Object.keys(content.ciphertext)).toEqual([aliDeviceCurve25519Key]);
        const ciphertext = content.ciphertext[aliDeviceCurve25519Key];
        expect(ciphertext).toBeTruthy();
        return ciphertext;
    });
}

function sendMessage(client) {
    return client.sendMessage(
        roomId, { msgtype: "m.text", body: "Hello, World" },
    );
}

function expectSendMessageRequest(httpBackend) {
    const path = "/send/m.room.encrypted/";
    const prom = new Promise((resolve) => {
        httpBackend.when("PUT", path).respond(200, function(path, content) {
            resolve(content);
            return {
                event_id: "asdfgh",
            };
        });
    });

    // it can take a while to process the key query
    return httpBackend.flush(path, 1).then(() => prom);
}

function aliRecvMessage() {
    const message = bobMessages.shift();
    return recvMessage(
        aliTestClient.httpBackend, aliTestClient.client, bobUserId, message,
    );
}

function bobRecvMessage() {
    const message = aliMessages.shift();
    return recvMessage(
        bobTestClient.httpBackend, bobTestClient.client, aliUserId, message,
    );
}

function recvMessage(httpBackend, client, sender, message) {
    const syncData = {
        next_batch: "x",
        rooms: {
            join: {

            },
        },
    };
    syncData.rooms.join[roomId] = {
        timeline: {
            events: [
                testUtils.mkEvent({
                    type: "m.room.encrypted",
                    room: roomId,
                    content: message,
                    sender: sender,
                }),
            ],
        },
    };
    httpBackend.when("GET", "/sync").respond(200, syncData);

    const eventPromise = new Promise((resolve, reject) => {
        const onEvent = function(event) {
            // ignore the m.room.member events
            if (event.getType() == "m.room.member") {
                return;
            }
            logger.log(client.credentials.userId + " received event",
                        event);

            client.removeListener("event", onEvent);
            resolve(event);
        };
        client.on("event", onEvent);
    });

    httpBackend.flush();

    return eventPromise.then((event) => {
        expect(event.isEncrypted()).toBeTruthy();

        // it may still be being decrypted
        return testUtils.awaitDecryption(event);
    }).then((event) => {
        expect(event.getType()).toEqual("m.room.message");
        expect(event.getContent()).toEqual({
            msgtype: "m.text",
            body: "Hello, World",
        });
        expect(event.isEncrypted()).toBeTruthy();
    });
}

/**
 * Send an initial sync response to the client (which just includes the member
 * list for our test room).
 *
 * @param {TestClient} testClient
 * @returns {Promise} which resolves when the sync has been flushed.
 */
function firstSync(testClient) {
    // send a sync response including our test room.
    const syncData = {
        next_batch: "x",
        rooms: {
            join: { },
        },
    };
    syncData.rooms.join[roomId] = {
        state: {
            events: [
                testUtils.mkMembership({
                    mship: "join",
                    user: aliUserId,
                }),
                testUtils.mkMembership({
                    mship: "join",
                    user: bobUserId,
                }),
            ],
        },
        timeline: {
            events: [],
        },
    };

    testClient.httpBackend.when("GET", "/sync").respond(200, syncData);
    return testClient.flushSync();
}

describe("MatrixClient crypto", function() {
    if (!CRYPTO_ENABLED) {
        return;
    }

    beforeEach(async function() {
        aliTestClient = new TestClient(aliUserId, aliDeviceId, aliAccessToken);
        await aliTestClient.client.initCrypto();

        bobTestClient = new TestClient(bobUserId, bobDeviceId, bobAccessToken);
        await bobTestClient.client.initCrypto();

        aliMessages = [];
        bobMessages = [];
    });

    afterEach(function() {
        aliTestClient.httpBackend.verifyNoOutstandingExpectation();
        bobTestClient.httpBackend.verifyNoOutstandingExpectation();

        return Promise.all([aliTestClient.stop(), bobTestClient.stop()]);
    });

    it("Bob uploads device keys", function() {
        return Promise.resolve()
            .then(bobUploadsDeviceKeys);
    });

    it("Ali downloads Bobs device keys", function() {
        return Promise.resolve()
            .then(bobUploadsDeviceKeys)
            .then(aliDownloadsKeys);
    });

    it("Ali gets keys with an invalid signature", function() {
        return Promise.resolve()
            .then(bobUploadsDeviceKeys)
            .then(function() {
                // tamper bob's keys
                const bobDeviceKeys = bobTestClient.deviceKeys;
                expect(bobDeviceKeys.keys["curve25519:" + bobDeviceId]).toBeTruthy();
                bobDeviceKeys.keys["curve25519:" + bobDeviceId] += "abc";

                return Promise.all([
                    aliTestClient.client.downloadKeys([bobUserId]),
                    expectAliQueryKeys(),
                ]);
            }).then(function() {
                return aliTestClient.client.getStoredDevicesForUser(bobUserId);
            }).then((devices) => {
                // should get an empty list
                expect(devices).toEqual([]);
            });
    });

    it("Ali gets keys with an incorrect userId", function() {
        const eveUserId = "@eve:localhost";

        const bobDeviceKeys = {
            algorithms: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
            device_id: 'bvcxz',
            keys: {
                'ed25519:bvcxz': 'pYuWKMCVuaDLRTM/eWuB8OlXEb61gZhfLVJ+Y54tl0Q',
                'curve25519:bvcxz': '7Gni0loo/nzF0nFp9847RbhElGewzwUXHPrljjBGPTQ',
            },
            user_id: '@eve:localhost',
            signatures: {
                '@eve:localhost': {
                    'ed25519:bvcxz': 'CliUPZ7dyVPBxvhSA1d+X+LYa5b2AYdjcTwG' +
                        '0stXcIxjaJNemQqtdgwKDtBFl3pN2I13SEijRDCf1A8bYiQMDg',
                },
            },
        };

        const bobKeys = {};
        bobKeys[bobDeviceId] = bobDeviceKeys;
        aliTestClient.httpBackend.when(
            "POST", "/keys/query",
        ).respond(200, function(path, content) {
            const result = {};
            result[bobUserId] = bobKeys;
            return { device_keys: result };
        });

        return Promise.all([
            aliTestClient.client.downloadKeys([bobUserId, eveUserId]),
            aliTestClient.httpBackend.flush("/keys/query", 1),
        ]).then(function() {
            return Promise.all([
                aliTestClient.client.getStoredDevicesForUser(bobUserId),
                aliTestClient.client.getStoredDevicesForUser(eveUserId),
            ]);
        }).then(([bobDevices, eveDevices]) => {
            // should get an empty list
            expect(bobDevices).toEqual([]);
            expect(eveDevices).toEqual([]);
        });
    });

    it("Ali gets keys with an incorrect deviceId", function() {
        const bobDeviceKeys = {
            algorithms: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
            device_id: 'bad_device',
            keys: {
                'ed25519:bad_device': 'e8XlY5V8x2yJcwa5xpSzeC/QVOrU+D5qBgyTK0ko+f0',
                'curve25519:bad_device': 'YxuuLG/4L5xGeP8XPl5h0d7DzyYVcof7J7do+OXz0xc',
            },
            user_id: '@bob:localhost',
            signatures: {
                '@bob:localhost': {
                    'ed25519:bad_device': 'fEFTq67RaSoIEVBJ8DtmRovbwUBKJ0A' +
                        'me9m9PDzM9azPUwZ38Xvf6vv1A7W1PSafH4z3Y2ORIyEnZgHaNby3CQ',
                },
            },
        };

        const bobKeys = {};
        bobKeys[bobDeviceId] = bobDeviceKeys;
        aliTestClient.httpBackend.when(
            "POST", "/keys/query",
        ).respond(200, function(path, content) {
            const result = {};
            result[bobUserId] = bobKeys;
            return { device_keys: result };
        });

        return Promise.all([
            aliTestClient.client.downloadKeys([bobUserId]),
            aliTestClient.httpBackend.flush("/keys/query", 1),
        ]).then(function() {
            return aliTestClient.client.getStoredDevicesForUser(bobUserId);
        }).then((devices) => {
            // should get an empty list
            expect(devices).toEqual([]);
        });
    });

    it("Bob starts his client and uploads device keys and one-time keys", function() {
        return Promise.resolve()
            .then(() => bobTestClient.start())
            .then(() => bobTestClient.awaitOneTimeKeyUpload())
            .then((keys) => {
                expect(Object.keys(keys).length).toEqual(5);
                expect(Object.keys(bobTestClient.deviceKeys).length).not.toEqual(0);
            });
    });

    it("Ali sends a message", function() {
        aliTestClient.expectKeyQuery({ device_keys: { [aliUserId]: {} } });
        return Promise.resolve()
            .then(() => aliTestClient.start())
            .then(() => bobTestClient.start())
            .then(() => firstSync(aliTestClient))
            .then(aliEnablesEncryption)
            .then(aliSendsFirstMessage);
    });

    it("Bob receives a message", function() {
        aliTestClient.expectKeyQuery({ device_keys: { [aliUserId]: {} } });
        return Promise.resolve()
            .then(() => aliTestClient.start())
            .then(() => bobTestClient.start())
            .then(() => firstSync(aliTestClient))
            .then(aliEnablesEncryption)
            .then(aliSendsFirstMessage)
            .then(bobRecvMessage);
    });

    it("Bob receives a message with a bogus sender", function() {
        aliTestClient.expectKeyQuery({ device_keys: { [aliUserId]: {} } });
        return Promise.resolve()
            .then(() => aliTestClient.start())
            .then(() => bobTestClient.start())
            .then(() => firstSync(aliTestClient))
            .then(aliEnablesEncryption)
            .then(aliSendsFirstMessage)
            .then(function() {
                const message = aliMessages.shift();
                const syncData = {
                    next_batch: "x",
                    rooms: {
                        join: {

                        },
                    },
                };
                syncData.rooms.join[roomId] = {
                    timeline: {
                        events: [
                            testUtils.mkEvent({
                                type: "m.room.encrypted",
                                room: roomId,
                                content: message,
                                sender: "@bogus:sender",
                            }),
                        ],
                    },
                };
                bobTestClient.httpBackend.when("GET", "/sync").respond(200, syncData);

                const eventPromise = new Promise((resolve, reject) => {
                    const onEvent = function(event) {
                        logger.log(bobUserId + " received event",
                                    event);
                        resolve(event);
                    };
                    bobTestClient.client.once("event", onEvent);
                });

                bobTestClient.httpBackend.flush();
                return eventPromise;
            }).then((event) => {
                expect(event.isEncrypted()).toBeTruthy();

                // it may still be being decrypted
                return testUtils.awaitDecryption(event);
            }).then((event) => {
                expect(event.getType()).toEqual("m.room.message");
                expect(event.getContent().msgtype).toEqual("m.bad.encrypted");
            });
    });

    it("Ali blocks Bob's device", function() {
        aliTestClient.expectKeyQuery({ device_keys: { [aliUserId]: {} } });
        return Promise.resolve()
            .then(() => aliTestClient.start())
            .then(() => bobTestClient.start())
            .then(() => firstSync(aliTestClient))
            .then(aliEnablesEncryption)
            .then(aliDownloadsKeys)
            .then(function() {
                aliTestClient.client.setDeviceBlocked(bobUserId, bobDeviceId, true);
                const p1 = sendMessage(aliTestClient.client);
                const p2 = expectSendMessageRequest(aliTestClient.httpBackend)
                      .then(function(sentContent) {
                          // no unblocked devices, so the ciphertext should be empty
                          expect(sentContent.ciphertext).toEqual({});
                      });
                return Promise.all([p1, p2]);
            });
    });

    it("Bob receives two pre-key messages", function() {
        aliTestClient.expectKeyQuery({ device_keys: { [aliUserId]: {} } });
        return Promise.resolve()
            .then(() => aliTestClient.start())
            .then(() => bobTestClient.start())
            .then(() => firstSync(aliTestClient))
            .then(aliEnablesEncryption)
            .then(aliSendsFirstMessage)
            .then(bobRecvMessage)
            .then(aliSendsMessage)
            .then(bobRecvMessage);
    });

    it("Bob replies to the message", function() {
        aliTestClient.expectKeyQuery({ device_keys: { [aliUserId]: {} } });
        bobTestClient.expectKeyQuery({ device_keys: { [bobUserId]: {} } });
        return Promise.resolve()
            .then(() => aliTestClient.start())
            .then(() => bobTestClient.start())
            .then(() => firstSync(aliTestClient))
            .then(() => firstSync(bobTestClient))
            .then(aliEnablesEncryption)
            .then(aliSendsFirstMessage)
            .then(bobRecvMessage)
            .then(bobEnablesEncryption)
            .then(bobSendsReplyMessage).then(function(ciphertext) {
                expect(ciphertext.type).toEqual(1, "Unexpected cipghertext type.");
            }).then(aliRecvMessage);
    });

    it("Ali does a key query when encryption is enabled", function() {
        // enabling encryption in the room should make alice download devices
        // for both members.
        aliTestClient.expectKeyQuery({ device_keys: { [aliUserId]: {} } });
        return Promise.resolve()
            .then(() => aliTestClient.start())
            .then(() => firstSync(aliTestClient))
            .then(() => {
                const syncData = {
                    next_batch: '2',
                    rooms: {
                        join: {},
                    },
                };
                syncData.rooms.join[roomId] = {
                    state: {
                        events: [
                            testUtils.mkEvent({
                                type: 'm.room.encryption',
                                skey: '',
                                content: {
                                    algorithm: 'm.olm.v1.curve25519-aes-sha2',
                                },
                            }),
                        ],
                    },
                };

                aliTestClient.httpBackend.when('GET', '/sync').respond(
                    200, syncData);
                return aliTestClient.httpBackend.flush('/sync', 1);
            }).then(() => {
                aliTestClient.expectKeyQuery({
                    device_keys: {
                        [bobUserId]: {},
                    },
                });
                return aliTestClient.httpBackend.flushAllExpected();
            });
    });

    it("Upload new oneTimeKeys based on a /sync request - no count-asking", function() {
        // Send a response which causes a key upload
        const httpBackend = aliTestClient.httpBackend;
        const syncDataEmpty = {
            next_batch: "a",
            device_one_time_keys_count: {
                signed_curve25519: 0,
            },
        };

        // enqueue expectations:
        // * Sync with empty one_time_keys => upload keys

        return Promise.resolve()
            .then(() => {
                logger.log(aliTestClient + ': starting');
                httpBackend.when("GET", "/pushrules").respond(200, {});
                httpBackend.when("POST", "/filter").respond(200, { filter_id: "fid" });
                aliTestClient.expectDeviceKeyUpload();

                // we let the client do a very basic initial sync, which it needs before
                // it will upload one-time keys.
                httpBackend.when("GET", "/sync").respond(200, syncDataEmpty);

                aliTestClient.client.startClient({});

                return httpBackend.flushAllExpected().then(() => {
                    logger.log(aliTestClient + ': started');
                });
            })
            .then(() => httpBackend.when("POST", "/keys/upload")
                .respond(200, (path, content) => {
                    expect(content.one_time_keys).toBeTruthy();
                    expect(content.one_time_keys).not.toEqual({});
                    expect(Object.keys(content.one_time_keys).length)
                        .toBeGreaterThanOrEqual(1);
                    logger.log('received %i one-time keys',
                                Object.keys(content.one_time_keys).length);
                    // cancel futher calls by telling the client
                    // we have more than we need
                    return {
                       one_time_key_counts: {
                           signed_curve25519: 70,
                       },
                    };
                }))
            .then(() => httpBackend.flushAllExpected());
    });
});
