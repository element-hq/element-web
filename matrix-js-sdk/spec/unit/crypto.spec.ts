import "../olm-loader";
// eslint-disable-next-line no-restricted-imports
import { EventEmitter } from "events";

import type { PkDecryption, PkSigning } from "@matrix-org/olm";
import { IClaimOTKsResult, MatrixClient } from "../../src/client";
import { Crypto } from "../../src/crypto";
import { MemoryCryptoStore } from "../../src/crypto/store/memory-crypto-store";
import { MockStorageApi } from "../MockStorageApi";
import { TestClient } from "../TestClient";
import { MatrixEvent } from "../../src/models/event";
import { Room } from "../../src/models/room";
import * as olmlib from "../../src/crypto/olmlib";
import { sleep } from "../../src/utils";
import { CRYPTO_ENABLED } from "../../src/client";
import { DeviceInfo } from "../../src/crypto/deviceinfo";
import { logger } from "../../src/logger";
import { MemoryStore } from "../../src";
import { RoomKeyRequestState } from "../../src/crypto/OutgoingRoomKeyRequestManager";
import { RoomMember } from "../../src/models/room-member";
import { IStore } from "../../src/store";
import { IRoomEncryption, RoomList } from "../../src/crypto/RoomList";

const Olm = global.Olm;

function awaitEvent(emitter: EventEmitter, event: string): Promise<void> {
    return new Promise((resolve) => {
        emitter.once(event, (result) => {
            resolve(result);
        });
    });
}

async function keyshareEventForEvent(client: MatrixClient, event: MatrixEvent, index?: number): Promise<MatrixEvent> {
    const roomId = event.getRoomId()!;
    const eventContent = event.getWireContent();
    const key = await client.crypto!.olmDevice.getInboundGroupSessionKey(
        roomId,
        eventContent.sender_key,
        eventContent.session_id,
        index,
    );
    const ksEvent = new MatrixEvent({
        type: "m.forwarded_room_key",
        sender: client.getUserId()!,
        content: {
            "algorithm": olmlib.MEGOLM_ALGORITHM,
            "room_id": roomId,
            "sender_key": eventContent.sender_key,
            "sender_claimed_ed25519_key": key?.sender_claimed_ed25519_key,
            "session_id": eventContent.session_id,
            "session_key": key?.key,
            "chain_index": key?.chain_index,
            "forwarding_curve25519_key_chain": key?.forwarding_curve25519_key_chain,
            "org.matrix.msc3061.shared_history": true,
        },
    });
    // make onRoomKeyEvent think this was an encrypted event
    // @ts-ignore private property
    ksEvent.senderCurve25519Key = "akey";
    ksEvent.getWireType = () => "m.room.encrypted";
    ksEvent.getWireContent = () => {
        return {
            algorithm: "m.olm.v1.curve25519-aes-sha2",
        };
    };
    return ksEvent;
}

function roomKeyEventForEvent(client: MatrixClient, event: MatrixEvent): MatrixEvent {
    const roomId = event.getRoomId();
    const eventContent = event.getWireContent();
    const key = client.crypto!.olmDevice.getOutboundGroupSessionKey(eventContent.session_id);
    const ksEvent = new MatrixEvent({
        type: "m.room_key",
        sender: client.getUserId()!,
        content: {
            algorithm: olmlib.MEGOLM_ALGORITHM,
            room_id: roomId,
            session_id: eventContent.session_id,
            session_key: key.key,
        },
    });
    // make onRoomKeyEvent think this was an encrypted event
    // @ts-ignore private property
    ksEvent.senderCurve25519Key = event.getSenderKey();
    ksEvent.getWireType = () => "m.room.encrypted";
    ksEvent.getWireContent = () => {
        return {
            algorithm: "m.olm.v1.curve25519-aes-sha2",
        };
    };
    return ksEvent;
}

describe("Crypto", function () {
    if (!CRYPTO_ENABLED) {
        return;
    }

    beforeAll(function () {
        return Olm.init();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("Crypto exposes the correct olm library version", function () {
        expect(Crypto.getOlmVersion()[0]).toEqual(3);
    });

    describe("encrypted events", function () {
        it("provides encryption information", async function () {
            const client = new TestClient("@alice:example.com", "deviceid").client;
            await client.initCrypto();

            // unencrypted event
            const event = {
                getId: () => "$event_id",
                getSenderKey: () => null,
                getWireContent: () => {
                    return {};
                },
            } as unknown as MatrixEvent;

            let encryptionInfo = client.getEventEncryptionInfo(event);
            expect(encryptionInfo.encrypted).toBeFalsy();

            // unknown sender (e.g. deleted device), forwarded megolm key (untrusted)
            event.getSenderKey = () => "YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI";
            event.getWireContent = () => {
                return { algorithm: olmlib.MEGOLM_ALGORITHM };
            };
            event.getForwardingCurve25519KeyChain = () => ["not empty"];
            event.isKeySourceUntrusted = () => true;
            event.getClaimedEd25519Key = () => "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

            encryptionInfo = client.getEventEncryptionInfo(event);
            expect(encryptionInfo.encrypted).toBeTruthy();
            expect(encryptionInfo.authenticated).toBeFalsy();
            expect(encryptionInfo.sender).toBeFalsy();

            // known sender, megolm key from backup
            event.getForwardingCurve25519KeyChain = () => [];
            event.isKeySourceUntrusted = () => true;
            const device = new DeviceInfo("FLIBBLE");
            device.keys["curve25519:FLIBBLE"] = "YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI";
            device.keys["ed25519:FLIBBLE"] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
            client.crypto!.deviceList.getDeviceByIdentityKey = () => device;

            encryptionInfo = client.getEventEncryptionInfo(event);
            expect(encryptionInfo.encrypted).toBeTruthy();
            expect(encryptionInfo.authenticated).toBeFalsy();
            expect(encryptionInfo.sender).toBeTruthy();
            expect(encryptionInfo.mismatchedSender).toBeFalsy();

            // known sender, trusted megolm key, but bad ed25519key
            event.isKeySourceUntrusted = () => false;
            device.keys["ed25519:FLIBBLE"] = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

            encryptionInfo = client.getEventEncryptionInfo(event);
            expect(encryptionInfo.encrypted).toBeTruthy();
            expect(encryptionInfo.authenticated).toBeTruthy();
            expect(encryptionInfo.sender).toBeTruthy();
            expect(encryptionInfo.mismatchedSender).toBeTruthy();

            client.stopClient();
        });

        it("doesn't throw an error when attempting to decrypt a redacted event", async () => {
            const client = new TestClient("@alice:example.com", "deviceid").client;
            await client.initCrypto();

            const event = new MatrixEvent({
                content: {},
                event_id: "$event_id",
                room_id: "!room_id",
                sender: "@bob:example.com",
                type: "m.room.encrypted",
                unsigned: {
                    redacted_because: {
                        content: {},
                        event_id: "$redaction_event_id",
                        redacts: "$event_id",
                        room_id: "!room_id",
                        origin_server_ts: 1234567890,
                        sender: "@bob:example.com",
                        type: "m.room.redaction",
                        unsigned: {},
                    },
                },
            });
            await event.attemptDecryption(client.crypto!);
            expect(event.isDecryptionFailure()).toBeFalsy();
            // since the redaction event isn't encrypted, the redacted_because
            // should be the same as in the original event
            expect(event.getRedactionEvent()).toEqual(event.getUnsigned().redacted_because);

            client.stopClient();
        });
    });

    describe("Session management", function () {
        const otkResponse: IClaimOTKsResult = {
            failures: {},
            one_time_keys: {
                "@alice:home.server": {
                    aliceDevice: {
                        "signed_curve25519:FLIBBLE": {
                            key: "YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI",
                            signatures: {
                                "@alice:home.server": {
                                    "ed25519:aliceDevice": "totally a valid signature",
                                },
                            },
                        },
                    },
                },
            },
        };

        let crypto: Crypto;
        let mockBaseApis: MatrixClient;
        let mockRoomList: RoomList;

        let fakeEmitter: EventEmitter;

        beforeEach(async function () {
            const mockStorage = new MockStorageApi() as unknown as Storage;
            const clientStore = new MemoryStore({ localStorage: mockStorage }) as unknown as IStore;
            const cryptoStore = new MemoryCryptoStore();

            cryptoStore.storeEndToEndDeviceData(
                {
                    devices: {
                        "@bob:home.server": {
                            BOBDEVICE: {
                                algorithms: [],
                                verified: 1,
                                known: false,
                                keys: {
                                    "curve25519:BOBDEVICE": "this is a key",
                                },
                            },
                        },
                    },
                    trackingStatus: {},
                },
                {},
            );

            mockBaseApis = {
                sendToDevice: jest.fn(),
                getKeyBackupVersion: jest.fn(),
                isGuest: jest.fn(),
                emit: jest.fn(),
            } as unknown as MatrixClient;
            mockRoomList = {} as unknown as RoomList;

            fakeEmitter = new EventEmitter();

            crypto = new Crypto(
                mockBaseApis,
                "@alice:home.server",
                "FLIBBLE",
                clientStore,
                cryptoStore,
                mockRoomList,
                [],
            );
            crypto.registerEventHandlers(fakeEmitter as any);
            await crypto.init();
        });

        afterEach(async function () {
            await crypto.stop();
        });

        it("restarts wedged Olm sessions", async function () {
            const prom = new Promise<void>((resolve) => {
                mockBaseApis.claimOneTimeKeys = function () {
                    resolve();
                    return Promise.resolve(otkResponse);
                };
            });

            fakeEmitter.emit("toDeviceEvent", {
                getId: jest.fn().mockReturnValue("$wedged"),
                getType: jest.fn().mockReturnValue("m.room.message"),
                getContent: jest.fn().mockReturnValue({
                    msgtype: "m.bad.encrypted",
                }),
                getWireContent: jest.fn().mockReturnValue({
                    algorithm: "m.olm.v1.curve25519-aes-sha2",
                    sender_key: "this is a key",
                }),
                getSender: jest.fn().mockReturnValue("@bob:home.server"),
            });

            await prom;
        });
    });

    describe("Key requests", function () {
        let aliceClient: MatrixClient;
        let secondAliceClient: MatrixClient;
        let bobClient: MatrixClient;
        let claraClient: MatrixClient;

        beforeEach(async function () {
            aliceClient = new TestClient("@alice:example.com", "alicedevice").client;
            secondAliceClient = new TestClient("@alice:example.com", "secondAliceDevice").client;
            bobClient = new TestClient("@bob:example.com", "bobdevice").client;
            claraClient = new TestClient("@clara:example.com", "claradevice").client;
            await aliceClient.initCrypto();
            await secondAliceClient.initCrypto();
            await bobClient.initCrypto();
            await claraClient.initCrypto();
        });

        afterEach(async function () {
            aliceClient.stopClient();
            secondAliceClient.stopClient();
            bobClient.stopClient();
            claraClient.stopClient();
        });

        it("does not cancel keyshare requests until all messages are decrypted with trusted keys", async function () {
            const encryptionCfg = {
                algorithm: "m.megolm.v1.aes-sha2",
            };
            const roomId = "!someroom";
            const aliceRoom = new Room(roomId, aliceClient, "@alice:example.com", {});
            const bobRoom = new Room(roomId, bobClient, "@bob:example.com", {});
            // Make Bob invited by Alice so Bob will accept Alice's forwarded keys
            bobRoom.currentState.setStateEvents([
                new MatrixEvent({
                    type: "m.room.member",
                    sender: "@alice:example.com",
                    room_id: roomId,
                    content: { membership: "invite" },
                    state_key: "@bob:example.com",
                }),
            ]);
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
            await Promise.all(
                events.map(async (event) => {
                    // alice encrypts each event, and then bob tries to decrypt
                    // them without any keys, so that they'll be in pending
                    await aliceClient.crypto!.encryptEvent(event, aliceRoom);
                    // remove keys from the event
                    // @ts-ignore private properties
                    event.clearEvent = undefined;
                    // @ts-ignore private properties
                    event.senderCurve25519Key = null;
                    // @ts-ignore private properties
                    event.claimedEd25519Key = null;
                    await expect(bobClient.crypto!.decryptEvent(event)).rejects.toBeTruthy();
                }),
            );

            const device = new DeviceInfo(aliceClient.deviceId!);
            bobClient.crypto!.deviceList.getDeviceByIdentityKey = () => device;

            const bobDecryptor = bobClient.crypto!.getRoomDecryptor(roomId, olmlib.MEGOLM_ALGORITHM);

            const decryptEventsPromise = Promise.all(
                events.map((ev) => {
                    return awaitEvent(ev, "Event.decrypted");
                }),
            );

            // keyshare the session key starting at the second message, so
            // the first message can't be decrypted yet, but the second one
            // can
            let ksEvent = await keyshareEventForEvent(aliceClient, events[1], 1);
            bobClient.crypto!.deviceList.downloadKeys = () => Promise.resolve(new Map());
            bobClient.crypto!.deviceList.getUserByIdentityKey = () => "@alice:example.com";
            await bobDecryptor.onRoomKeyEvent(ksEvent);
            await decryptEventsPromise;
            expect(events[0].getContent().msgtype).toBe("m.bad.encrypted");
            expect(events[1].getContent().msgtype).not.toBe("m.bad.encrypted");

            const cryptoStore = bobClient.crypto!.cryptoStore;
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
            expect(await cryptoStore.getOutgoingRoomKeyRequest(roomKeyRequestBody)).toBeDefined();

            // keyshare the session key starting at the first message, so
            // that it can now be decrypted
            const decryptEventPromise = awaitEvent(events[0], "Event.decrypted");
            ksEvent = await keyshareEventForEvent(aliceClient, events[0], 0);
            await bobDecryptor.onRoomKeyEvent(ksEvent);
            await decryptEventPromise;
            expect(events[0].getContent().msgtype).not.toBe("m.bad.encrypted");
            expect(events[0].isKeySourceUntrusted()).toBeTruthy();
            await sleep(1);
            // the room key request should still be there, since we've
            // decrypted everything with an untrusted key
            expect(await cryptoStore.getOutgoingRoomKeyRequest(roomKeyRequestBody)).toBeDefined();

            // Now share a trusted room key event so Bob will re-decrypt the messages.
            // Bob will backfill trust when they receive a trusted session with a higher
            // index that connects to an untrusted session with a lower index.
            const roomKeyEvent = roomKeyEventForEvent(aliceClient, events[1]);
            const trustedDecryptEventPromise = awaitEvent(events[0], "Event.decrypted");
            await bobDecryptor.onRoomKeyEvent(roomKeyEvent);
            await trustedDecryptEventPromise;
            expect(events[0].getContent().msgtype).not.toBe("m.bad.encrypted");
            expect(events[0].isKeySourceUntrusted()).toBeFalsy();
            await sleep(1);
            // now the room key request should be gone, since there's
            // no better key to wait for
            expect(await cryptoStore.getOutgoingRoomKeyRequest(roomKeyRequestBody)).toBeFalsy();
        });

        it("should error if a forwarded room key lacks a content.sender_key", async function () {
            const encryptionCfg = {
                algorithm: "m.megolm.v1.aes-sha2",
            };
            const roomId = "!someroom";
            const aliceRoom = new Room(roomId, aliceClient, "@alice:example.com", {});
            const bobRoom = new Room(roomId, bobClient, "@bob:example.com", {});
            aliceClient.store.storeRoom(aliceRoom);
            bobClient.store.storeRoom(bobRoom);
            await aliceClient.setRoomEncryption(roomId, encryptionCfg);
            await bobClient.setRoomEncryption(roomId, encryptionCfg);
            const event = new MatrixEvent({
                type: "m.room.message",
                sender: "@alice:example.com",
                room_id: roomId,
                event_id: "$1",
                content: {
                    msgtype: "m.text",
                    body: "1",
                },
            });
            // alice encrypts each event, and then bob tries to decrypt
            // them without any keys, so that they'll be in pending
            await aliceClient.crypto!.encryptEvent(event, aliceRoom);
            // remove keys from the event
            // @ts-ignore private property
            event.clearEvent = undefined;
            // @ts-ignore private property
            event.senderCurve25519Key = null;
            // @ts-ignore private property
            event.claimedEd25519Key = null;
            try {
                await bobClient.crypto!.decryptEvent(event);
            } catch (e) {
                // we expect this to fail because we don't have the
                // decryption keys yet
            }

            const device = new DeviceInfo(aliceClient.deviceId!);
            bobClient.crypto!.deviceList.getDeviceByIdentityKey = () => device;

            const bobDecryptor = bobClient.crypto!.getRoomDecryptor(roomId, olmlib.MEGOLM_ALGORITHM);

            const ksEvent = await keyshareEventForEvent(aliceClient, event, 1);
            ksEvent.getContent().sender_key = undefined; // test
            bobClient.crypto!.olmDevice.addInboundGroupSession = jest.fn();
            await bobDecryptor.onRoomKeyEvent(ksEvent);
            expect(bobClient.crypto!.olmDevice.addInboundGroupSession).not.toHaveBeenCalled();
        });

        it("creates a new keyshare request if we request a keyshare", async function () {
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
            const cryptoStore = aliceClient.crypto!.cryptoStore;
            const roomKeyRequestBody = {
                algorithm: olmlib.MEGOLM_ALGORITHM,
                room_id: "!someroom",
                session_id: "sessionid",
                sender_key: "senderkey",
            };
            expect(await cryptoStore.getOutgoingRoomKeyRequest(roomKeyRequestBody)).toBeDefined();
        });

        it("uses a new txnid for re-requesting keys", async function () {
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
            const aliceSendToDevice = jest.fn().mockResolvedValue(undefined);
            aliceClient.sendToDevice = aliceSendToDevice;
            aliceClient.startClient();

            // make a room key request, and record the transaction ID for the
            // sendToDevice call
            await aliceClient.cancelAndResendEventRoomKeyRequest(event);
            // key requests get queued until the sync has finished, but we don't
            // let the client set up enough for that to happen, so gut-wrench a bit
            // to force it to send now.
            // @ts-ignore
            aliceClient.crypto!.outgoingRoomKeyRequestManager.sendQueuedRequests();
            jest.runAllTimers();
            await Promise.resolve();
            expect(aliceSendToDevice).toHaveBeenCalledTimes(1);
            const txnId = aliceSendToDevice.mock.calls[0][2];

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
            expect(aliceSendToDevice).toHaveBeenCalledTimes(3);
            expect(aliceSendToDevice.mock.calls[2][2]).not.toBe(txnId);
        });

        it("should accept forwarded keys it requested from one of its own user's other devices", async function () {
            const encryptionCfg = {
                algorithm: "m.megolm.v1.aes-sha2",
            };
            const roomId = "!someroom";
            const aliceRoom = new Room(roomId, aliceClient, "@alice:example.com", {});
            const bobRoom = new Room(roomId, secondAliceClient, "@alice:example.com", {});
            aliceClient.store.storeRoom(aliceRoom);
            secondAliceClient.store.storeRoom(bobRoom);
            await aliceClient.setRoomEncryption(roomId, encryptionCfg);
            await secondAliceClient.setRoomEncryption(roomId, encryptionCfg);
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
            await Promise.all(
                events.map(async (event) => {
                    // alice encrypts each event, and then bob tries to decrypt
                    // them without any keys, so that they'll be in pending
                    await aliceClient.crypto!.encryptEvent(event, aliceRoom);
                    // remove keys from the event
                    // @ts-ignore private properties
                    event.clearEvent = undefined;
                    // @ts-ignore private properties
                    event.senderCurve25519Key = null;
                    // @ts-ignore private properties
                    event.claimedEd25519Key = null;
                    await expect(secondAliceClient.crypto!.decryptEvent(event)).rejects.toBeTruthy();
                }),
            );

            const device = new DeviceInfo(aliceClient.deviceId!);
            device.verified = DeviceInfo.DeviceVerification.VERIFIED;
            secondAliceClient.crypto!.deviceList.getDeviceByIdentityKey = () => device;
            secondAliceClient.crypto!.deviceList.getUserByIdentityKey = () => "@alice:example.com";

            const cryptoStore = secondAliceClient.crypto!.cryptoStore;
            const eventContent = events[0].getWireContent();
            const senderKey = eventContent.sender_key;
            const sessionId = eventContent.session_id;
            const roomKeyRequestBody = {
                algorithm: olmlib.MEGOLM_ALGORITHM,
                room_id: roomId,
                sender_key: senderKey,
                session_id: sessionId,
            };
            const outgoingReq = await cryptoStore.getOutgoingRoomKeyRequest(roomKeyRequestBody);
            expect(outgoingReq).toBeDefined();
            await cryptoStore.updateOutgoingRoomKeyRequest(outgoingReq!.requestId, RoomKeyRequestState.Unsent, {
                state: RoomKeyRequestState.Sent,
            });

            const bobDecryptor = secondAliceClient.crypto!.getRoomDecryptor(roomId, olmlib.MEGOLM_ALGORITHM);

            const decryptEventsPromise = Promise.all(
                events.map((ev) => {
                    return awaitEvent(ev, "Event.decrypted");
                }),
            );
            const ksEvent = await keyshareEventForEvent(aliceClient, events[0], 0);
            await bobDecryptor.onRoomKeyEvent(ksEvent);
            const key = await secondAliceClient.crypto!.olmDevice.getInboundGroupSessionKey(
                roomId,
                events[0].getWireContent().sender_key,
                events[0].getWireContent().session_id,
            );
            expect(key).not.toBeNull();
            await decryptEventsPromise;
            expect(events[0].getContent().msgtype).not.toBe("m.bad.encrypted");
            expect(events[1].getContent().msgtype).not.toBe("m.bad.encrypted");
        });

        it("should accept forwarded keys from the user who invited it to the room", async function () {
            const encryptionCfg = {
                algorithm: "m.megolm.v1.aes-sha2",
            };
            const roomId = "!someroom";
            const aliceRoom = new Room(roomId, aliceClient, "@alice:example.com", {});
            const bobRoom = new Room(roomId, bobClient, "@bob:example.com", {});
            const claraRoom = new Room(roomId, claraClient, "@clara:example.com", {});
            // Make Bob invited by Clara
            bobRoom.currentState.setStateEvents([
                new MatrixEvent({
                    type: "m.room.member",
                    sender: "@clara:example.com",
                    room_id: roomId,
                    content: { membership: "invite" },
                    state_key: "@bob:example.com",
                }),
            ]);
            aliceClient.store.storeRoom(aliceRoom);
            bobClient.store.storeRoom(bobRoom);
            claraClient.store.storeRoom(claraRoom);
            await aliceClient.setRoomEncryption(roomId, encryptionCfg);
            await bobClient.setRoomEncryption(roomId, encryptionCfg);
            await claraClient.setRoomEncryption(roomId, encryptionCfg);
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
            await Promise.all(
                events.map(async (event) => {
                    // alice encrypts each event, and then bob tries to decrypt
                    // them without any keys, so that they'll be in pending
                    await aliceClient.crypto!.encryptEvent(event, aliceRoom);
                    // remove keys from the event
                    // @ts-ignore private properties
                    event.clearEvent = undefined;
                    // @ts-ignore private properties
                    event.senderCurve25519Key = null;
                    // @ts-ignore private properties
                    event.claimedEd25519Key = null;
                    await expect(bobClient.crypto!.decryptEvent(event)).rejects.toBeTruthy();
                }),
            );

            const device = new DeviceInfo(claraClient.deviceId!);
            bobClient.crypto!.deviceList.getDeviceByIdentityKey = () => device;
            bobClient.crypto!.deviceList.getUserByIdentityKey = () => "@clara:example.com";

            const bobDecryptor = bobClient.crypto!.getRoomDecryptor(roomId, olmlib.MEGOLM_ALGORITHM);

            const decryptEventsPromise = Promise.all(
                events.map((ev) => {
                    return awaitEvent(ev, "Event.decrypted");
                }),
            );
            const ksEvent = await keyshareEventForEvent(aliceClient, events[0], 0);
            ksEvent.event.sender = claraClient.getUserId()!;
            ksEvent.sender = new RoomMember(roomId, claraClient.getUserId()!);
            await bobDecryptor.onRoomKeyEvent(ksEvent);
            const key = await bobClient.crypto!.olmDevice.getInboundGroupSessionKey(
                roomId,
                events[0].getWireContent().sender_key,
                events[0].getWireContent().session_id,
            );
            expect(key).not.toBeNull();
            await decryptEventsPromise;
            expect(events[0].getContent().msgtype).not.toBe("m.bad.encrypted");
            expect(events[1].getContent().msgtype).not.toBe("m.bad.encrypted");
        });

        it("should not accept requested forwarded keys from other users", async function () {
            const encryptionCfg = {
                algorithm: "m.megolm.v1.aes-sha2",
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
            await Promise.all(
                events.map(async (event) => {
                    // alice encrypts each event, and then bob tries to decrypt
                    // them without any keys, so that they'll be in pending
                    await aliceClient.crypto!.encryptEvent(event, aliceRoom);
                    // remove keys from the event
                    // @ts-ignore private properties
                    event.clearEvent = undefined;
                    // @ts-ignore private properties
                    event.senderCurve25519Key = null;
                    // @ts-ignore private properties
                    event.claimedEd25519Key = null;
                    await expect(bobClient.crypto!.decryptEvent(event)).rejects.toBeTruthy();
                }),
            );

            const cryptoStore = bobClient.crypto!.cryptoStore;
            const eventContent = events[0].getWireContent();
            const senderKey = eventContent.sender_key;
            const sessionId = eventContent.session_id;
            const roomKeyRequestBody = {
                algorithm: olmlib.MEGOLM_ALGORITHM,
                room_id: roomId,
                sender_key: senderKey,
                session_id: sessionId,
            };
            const outgoingReq = await cryptoStore.getOutgoingRoomKeyRequest(roomKeyRequestBody);
            expect(outgoingReq).toBeDefined();
            await cryptoStore.updateOutgoingRoomKeyRequest(outgoingReq!.requestId, RoomKeyRequestState.Unsent, {
                state: RoomKeyRequestState.Sent,
            });

            const device = new DeviceInfo(aliceClient.deviceId!);
            device.verified = DeviceInfo.DeviceVerification.VERIFIED;
            bobClient.crypto!.deviceList.getDeviceByIdentityKey = () => device;
            bobClient.crypto!.deviceList.getUserByIdentityKey = () => "@alice:example.com";

            const bobDecryptor = bobClient.crypto!.getRoomDecryptor(roomId, olmlib.MEGOLM_ALGORITHM);

            const ksEvent = await keyshareEventForEvent(aliceClient, events[0], 0);
            ksEvent.event.sender = aliceClient.getUserId()!;
            ksEvent.sender = new RoomMember(roomId, aliceClient.getUserId()!);
            await bobDecryptor.onRoomKeyEvent(ksEvent);
            const key = await bobClient.crypto!.olmDevice.getInboundGroupSessionKey(
                roomId,
                events[0].getWireContent().sender_key,
                events[0].getWireContent().session_id,
            );
            expect(key).toBeNull();
        });

        it("should not accept unexpected forwarded keys for a room it's in", async function () {
            const encryptionCfg = {
                algorithm: "m.megolm.v1.aes-sha2",
            };
            const roomId = "!someroom";
            const aliceRoom = new Room(roomId, aliceClient, "@alice:example.com", {});
            const bobRoom = new Room(roomId, bobClient, "@bob:example.com", {});
            const claraRoom = new Room(roomId, claraClient, "@clara:example.com", {});
            aliceClient.store.storeRoom(aliceRoom);
            bobClient.store.storeRoom(bobRoom);
            claraClient.store.storeRoom(claraRoom);
            await aliceClient.setRoomEncryption(roomId, encryptionCfg);
            await bobClient.setRoomEncryption(roomId, encryptionCfg);
            await claraClient.setRoomEncryption(roomId, encryptionCfg);
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
            await Promise.all(
                events.map(async (event) => {
                    // alice encrypts each event, and then bob tries to decrypt
                    // them without any keys, so that they'll be in pending
                    await aliceClient.crypto!.encryptEvent(event, aliceRoom);
                    // remove keys from the event
                    // @ts-ignore private properties
                    event.clearEvent = undefined;
                    // @ts-ignore private properties
                    event.senderCurve25519Key = null;
                    // @ts-ignore private properties
                    event.claimedEd25519Key = null;
                    await expect(bobClient.crypto!.decryptEvent(event)).rejects.toBeTruthy();
                }),
            );

            const device = new DeviceInfo(claraClient.deviceId!);
            bobClient.crypto!.deviceList.getDeviceByIdentityKey = () => device;
            bobClient.crypto!.deviceList.getUserByIdentityKey = () => "@alice:example.com";

            const bobDecryptor = bobClient.crypto!.getRoomDecryptor(roomId, olmlib.MEGOLM_ALGORITHM);

            const ksEvent = await keyshareEventForEvent(aliceClient, events[0], 0);
            ksEvent.event.sender = claraClient.getUserId()!;
            ksEvent.sender = new RoomMember(roomId, claraClient.getUserId()!);
            await bobDecryptor.onRoomKeyEvent(ksEvent);
            const key = await bobClient.crypto!.olmDevice.getInboundGroupSessionKey(
                roomId,
                events[0].getWireContent().sender_key,
                events[0].getWireContent().session_id,
            );
            expect(key).toBeNull();
        });

        it("should park forwarded keys for a room it's not in", async function () {
            const encryptionCfg = {
                algorithm: "m.megolm.v1.aes-sha2",
            };
            const roomId = "!someroom";
            const aliceRoom = new Room(roomId, aliceClient, "@alice:example.com", {});
            aliceClient.store.storeRoom(aliceRoom);
            await aliceClient.setRoomEncryption(roomId, encryptionCfg);
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
            await Promise.all(
                events.map(async (event) => {
                    // alice encrypts each event, and then bob tries to decrypt
                    // them without any keys, so that they'll be in pending
                    await aliceClient.crypto!.encryptEvent(event, aliceRoom);
                    // remove keys from the event
                    // @ts-ignore private properties
                    event.clearEvent = undefined;
                    // @ts-ignore private properties
                    event.senderCurve25519Key = null;
                    // @ts-ignore private properties
                    event.claimedEd25519Key = null;
                }),
            );

            const device = new DeviceInfo(aliceClient.deviceId!);
            bobClient.crypto!.deviceList.getDeviceByIdentityKey = () => device;
            bobClient.crypto!.deviceList.getUserByIdentityKey = () => "@alice:example.com";

            const bobDecryptor = bobClient.crypto!.getRoomDecryptor(roomId, olmlib.MEGOLM_ALGORITHM);

            const content = events[0].getWireContent();

            const ksEvent = await keyshareEventForEvent(aliceClient, events[0], 0);
            await bobDecryptor.onRoomKeyEvent(ksEvent);
            const bobKey = await bobClient.crypto!.olmDevice.getInboundGroupSessionKey(
                roomId,
                content.sender_key,
                content.session_id,
            );
            expect(bobKey).toBeNull();

            const aliceKey = await aliceClient.crypto!.olmDevice.getInboundGroupSessionKey(
                roomId,
                content.sender_key,
                content.session_id,
            );
            const parked = await bobClient.crypto!.cryptoStore.takeParkedSharedHistory(roomId);
            expect(parked).toEqual([
                {
                    senderId: aliceClient.getUserId(),
                    senderKey: content.sender_key,
                    sessionId: content.session_id,
                    sessionKey: aliceKey!.key,
                    keysClaimed: { ed25519: aliceKey!.sender_claimed_ed25519_key },
                    forwardingCurve25519KeyChain: ["akey"],
                },
            ]);
        });
    });

    describe("Secret storage", function () {
        it("creates secret storage even if there is no keyInfo", async function () {
            jest.spyOn(logger, "log").mockImplementation(() => {});
            jest.setTimeout(10000);
            const client = new TestClient("@a:example.com", "dev").client;
            await client.initCrypto();
            client.crypto!.isCrossSigningReady = async () => false;
            client.crypto!.baseApis.uploadDeviceSigningKeys = jest.fn().mockResolvedValue(null);
            client.crypto!.baseApis.setAccountData = jest.fn().mockResolvedValue(null);
            client.crypto!.baseApis.uploadKeySignatures = jest.fn();
            client.crypto!.baseApis.http.authedRequest = jest.fn();
            const createSecretStorageKey = async () => {
                return {
                    keyInfo: undefined, // Returning undefined here used to cause a crash
                    privateKey: Uint8Array.of(32, 33),
                };
            };
            await client.crypto!.bootstrapSecretStorage({
                createSecretStorageKey,
            });
            client.stopClient();
        });
    });

    describe("encryptAndSendToDevices", () => {
        let client: TestClient;
        let ensureOlmSessionsForDevices: jest.SpiedFunction<typeof olmlib.ensureOlmSessionsForDevices>;
        let encryptMessageForDevice: jest.SpiedFunction<typeof olmlib.encryptMessageForDevice>;
        const payload = { hello: "world" };
        let encryptedPayload: object;

        beforeEach(async () => {
            ensureOlmSessionsForDevices = jest.spyOn(olmlib, "ensureOlmSessionsForDevices");
            ensureOlmSessionsForDevices.mockResolvedValue(new Map());
            encryptMessageForDevice = jest.spyOn(olmlib, "encryptMessageForDevice");
            encryptMessageForDevice.mockImplementation(async (...[result, , , , , , payload]) => {
                result.plaintext = { type: 0, body: JSON.stringify(payload) };
            });

            client = new TestClient("@alice:example.org", "aliceweb");

            // running initCrypto should trigger a key upload
            client.httpBackend.when("POST", "/keys/upload").respond(200, {});
            await Promise.all([client.client.initCrypto(), client.httpBackend.flush("/keys/upload", 1)]);

            encryptedPayload = {
                algorithm: "m.olm.v1.curve25519-aes-sha2",
                sender_key: client.client.crypto!.olmDevice.deviceCurve25519Key,
                ciphertext: { plaintext: { type: 0, body: JSON.stringify(payload) } },
            };
        });

        afterEach(async () => {
            ensureOlmSessionsForDevices.mockRestore();
            encryptMessageForDevice.mockRestore();
            await client.stop();
        });

        it("encrypts and sends to devices", async () => {
            client.httpBackend
                .when("PUT", "/sendToDevice/m.room.encrypted")
                .check((request) => {
                    const data = request.data;
                    delete data.messages["@bob:example.org"]["bobweb"]["org.matrix.msgid"];
                    delete data.messages["@bob:example.org"]["bobmobile"]["org.matrix.msgid"];
                    delete data.messages["@carol:example.org"]["caroldesktop"]["org.matrix.msgid"];
                    expect(data).toStrictEqual({
                        messages: {
                            "@bob:example.org": {
                                bobweb: encryptedPayload,
                                bobmobile: encryptedPayload,
                            },
                            "@carol:example.org": {
                                caroldesktop: encryptedPayload,
                            },
                        },
                    });
                })
                .respond(200, {});

            await Promise.all([
                client.client.encryptAndSendToDevices(
                    [
                        { userId: "@bob:example.org", deviceInfo: new DeviceInfo("bobweb") },
                        { userId: "@bob:example.org", deviceInfo: new DeviceInfo("bobmobile") },
                        { userId: "@carol:example.org", deviceInfo: new DeviceInfo("caroldesktop") },
                    ],
                    payload,
                ),
                client.httpBackend.flushAllExpected(),
            ]);
        });

        it("sends nothing to devices that couldn't be encrypted to", async () => {
            encryptMessageForDevice.mockImplementation(async (...[result, , , , userId, device, payload]) => {
                // Refuse to encrypt to Carol's desktop device
                if (userId === "@carol:example.org" && device.deviceId === "caroldesktop") return;
                result.plaintext = { type: 0, body: JSON.stringify(payload) };
            });

            client.httpBackend
                .when("PUT", "/sendToDevice/m.room.encrypted")
                .check((req) => {
                    const data = req.data;
                    delete data.messages["@bob:example.org"]["bobweb"]["org.matrix.msgid"];
                    // Carol is nowhere to be seen
                    expect(data).toStrictEqual({
                        messages: { "@bob:example.org": { bobweb: encryptedPayload } },
                    });
                })
                .respond(200, {});

            await Promise.all([
                client.client.encryptAndSendToDevices(
                    [
                        { userId: "@bob:example.org", deviceInfo: new DeviceInfo("bobweb") },
                        { userId: "@carol:example.org", deviceInfo: new DeviceInfo("caroldesktop") },
                    ],
                    payload,
                ),
                client.httpBackend.flushAllExpected(),
            ]);
        });

        it("no-ops if no devices can be encrypted to", async () => {
            // Refuse to encrypt to anybody
            encryptMessageForDevice.mockResolvedValue(undefined);

            // Get the room keys version request out of the way
            client.httpBackend.when("GET", "/room_keys/version").respond(404, {});
            await client.httpBackend.flush("/room_keys/version", 1);

            await client.client.encryptAndSendToDevices(
                [{ userId: "@bob:example.org", deviceInfo: new DeviceInfo("bobweb") }],
                payload,
            );
            client.httpBackend.verifyNoOutstandingRequests();
        });
    });

    describe("checkSecretStoragePrivateKey", () => {
        let client: TestClient;

        beforeEach(async () => {
            client = new TestClient("@alice:example.org", "aliceweb");
            await client.client.initCrypto();
        });

        afterEach(async () => {
            await client.stop();
        });

        it("should free PkDecryption", () => {
            const free = jest.fn();
            jest.spyOn(Olm, "PkDecryption").mockImplementation(
                () =>
                    ({
                        init_with_private_key: jest.fn(),
                        free,
                    } as unknown as PkDecryption),
            );
            client.client.checkSecretStoragePrivateKey(new Uint8Array(), "");
            expect(free).toHaveBeenCalled();
        });
    });

    describe("checkCrossSigningPrivateKey", () => {
        let client: TestClient;

        beforeEach(async () => {
            client = new TestClient("@alice:example.org", "aliceweb");
            await client.client.initCrypto();
        });

        afterEach(async () => {
            await client.stop();
        });

        it("should free PkSigning", () => {
            const free = jest.fn();
            jest.spyOn(Olm, "PkSigning").mockImplementation(
                () =>
                    ({
                        init_with_seed: jest.fn(),
                        free,
                    } as unknown as PkSigning),
            );
            client.client.checkCrossSigningPrivateKey(new Uint8Array(), "");
            expect(free).toHaveBeenCalled();
        });
    });

    describe("start", () => {
        let client: TestClient;

        beforeEach(async () => {
            client = new TestClient("@alice:example.org", "aliceweb");
            await client.client.initCrypto();
        });

        afterEach(async function () {
            await client!.stop();
        });

        // start() is a no-op nowadays, so there's not much to test here.
        it("should complete successfully", async () => {
            await client!.client.crypto!.start();
        });
    });

    describe("setRoomEncryption", () => {
        let mockClient: MatrixClient;
        let mockRoomList: RoomList;
        let clientStore: IStore;
        let crypto: Crypto;

        beforeEach(async function () {
            mockClient = {} as MatrixClient;
            const mockStorage = new MockStorageApi() as unknown as Storage;
            clientStore = new MemoryStore({ localStorage: mockStorage }) as unknown as IStore;
            const cryptoStore = new MemoryCryptoStore();

            mockRoomList = {
                getRoomEncryption: jest.fn().mockReturnValue(null),
                setRoomEncryption: jest.fn().mockResolvedValue(undefined),
            } as unknown as RoomList;

            crypto = new Crypto(
                mockClient,
                "@alice:home.server",
                "FLIBBLE",
                clientStore,
                cryptoStore,
                mockRoomList,
                [],
            );
        });

        it("should set the algorithm if called for a known room", async () => {
            const room = new Room("!room:id", mockClient, "@my.user:id");
            await clientStore.storeRoom(room);
            await crypto.setRoomEncryption("!room:id", { algorithm: "m.megolm.v1.aes-sha2" } as IRoomEncryption);
            expect(mockRoomList!.setRoomEncryption).toHaveBeenCalledTimes(1);
            expect(jest.mocked(mockRoomList!.setRoomEncryption).mock.calls[0][0]).toEqual("!room:id");
        });

        it("should raise if called for an unknown room", async () => {
            await expect(async () => {
                await crypto.setRoomEncryption("!room:id", { algorithm: "m.megolm.v1.aes-sha2" } as IRoomEncryption);
            }).rejects.toThrow(/unknown room/);
            expect(mockRoomList!.setRoomEncryption).not.toHaveBeenCalled();
        });
    });
});
