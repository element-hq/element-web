/*
Copyright 2016 OpenMarket Ltd
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

import anotherjson from "another-json";

import * as testUtils from "../test-utils";
import { TestClient } from "../TestClient";
import { logger } from "../../src/logger";

const ROOM_ID = "!room:id";

/**
 * start an Olm session with a given recipient
 *
 * @param {Olm.Account} olmAccount
 * @param {TestClient} recipientTestClient
 * @return {Promise} promise for Olm.Session
 */
function createOlmSession(olmAccount, recipientTestClient) {
    return recipientTestClient.awaitOneTimeKeyUpload().then((keys) => {
        const otkId = Object.keys(keys)[0];
        const otk = keys[otkId];

        const session = new global.Olm.Session();
        session.create_outbound(
            olmAccount, recipientTestClient.getDeviceKey(), otk.key,
        );
        return session;
    });
}

/**
 * encrypt an event with olm
 *
 * @param {object} opts
 * @param {string=} opts.sender
 * @param {string} opts.senderKey
 * @param {Olm.Session} opts.p2pSession
 * @param {TestClient} opts.recipient
 * @param {object=} opts.plaincontent
 * @param {string=} opts.plaintype
 *
 * @return {object} event
 */
function encryptOlmEvent(opts) {
    expect(opts.senderKey).toBeTruthy();
    expect(opts.p2pSession).toBeTruthy();
    expect(opts.recipient).toBeTruthy();

    const plaintext = {
        content: opts.plaincontent || {},
        recipient: opts.recipient.userId,
        recipient_keys: {
            ed25519: opts.recipient.getSigningKey(),
        },
        sender: opts.sender || '@bob:xyz',
        type: opts.plaintype || 'm.test',
    };

    const event = {
        content: {
            algorithm: 'm.olm.v1.curve25519-aes-sha2',
            ciphertext: {},
            sender_key: opts.senderKey,
        },
        sender: opts.sender || '@bob:xyz',
        type: 'm.room.encrypted',
    };
    event.content.ciphertext[opts.recipient.getDeviceKey()] =
        opts.p2pSession.encrypt(JSON.stringify(plaintext));
    return event;
}

/**
 * encrypt an event with megolm
 *
 * @param {object} opts
 * @param {string} opts.senderKey
 * @param {Olm.OutboundGroupSession} opts.groupSession
 * @param {object=} opts.plaintext
 * @param {string=} opts.room_id
 *
 * @return {object} event
 */
function encryptMegolmEvent(opts) {
    expect(opts.senderKey).toBeTruthy();
    expect(opts.groupSession).toBeTruthy();

    const plaintext = opts.plaintext || {};
    if (!plaintext.content) {
        plaintext.content = {
            body: '42',
            msgtype: "m.text",
        };
    }
    if (!plaintext.type) {
        plaintext.type = "m.room.message";
    }
    if (!plaintext.room_id) {
        expect(opts.room_id).toBeTruthy();
        plaintext.room_id = opts.room_id;
    }

    return {
        event_id: 'test_megolm_event',
        content: {
            algorithm: "m.megolm.v1.aes-sha2",
            ciphertext: opts.groupSession.encrypt(JSON.stringify(plaintext)),
            device_id: "testDevice",
            sender_key: opts.senderKey,
            session_id: opts.groupSession.session_id(),
        },
        type: "m.room.encrypted",
    };
}

/**
 * build an encrypted room_key event to share a group session
 *
 * @param {object} opts
 * @param {string} opts.senderKey
 * @param {TestClient} opts.recipient
 * @param {Olm.Session} opts.p2pSession
 * @param {Olm.OutboundGroupSession} opts.groupSession
 * @param {string=} opts.room_id
 *
 * @return {object} event
 */
function encryptGroupSessionKey(opts) {
    return encryptOlmEvent({
        senderKey: opts.senderKey,
        recipient: opts.recipient,
        p2pSession: opts.p2pSession,
        plaincontent: {
            algorithm: 'm.megolm.v1.aes-sha2',
            room_id: opts.room_id,
            session_id: opts.groupSession.session_id(),
            session_key: opts.groupSession.session_key(),
        },
        plaintype: 'm.room_key',
    });
}

/**
 * get a /sync response which contains a single room (ROOM_ID),
 * with the members given
 *
 * @param {string[]} roomMembers
 *
 * @return {object} event
 */
function getSyncResponse(roomMembers) {
    const roomResponse = {
        state: {
            events: [
                testUtils.mkEvent({
                    type: 'm.room.encryption',
                    skey: '',
                    content: {
                        algorithm: 'm.megolm.v1.aes-sha2',
                    },
                }),
            ],
        },
    };

    for (let i = 0; i < roomMembers.length; i++) {
        roomResponse.state.events.push(
            testUtils.mkMembership({
                mship: 'join',
                sender: roomMembers[i],
            }),
        );
    }

    const syncResponse = {
        next_batch: 1,
        rooms: {
            join: {},
        },
    };
    syncResponse.rooms.join[ROOM_ID] = roomResponse;
    return syncResponse;
}

describe("megolm", function() {
    if (!global.Olm) {
        logger.warn('not running megolm tests: Olm not present');
        return;
    }
    const Olm = global.Olm;

    let testOlmAccount;
    let testSenderKey;
    let aliceTestClient;

    /**
     * Get the device keys for testOlmAccount in a format suitable for a
     * response to /keys/query
     *
     * @param {string} userId The user ID to query for
     * @returns {Object} The fake query response
     */
    function getTestKeysQueryResponse(userId) {
        const testE2eKeys = JSON.parse(testOlmAccount.identity_keys());
        const testDeviceKeys = {
            algorithms: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
            device_id: 'DEVICE_ID',
            keys: {
                'curve25519:DEVICE_ID': testE2eKeys.curve25519,
                'ed25519:DEVICE_ID': testE2eKeys.ed25519,
            },
            user_id: userId,
        };
        const j = anotherjson.stringify(testDeviceKeys);
        const sig = testOlmAccount.sign(j);
        testDeviceKeys.signatures = {};
        testDeviceKeys.signatures[userId] = {
            'ed25519:DEVICE_ID': sig,
        };

        const queryResponse = {
            device_keys: {},
        };

        queryResponse.device_keys[userId] = {
            'DEVICE_ID': testDeviceKeys,
        };

        return queryResponse;
    }

    /**
     * Get a one-time key for testOlmAccount in a format suitable for a
     * response to /keys/claim

     * @param {string} userId The user ID to query for
     * @returns {Object} The fake key claim response
     */
    function getTestKeysClaimResponse(userId) {
        testOlmAccount.generate_one_time_keys(1);
        const testOneTimeKeys = JSON.parse(testOlmAccount.one_time_keys());
        testOlmAccount.mark_keys_as_published();

        const keyId = Object.keys(testOneTimeKeys.curve25519)[0];
        const oneTimeKey = testOneTimeKeys.curve25519[keyId];
        const keyResult = {
            'key': oneTimeKey,
        };
        const j = anotherjson.stringify(keyResult);
        const sig = testOlmAccount.sign(j);
        keyResult.signatures = {};
        keyResult.signatures[userId] = {
            'ed25519:DEVICE_ID': sig,
        };

        const claimResponse = { one_time_keys: {} };
        claimResponse.one_time_keys[userId] = {
            'DEVICE_ID': {},
        };
        claimResponse.one_time_keys[userId].DEVICE_ID['signed_curve25519:' + keyId] =
            keyResult;
        return claimResponse;
    }

    beforeEach(async function() {
        aliceTestClient = new TestClient(
            "@alice:localhost", "xzcvb", "akjgkrgjs",
        );
        await aliceTestClient.client.initCrypto();

        testOlmAccount = new Olm.Account();
        testOlmAccount.create();
        const testE2eKeys = JSON.parse(testOlmAccount.identity_keys());
        testSenderKey = testE2eKeys.curve25519;
    });

    afterEach(function() {
        return aliceTestClient.stop();
    });

    it("Alice receives a megolm message", function() {
        return aliceTestClient.start().then(() => {
            return createOlmSession(testOlmAccount, aliceTestClient);
        }).then((p2pSession) => {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();

            // make the room_key event
            const roomKeyEncrypted = encryptGroupSessionKey({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // encrypt a message with the group session
            const messageEncrypted = encryptMegolmEvent({
                senderKey: testSenderKey,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // Alice gets both the events in a single sync
            const syncResponse = {
                next_batch: 1,
                to_device: {
                    events: [roomKeyEncrypted],
                },
                rooms: {
                    join: {},
                },
            };
            syncResponse.rooms.join[ROOM_ID] = {
                timeline: {
                    events: [messageEncrypted],
                },
            };

            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, syncResponse);
            return aliceTestClient.flushSync();
        }).then(function() {
            const room = aliceTestClient.client.getRoom(ROOM_ID);
            const event = room.getLiveTimeline().getEvents()[0];
            expect(event.isEncrypted()).toBe(true);
            return testUtils.awaitDecryption(event);
        }).then((event) => {
            expect(event.getContent().body).toEqual('42');
        });
    });

    it("Alice receives a megolm message before the session keys", function() {
        // https://github.com/vector-im/element-web/issues/2273
        let roomKeyEncrypted;

        return aliceTestClient.start().then(() => {
            return createOlmSession(testOlmAccount, aliceTestClient);
        }).then((p2pSession) => {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();

            // make the room_key event, but don't send it yet
            roomKeyEncrypted = encryptGroupSessionKey({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // encrypt a message with the group session
            const messageEncrypted = encryptMegolmEvent({
                senderKey: testSenderKey,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // Alice just gets the message event to start with
            const syncResponse = {
                next_batch: 1,
                rooms: {
                    join: {},
                },
            };
            syncResponse.rooms.join[ROOM_ID] = {
                timeline: {
                    events: [messageEncrypted],
                },
            };

            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, syncResponse);
            return aliceTestClient.flushSync();
        }).then(function() {
            const room = aliceTestClient.client.getRoom(ROOM_ID);
            const event = room.getLiveTimeline().getEvents()[0];
            expect(event.getContent().msgtype).toEqual('m.bad.encrypted');

            // now she gets the room_key event
            const syncResponse = {
                next_batch: 2,
                to_device: {
                    events: [roomKeyEncrypted],
                },
            };

            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, syncResponse);
            return aliceTestClient.flushSync();
        }).then(function() {
            const room = aliceTestClient.client.getRoom(ROOM_ID);
            const event = room.getLiveTimeline().getEvents()[0];

            if (event.getContent().msgtype != 'm.bad.encrypted') {
                return event;
            }

            return new Promise((resolve, reject) => {
                event.once('Event.decrypted', (ev) => {
                    logger.log(`${Date.now()} event ${event.getId()} now decrypted`);
                    resolve(ev);
                });
            });
        }).then((event) => {
            expect(event.getContent().body).toEqual('42');
        });
    });

    it("Alice gets a second room_key message", function() {
        return aliceTestClient.start().then(() => {
            return createOlmSession(testOlmAccount, aliceTestClient);
        }).then((p2pSession) => {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();

            // make the room_key event
            const roomKeyEncrypted1 = encryptGroupSessionKey({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // encrypt a message with the group session
            const messageEncrypted = encryptMegolmEvent({
                senderKey: testSenderKey,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // make a second room_key event now that we have advanced the group
            // session.
            const roomKeyEncrypted2 = encryptGroupSessionKey({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // on the first sync, send the best room key
            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, {
                next_batch: 1,
                to_device: {
                    events: [roomKeyEncrypted1],
                },
            });

            // on the second sync, send the advanced room key, along with the
            // message.  This simulates the situation where Alice has been sent a
            // later copy of the room key and is reloading the client.
            const syncResponse2 = {
                next_batch: 2,
                to_device: {
                    events: [roomKeyEncrypted2],
                },
                rooms: {
                    join: {},
                },
            };
            syncResponse2.rooms.join[ROOM_ID] = {
                timeline: {
                    events: [messageEncrypted],
                },
            };
            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, syncResponse2);

            // flush both syncs
            return aliceTestClient.flushSync().then(() => {
                return aliceTestClient.flushSync();
            });
        }).then(async function() {
            const room = aliceTestClient.client.getRoom(ROOM_ID);
            await room.decryptCriticalEvents();
            const event = room.getLiveTimeline().getEvents()[0];
            expect(event.getContent().body).toEqual('42');
        });
    });

    it('Alice sends a megolm message', function() {
        let p2pSession;

        aliceTestClient.expectKeyQuery({ device_keys: { '@alice:localhost': {} } });
        return aliceTestClient.start().then(() => {
            // establish an olm session with alice
            return createOlmSession(testOlmAccount, aliceTestClient);
        }).then((_p2pSession) => {
            p2pSession = _p2pSession;

            const syncResponse = getSyncResponse(['@bob:xyz']);

            const olmEvent = encryptOlmEvent({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
            });

            syncResponse.to_device = { events: [olmEvent] };

            aliceTestClient.httpBackend.when('GET', '/sync').respond(200, syncResponse);
            return aliceTestClient.flushSync();
        }).then(function() {
            // start out with the device unknown - the send should be rejected.
            aliceTestClient.httpBackend.when('POST', '/keys/query').respond(
                200, getTestKeysQueryResponse('@bob:xyz'),
            );

            return Promise.all([
                aliceTestClient.client.sendTextMessage(ROOM_ID, 'test').then(() => {
                    throw new Error("sendTextMessage failed on an unknown device");
                }, (e) => {
                    expect(e.name).toEqual("UnknownDeviceError");
                }),
                aliceTestClient.httpBackend.flushAllExpected(),
            ]);
        }).then(function() {
            // mark the device as known, and resend.
            aliceTestClient.client.setDeviceKnown('@bob:xyz', 'DEVICE_ID');

            let inboundGroupSession;
            aliceTestClient.httpBackend.when(
                'PUT', '/sendToDevice/m.room.encrypted/',
            ).respond(200, function(path, content) {
                const m = content.messages['@bob:xyz'].DEVICE_ID;
                const ct = m.ciphertext[testSenderKey];
                const decrypted = JSON.parse(p2pSession.decrypt(ct.type, ct.body));

                expect(decrypted.type).toEqual('m.room_key');
                inboundGroupSession = new Olm.InboundGroupSession();
                inboundGroupSession.create(decrypted.content.session_key);
                return {};
            });

            aliceTestClient.httpBackend.when(
                'PUT', '/send/',
            ).respond(200, function(path, content) {
                const ct = content.ciphertext;
                const r = inboundGroupSession.decrypt(ct);
                logger.log('Decrypted received megolm message', r);

                expect(r.message_index).toEqual(0);
                const decrypted = JSON.parse(r.plaintext);
                expect(decrypted.type).toEqual('m.room.message');
                expect(decrypted.content.body).toEqual('test');

                return {
                    event_id: '$event_id',
                };
            });

            const room = aliceTestClient.client.getRoom(ROOM_ID);
            const pendingMsg = room.getPendingEvents()[0];

            return Promise.all([
                aliceTestClient.client.resendEvent(pendingMsg, room),

                // the crypto stuff can take a while, so give the requests a whole second.
                aliceTestClient.httpBackend.flushAllExpected({
                    timeout: 1000,
                }),
            ]);
        });
    });

    it("We shouldn't attempt to send to blocked devices", function() {
        aliceTestClient.expectKeyQuery({ device_keys: { '@alice:localhost': {} } });
        return aliceTestClient.start().then(() => {
            // establish an olm session with alice
            return createOlmSession(testOlmAccount, aliceTestClient);
        }).then((p2pSession) => {
            const syncResponse = getSyncResponse(['@bob:xyz']);

            const olmEvent = encryptOlmEvent({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
            });

            syncResponse.to_device = { events: [olmEvent] };
            aliceTestClient.httpBackend.when('GET', '/sync').respond(200, syncResponse);

            return aliceTestClient.flushSync();
        }).then(function() {
            logger.log('Forcing alice to download our device keys');

            aliceTestClient.httpBackend.when('POST', '/keys/query').respond(
                200, getTestKeysQueryResponse('@bob:xyz'),
            );

            return Promise.all([
                aliceTestClient.client.downloadKeys(['@bob:xyz']),
                aliceTestClient.httpBackend.flush('/keys/query', 1),
            ]);
        }).then(function() {
            logger.log('Telling alice to block our device');
            aliceTestClient.client.setDeviceBlocked('@bob:xyz', 'DEVICE_ID');

            logger.log('Telling alice to send a megolm message');
            aliceTestClient.httpBackend.when(
                'PUT', '/send/',
            ).respond(200, {
                event_id: '$event_id',
            });
            aliceTestClient.httpBackend.when(
                'PUT', '/sendToDevice/org.matrix.room_key.withheld/',
            ).respond(200, {});

            return Promise.all([
                aliceTestClient.client.sendTextMessage(ROOM_ID, 'test'),

                // the crypto stuff can take a while, so give the requests a whole second.
                aliceTestClient.httpBackend.flushAllExpected({
                    timeout: 1000,
                }),
            ]);
        });
    });

    it("We should start a new megolm session when a device is blocked", function() {
        let p2pSession;
        let megolmSessionId;

        aliceTestClient.expectKeyQuery({ device_keys: { '@alice:localhost': {} } });
        return aliceTestClient.start().then(() => {
            // establish an olm session with alice
            return createOlmSession(testOlmAccount, aliceTestClient);
        }).then((_p2pSession) => {
            p2pSession = _p2pSession;

            const syncResponse = getSyncResponse(['@bob:xyz']);

            const olmEvent = encryptOlmEvent({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
            });

            syncResponse.to_device = { events: [olmEvent] };
            aliceTestClient.httpBackend.when('GET', '/sync').respond(200, syncResponse);

            return aliceTestClient.flushSync();
        }).then(function() {
            logger.log("Fetching bob's devices and marking known");

            aliceTestClient.httpBackend.when('POST', '/keys/query').respond(
                200, getTestKeysQueryResponse('@bob:xyz'),
            );

            return Promise.all([
                aliceTestClient.client.downloadKeys(['@bob:xyz']),
                aliceTestClient.httpBackend.flushAllExpected(),
            ]).then((keys) => {
                aliceTestClient.client.setDeviceKnown('@bob:xyz', 'DEVICE_ID');
            });
        }).then(function() {
            logger.log('Telling alice to send a megolm message');

            aliceTestClient.httpBackend.when(
                'PUT', '/sendToDevice/m.room.encrypted/',
            ).respond(200, function(path, content) {
                logger.log('sendToDevice: ', content);
                const m = content.messages['@bob:xyz'].DEVICE_ID;
                const ct = m.ciphertext[testSenderKey];
                expect(ct.type).toEqual(1); // normal message
                const decrypted = JSON.parse(p2pSession.decrypt(ct.type, ct.body));
                logger.log('decrypted sendToDevice:', decrypted);
                expect(decrypted.type).toEqual('m.room_key');
                megolmSessionId = decrypted.content.session_id;
                return {};
            });

            aliceTestClient.httpBackend.when(
                'PUT', '/send/',
            ).respond(200, function(path, content) {
                logger.log('/send:', content);
                expect(content.session_id).toEqual(megolmSessionId);
                return {
                    event_id: '$event_id',
                };
            });

            return Promise.all([
                aliceTestClient.client.sendTextMessage(ROOM_ID, 'test'),

                // the crypto stuff can take a while, so give the requests a whole second.
                aliceTestClient.httpBackend.flushAllExpected({
                    timeout: 1000,
                }),
            ]);
        }).then(function() {
            logger.log('Telling alice to block our device');
            aliceTestClient.client.setDeviceBlocked('@bob:xyz', 'DEVICE_ID');

            logger.log('Telling alice to send another megolm message');
            aliceTestClient.httpBackend.when(
                'PUT', '/send/',
            ).respond(200, function(path, content) {
                logger.log('/send:', content);
                expect(content.session_id).not.toEqual(megolmSessionId);
                return {
                    event_id: '$event_id',
                };
            });
            aliceTestClient.httpBackend.when(
                'PUT', '/sendToDevice/org.matrix.room_key.withheld/',
            ).respond(200, {});

            return Promise.all([
                aliceTestClient.client.sendTextMessage(ROOM_ID, 'test2'),
                aliceTestClient.httpBackend.flushAllExpected(),
            ]);
        });
    });

    // https://github.com/vector-im/element-web/issues/2676
    it("Alice should send to her other devices", function() {
        // for this test, we make the testOlmAccount be another of Alice's devices.
        // it ought to get included in messages Alice sends.

        let p2pSession;
        let inboundGroupSession;
        let decrypted;

        return aliceTestClient.start().then(function() {
            // an encrypted room with just alice
            const syncResponse = {
                next_batch: 1,
                rooms: {
                    join: {},
                },
            };
            syncResponse.rooms.join[ROOM_ID] = {
                state: {
                    events: [
                        testUtils.mkEvent({
                            type: 'm.room.encryption',
                            skey: '',
                            content: {
                                algorithm: 'm.megolm.v1.aes-sha2',
                            },
                        }),
                        testUtils.mkMembership({
                            mship: 'join',
                            sender: aliceTestClient.userId,
                        }),
                    ],
                },
            };
            aliceTestClient.httpBackend.when('GET', '/sync').respond(200, syncResponse);

            // the completion of the first initialsync hould make Alice
            // invalidate the device cache for all members in e2e rooms (ie,
            // herself), and do a key query.
            aliceTestClient.expectKeyQuery(
                getTestKeysQueryResponse(aliceTestClient.userId),
            );

            return aliceTestClient.httpBackend.flushAllExpected();
        }).then(function() {
            // start out with the device unknown - the send should be rejected.
            return aliceTestClient.client.sendTextMessage(ROOM_ID, 'test').then(() => {
                throw new Error("sendTextMessage failed on an unknown device");
            }, (e) => {
                expect(e.name).toEqual("UnknownDeviceError");
                expect(Object.keys(e.devices)).toEqual([aliceTestClient.userId]);
                expect(Object.keys(e.devices[aliceTestClient.userId])).
                    toEqual(['DEVICE_ID']);
            });
        }).then(function() {
            // mark the device as known, and resend.
            aliceTestClient.client.setDeviceKnown(aliceTestClient.userId, 'DEVICE_ID');
            aliceTestClient.httpBackend.when('POST', '/keys/claim').respond(
                200, function(path, content) {
                expect(content.one_time_keys[aliceTestClient.userId].DEVICE_ID)
                    .toEqual("signed_curve25519");
                return getTestKeysClaimResponse(aliceTestClient.userId);
            });

            aliceTestClient.httpBackend.when(
                'PUT', '/sendToDevice/m.room.encrypted/',
            ).respond(200, function(path, content) {
                logger.log("sendToDevice: ", content);
                const m = content.messages[aliceTestClient.userId].DEVICE_ID;
                const ct = m.ciphertext[testSenderKey];
                expect(ct.type).toEqual(0); // pre-key message

                p2pSession = new Olm.Session();
                p2pSession.create_inbound(testOlmAccount, ct.body);
                const decrypted = JSON.parse(p2pSession.decrypt(ct.type, ct.body));

                expect(decrypted.type).toEqual('m.room_key');
                inboundGroupSession = new Olm.InboundGroupSession();
                inboundGroupSession.create(decrypted.content.session_key);
                return {};
            });

            aliceTestClient.httpBackend.when(
                'PUT', '/send/',
            ).respond(200, function(path, content) {
                const ct = content.ciphertext;
                const r = inboundGroupSession.decrypt(ct);
                logger.log('Decrypted received megolm message', r);
                decrypted = JSON.parse(r.plaintext);

                return {
                    event_id: '$event_id',
                };
            });

            // Grab the event that we'll need to resend
            const room = aliceTestClient.client.getRoom(ROOM_ID);
            const pendingEvents = room.getPendingEvents();
            expect(pendingEvents.length).toEqual(1);
            const unsentEvent = pendingEvents[0];

            return Promise.all([
                aliceTestClient.client.resendEvent(unsentEvent, room),

                // the crypto stuff can take a while, so give the requests a whole second.
                aliceTestClient.httpBackend.flushAllExpected({
                    timeout: 1000,
                }),
            ]);
        }).then(function() {
            expect(decrypted.type).toEqual('m.room.message');
            expect(decrypted.content.body).toEqual('test');
        });
    });

    it('Alice should wait for device list to complete when sending a megolm message',
    function() {
        let downloadPromise;
        let sendPromise;

        aliceTestClient.expectKeyQuery({ device_keys: { '@alice:localhost': {} } });
        return aliceTestClient.start().then(() => {
            // establish an olm session with alice
            return createOlmSession(testOlmAccount, aliceTestClient);
        }).then((p2pSession) => {
            const syncResponse = getSyncResponse(['@bob:xyz']);

            const olmEvent = encryptOlmEvent({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
            });

            syncResponse.to_device = { events: [olmEvent] };

            aliceTestClient.httpBackend.when('GET', '/sync').respond(200, syncResponse);
            return aliceTestClient.flushSync();
        }).then(function() {
            // this will block
            logger.log('Forcing alice to download our device keys');
            downloadPromise = aliceTestClient.client.downloadKeys(['@bob:xyz']);

            // so will this.
            sendPromise = aliceTestClient.client.sendTextMessage(ROOM_ID, 'test')
            .then(() => {
                throw new Error("sendTextMessage failed on an unknown device");
            }, (e) => {
                expect(e.name).toEqual("UnknownDeviceError");
            });

            aliceTestClient.httpBackend.when('POST', '/keys/query').respond(
                200, getTestKeysQueryResponse('@bob:xyz'),
            );

            return aliceTestClient.httpBackend.flushAllExpected();
        }).then(function() {
            return Promise.all([downloadPromise, sendPromise]);
        });
    });

    it("Alice exports megolm keys and imports them to a new device", function() {
        let messageEncrypted;

        aliceTestClient.expectKeyQuery({ device_keys: { '@alice:localhost': {} } });
        return aliceTestClient.start().then(() => {
            // establish an olm session with alice
            return createOlmSession(testOlmAccount, aliceTestClient);
        }).then((p2pSession) => {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();

            // make the room_key event
            const roomKeyEncrypted = encryptGroupSessionKey({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // encrypt a message with the group session
            messageEncrypted = encryptMegolmEvent({
                senderKey: testSenderKey,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // Alice gets both the events in a single sync
            const syncResponse = {
                next_batch: 1,
                to_device: {
                    events: [roomKeyEncrypted],
                },
                rooms: {
                    join: {},
                },
            };
            syncResponse.rooms.join[ROOM_ID] = {
                timeline: {
                    events: [messageEncrypted],
                },
            };

            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, syncResponse);
            return aliceTestClient.flushSync();
        }).then(async function() {
            const room = aliceTestClient.client.getRoom(ROOM_ID);
            await room.decryptCriticalEvents();
            const event = room.getLiveTimeline().getEvents()[0];
            expect(event.getContent().body).toEqual('42');

            return aliceTestClient.client.exportRoomKeys();
        }).then(function(exported) {
            // start a new client
            aliceTestClient.stop();

            aliceTestClient = new TestClient(
                "@alice:localhost", "device2", "access_token2",
            );
            return aliceTestClient.client.initCrypto().then(() => {
                aliceTestClient.client.importRoomKeys(exported);
                return aliceTestClient.start();
            });
        }).then(function() {
            const syncResponse = {
                next_batch: 1,
                rooms: {
                    join: {},
                },
            };
            syncResponse.rooms.join[ROOM_ID] = {
                timeline: {
                    events: [messageEncrypted],
                },
            };

            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, syncResponse);
            return aliceTestClient.flushSync();
        }).then(function() {
            const room = aliceTestClient.client.getRoom(ROOM_ID);
            const event = room.getLiveTimeline().getEvents()[0];
            expect(event.getContent().body).toEqual('42');
        });
    });

    it("Alice receives an untrusted megolm key, only to receive the trusted one shortly after", function() {
        const testClient = new TestClient(
            "@alice:localhost", "device2", "access_token2",
        );
        const groupSession = new Olm.OutboundGroupSession();
        groupSession.create();
        const inboundGroupSession = new Olm.InboundGroupSession();
        inboundGroupSession.create(groupSession.session_key());
        const rawEvent = encryptMegolmEvent({
            senderKey: testSenderKey,
            groupSession: groupSession,
            room_id: ROOM_ID,
        });
        return testClient.client.initCrypto().then(() => {
            const keys = [{
                room_id: ROOM_ID,
                algorithm: 'm.megolm.v1.aes-sha2',
                session_id: groupSession.session_id(),
                session_key: inboundGroupSession.export_session(0),
                sender_key: testSenderKey,
            }];
            return testClient.client.importRoomKeys(keys, { untrusted: true });
        }).then(() => {
            const event = testUtils.mkEvent({
                event: true,
                ...rawEvent,
                room: ROOM_ID,
            });
            return event.attemptDecryption(testClient.client.crypto, true).then(() => {
                expect(event.isKeySourceUntrusted()).toBeTruthy();
            });
        }).then(() => {
            const event = testUtils.mkEvent({
                type: 'm.room_key',
                content: {
                    room_id: ROOM_ID,
                    algorithm: 'm.megolm.v1.aes-sha2',
                    session_id: groupSession.session_id(),
                    session_key: groupSession.session_key(),
                },
                event: true,
            });
            event.senderCurve25519Key = testSenderKey;
            return testClient.client.crypto.onRoomKeyEvent(event);
        }).then(() => {
            const event = testUtils.mkEvent({
                event: true,
                ...rawEvent,
                room: ROOM_ID,
            });
            return event.attemptDecryption(testClient.client.crypto, true).then(() => {
                expect(event.isKeySourceUntrusted()).toBeFalsy();
            });
        });
    });

    it("Alice can decrypt a message with falsey content", function() {
        return aliceTestClient.start().then(() => {
            return createOlmSession(testOlmAccount, aliceTestClient);
        }).then((p2pSession) => {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();

            // make the room_key event
            const roomKeyEncrypted = encryptGroupSessionKey({
                senderKey: testSenderKey,
                recipient: aliceTestClient,
                p2pSession: p2pSession,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            const plaintext = {
                type: "m.room.message",
                content: undefined,
                room_id: ROOM_ID,
            };

            const messageEncrypted = {
                event_id: 'test_megolm_event',
                content: {
                    algorithm: "m.megolm.v1.aes-sha2",
                    ciphertext: groupSession.encrypt(JSON.stringify(plaintext)),
                    device_id: "testDevice",
                    sender_key: testSenderKey,
                    session_id: groupSession.session_id(),
                },
                type: "m.room.encrypted",
            };

            // Alice gets both the events in a single sync
            const syncResponse = {
                next_batch: 1,
                to_device: {
                    events: [roomKeyEncrypted],
                },
                rooms: {
                    join: {},
                },
            };
            syncResponse.rooms.join[ROOM_ID] = {
                timeline: {
                    events: [messageEncrypted],
                },
            };

            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, syncResponse);
            return aliceTestClient.flushSync();
        }).then(function() {
            const room = aliceTestClient.client.getRoom(ROOM_ID);
            const event = room.getLiveTimeline().getEvents()[0];
            expect(event.isEncrypted()).toBe(true);
            return testUtils.awaitDecryption(event);
        }).then((event) => {
            expect(event.getRoomId()).toEqual(ROOM_ID);
            expect(event.getContent()).toEqual({});
            expect(event.getClearContent()).toBeUndefined();
        });
    });
});
