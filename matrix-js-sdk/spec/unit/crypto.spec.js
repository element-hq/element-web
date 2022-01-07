import '../olm-loader';
import { EventEmitter } from "events";

import { Crypto } from "../../src/crypto";
import { WebStorageSessionStore } from "../../src/store/session/webstorage";
import { MemoryCryptoStore } from "../../src/crypto/store/memory-crypto-store";
import { MockStorageApi } from "../MockStorageApi";
import { TestClient } from "../TestClient";
import { MatrixEvent } from "../../src/models/event";
import { Room } from "../../src/models/room";
import * as olmlib from "../../src/crypto/olmlib";
import { sleep } from "../../src/utils";
import { CRYPTO_ENABLED } from "../../src/client";
import { DeviceInfo } from "../../src/crypto/deviceinfo";

const Olm = global.Olm;

describe("Crypto", function() {
    if (!CRYPTO_ENABLED) {
        return;
    }

    beforeAll(function() {
        return Olm.init();
    });

    it("Crypto exposes the correct olm library version", function() {
        expect(Crypto.getOlmVersion()[0]).toEqual(3);
    });

    describe("encrypted events", function() {
        it("provides encryption information", async function() {
            const client = (new TestClient(
                "@alice:example.com", "deviceid",
            )).client;
            await client.initCrypto();

            // unencrypted event
            const event = {
                getId: () => "$event_id",
                getSenderKey: () => null,
                getWireContent: () => {return {};},
            };

            let encryptionInfo = client.getEventEncryptionInfo(event);
            expect(encryptionInfo.encrypted).toBeFalsy();

            // unknown sender (e.g. deleted device), forwarded megolm key (untrusted)
            event.getSenderKey = () => 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI';
            event.getWireContent = () => {return { algorithm: olmlib.MEGOLM_ALGORITHM };};
            event.getForwardingCurve25519KeyChain = () => ["not empty"];
            event.isKeySourceUntrusted = () => false;
            event.getClaimedEd25519Key =
                () => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

            encryptionInfo = client.getEventEncryptionInfo(event);
            expect(encryptionInfo.encrypted).toBeTruthy();
            expect(encryptionInfo.authenticated).toBeFalsy();
            expect(encryptionInfo.sender).toBeFalsy();

            // known sender, megolm key from backup
            event.getForwardingCurve25519KeyChain = () => [];
            event.isKeySourceUntrusted = () => true;
            const device = new DeviceInfo("FLIBBLE");
            device.keys["curve25519:FLIBBLE"] =
                'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI';
            device.keys["ed25519:FLIBBLE"] =
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
            client.crypto.deviceList.getDeviceByIdentityKey = () => device;

            encryptionInfo = client.getEventEncryptionInfo(event);
            expect(encryptionInfo.encrypted).toBeTruthy();
            expect(encryptionInfo.authenticated).toBeFalsy();
            expect(encryptionInfo.sender).toBeTruthy();
            expect(encryptionInfo.mismatchedSender).toBeFalsy();

            // known sender, trusted megolm key, but bad ed25519key
            event.isKeySourceUntrusted = () => false;
            device.keys["ed25519:FLIBBLE"] =
                'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

            encryptionInfo = client.getEventEncryptionInfo(event);
            expect(encryptionInfo.encrypted).toBeTruthy();
            expect(encryptionInfo.authenticated).toBeTruthy();
            expect(encryptionInfo.sender).toBeTruthy();
            expect(encryptionInfo.mismatchedSender).toBeTruthy();

            client.stopClient();
        });
    });

    describe('Session management', function() {
        const otkResponse = {
            one_time_keys: {
                '@alice:home.server': {
                    aliceDevice: {
                        'signed_curve25519:FLIBBLE': {
                            key: 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI',
                            signatures: {
                                '@alice:home.server': {
                                    'ed25519:aliceDevice': 'totally a valid signature',
                                },
                            },
                        },
                    },
                },
            },
        };
        let crypto;
        let mockBaseApis;
        let mockRoomList;

        let fakeEmitter;

        beforeEach(async function() {
            const mockStorage = new MockStorageApi();
            const sessionStore = new WebStorageSessionStore(mockStorage);
            const cryptoStore = new MemoryCryptoStore(mockStorage);

            cryptoStore.storeEndToEndDeviceData({
                devices: {
                    '@bob:home.server': {
                        'BOBDEVICE': {
                            keys: {
                                'curve25519:BOBDEVICE': 'this is a key',
                            },
                        },
                    },
                },
                trackingStatus: {},
            });

            mockBaseApis = {
                sendToDevice: jest.fn(),
                getKeyBackupVersion: jest.fn(),
                isGuest: jest.fn(),
            };
            mockRoomList = {};

            fakeEmitter = new EventEmitter();

            crypto = new Crypto(
                mockBaseApis,
                sessionStore,
                "@alice:home.server",
                "FLIBBLE",
                sessionStore,
                cryptoStore,
                mockRoomList,
            );
            crypto.registerEventHandlers(fakeEmitter);
            await crypto.init();
        });

        afterEach(async function() {
            await crypto.stop();
        });

        it("restarts wedged Olm sessions", async function() {
            const prom = new Promise((resolve) => {
                mockBaseApis.claimOneTimeKeys = function() {
                    resolve();
                    return otkResponse;
                };
            });

            fakeEmitter.emit('toDeviceEvent', {
                getId: jest.fn().mockReturnValue("$wedged"),
                getType: jest.fn().mockReturnValue('m.room.message'),
                getContent: jest.fn().mockReturnValue({
                    msgtype: 'm.bad.encrypted',
                }),
                getWireContent: jest.fn().mockReturnValue({
                    algorithm: 'm.olm.v1.curve25519-aes-sha2',
                    sender_key: 'this is a key',
                }),
                getSender: jest.fn().mockReturnValue('@bob:home.server'),
            });

            await prom;
        });
    });

    describe('Key requests', function() {
        let aliceClient;
        let bobClient;

        beforeEach(async function() {
            aliceClient = (new TestClient(
                "@alice:example.com", "alicedevice",
            )).client;
            bobClient = (new TestClient(
                "@bob:example.com", "bobdevice",
            )).client;
            await aliceClient.initCrypto();
            await bobClient.initCrypto();
        });

        afterEach(async function() {
            aliceClient.stopClient();
            bobClient.stopClient();
        });

        it(
            "does not cancel keyshare requests if some messages are not decrypted",
            async function() {
                function awaitEvent(emitter, event) {
                    return new Promise((resolve, reject) => {
                        emitter.once(event, (result) => {
                            resolve(result);
                        });
                    });
                }

                async function keyshareEventForEvent(event, index) {
                    const eventContent = event.getWireContent();
                    const key = await aliceClient.crypto.olmDevice
                        .getInboundGroupSessionKey(
                            roomId, eventContent.sender_key, eventContent.session_id,
                            index,
                        );
                    const ksEvent = new MatrixEvent({
                        type: "m.forwarded_room_key",
                        sender: "@alice:example.com",
                        content: {
                            algorithm: olmlib.MEGOLM_ALGORITHM,
                            room_id: roomId,
                            sender_key: eventContent.sender_key,
                            sender_claimed_ed25519_key: key.sender_claimed_ed25519_key,
                            session_id: eventContent.session_id,
                            session_key: key.key,
                            chain_index: key.chain_index,
                            forwarding_curve25519_key_chain:
                            key.forwarding_curve_key_chain,
                        },
                    });
                    // make onRoomKeyEvent think this was an encrypted event
                    ksEvent.senderCurve25519Key = "akey";
                    return ksEvent;
                }

                const encryptionCfg = {
                    "algorithm": "m.megolm.v1.aes-sha2",
                };
                const roomId = "!someroom";
                const aliceRoom = new Room(roomId, aliceClient, "@alice:example.com", {});
                const bobRoom = new Room(roomId, bobClient, "@bob:example.com", {});
                aliceClient.store.storeRoom(aliceRoom);
                bobClient.store.storeRoom(bobRoom);
                await aliceClient.setRoomEncryption(roomId, encryptionCfg);
                await bobClient.setRoomEncryption(roomId, encryptionCfg);
                const events = [
                    new MatrixEvent({
                        type: "m.room.message",
                        sender: "@alice:example.com",
                        room_id: roomId,
                        event_id: "$1",
                        content: {
                            msgtype: "m.text",
                            body: "1",
                        },
                    }),
                    new MatrixEvent({
                        type: "m.room.message",
                        sender: "@alice:example.com",
                        room_id: roomId,
                        event_id: "$2",
                        content: {
                            msgtype: "m.text",
                            body: "2",
                        },
                    }),
                ];
                await Promise.all(events.map(async (event) => {
                    // alice encrypts each event, and then bob tries to decrypt
                    // them without any keys, so that they'll be in pending
                    await aliceClient.crypto.encryptEvent(event, aliceRoom);
                    event.clearEvent = undefined;
                    event.senderCurve25519Key = null;
                    event.claimedEd25519Key = null;
                    try {
                        await bobClient.crypto.decryptEvent(event);
                    } catch (e) {
                        // we expect this to fail because we don't have the
                        // decryption keys yet
                    }
                }));

                const bobDecryptor = bobClient.crypto.getRoomDecryptor(
                    roomId, olmlib.MEGOLM_ALGORITHM,
                );

                let eventPromise = Promise.all(events.map((ev) => {
                    return awaitEvent(ev, "Event.decrypted");
                }));

                // keyshare the session key starting at the second message, so
                // the first message can't be decrypted yet, but the second one
                // can
                let ksEvent = await keyshareEventForEvent(events[1], 1);
                await bobDecryptor.onRoomKeyEvent(ksEvent);
                await eventPromise;
                expect(events[0].getContent().msgtype).toBe("m.bad.encrypted");
                expect(events[1].getContent().msgtype).not.toBe("m.bad.encrypted");

                const cryptoStore = bobClient.cryptoStore;
                const eventContent = events[0].getWireContent();
                const senderKey = eventContent.sender_key;
                const sessionId = eventContent.session_id;
                const roomKeyRequestBody = {
                    algorithm: olmlib.MEGOLM_ALGORITHM,
                    room_id: roomId,
                    sender_key: senderKey,
                    session_id: sessionId,
                };
                // the room key request should still be there, since we haven't
                // decrypted everything
                expect(await cryptoStore.getOutgoingRoomKeyRequest(roomKeyRequestBody))
                    .toBeDefined();

                // keyshare the session key starting at the first message, so
                // that it can now be decrypted
                eventPromise = awaitEvent(events[0], "Event.decrypted");
                ksEvent = await keyshareEventForEvent(events[0], 0);
                await bobDecryptor.onRoomKeyEvent(ksEvent);
                await eventPromise;
                expect(events[0].getContent().msgtype).not.toBe("m.bad.encrypted");
                await sleep(1);
                // the room key request should be gone since we've now decrypted everything
                expect(await cryptoStore.getOutgoingRoomKeyRequest(roomKeyRequestBody))
                    .toBeFalsy();
            },
        );

        it("creates a new keyshare request if we request a keyshare", async function() {
            // make sure that cancelAndResend... creates a new keyshare request
            // if there wasn't an already-existing one
            const event = new MatrixEvent({
                sender: "@bob:example.com",
                room_id: "!someroom",
                content: {
                    algorithm: olmlib.MEGOLM_ALGORITHM,
                    session_id: "sessionid",
                    sender_key: "senderkey",
                },
            });
            await aliceClient.cancelAndResendEventRoomKeyRequest(event);
            const cryptoStore = aliceClient.cryptoStore;
            const roomKeyRequestBody = {
                algorithm: olmlib.MEGOLM_ALGORITHM,
                room_id: "!someroom",
                session_id: "sessionid",
                sender_key: "senderkey",
            };
            expect(await cryptoStore.getOutgoingRoomKeyRequest(roomKeyRequestBody))
                .toBeDefined();
        });

        it("uses a new txnid for re-requesting keys", async function() {
            jest.useFakeTimers();

            const event = new MatrixEvent({
                sender: "@bob:example.com",
                room_id: "!someroom",
                content: {
                    algorithm: olmlib.MEGOLM_ALGORITHM,
                    session_id: "sessionid",
                    sender_key: "senderkey",
                },
            });
            // replace Alice's sendToDevice function with a mock
            aliceClient.sendToDevice = jest.fn().mockResolvedValue(undefined);
            aliceClient.startClient();

            // make a room key request, and record the transaction ID for the
            // sendToDevice call
            await aliceClient.cancelAndResendEventRoomKeyRequest(event);
            // key requests get queued until the sync has finished, but we don't
            // let the client set up enough for that to happen, so gut-wrench a bit
            // to force it to send now.
            aliceClient.crypto.outgoingRoomKeyRequestManager.sendQueuedRequests();
            jest.runAllTimers();
            await Promise.resolve();
            expect(aliceClient.sendToDevice).toBeCalledTimes(1);
            const txnId = aliceClient.sendToDevice.mock.calls[0][2];

            // give the room key request manager time to update the state
            // of the request
            await Promise.resolve();

            // cancel and resend the room key request
            await aliceClient.cancelAndResendEventRoomKeyRequest(event);
            jest.runAllTimers();
            await Promise.resolve();
            // cancelAndResend will call sendToDevice twice:
            // the first call to sendToDevice will be the cancellation
            // the second call to sendToDevice will be the key request
            expect(aliceClient.sendToDevice).toBeCalledTimes(3);
            expect(aliceClient.sendToDevice.mock.calls[2][2]).not.toBe(txnId);
        });
    });
});
