/*
Copyright 2016 OpenMarket Ltd
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

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
import fetchMock from "fetch-mock-jest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { MockResponse, MockResponseFunction } from "fetch-mock";

import type { IDeviceKeys } from "../../../src/@types/crypto";
import * as testUtils from "../../test-utils/test-utils";
import { CRYPTO_BACKENDS, InitCrypto, syncPromise } from "../../test-utils/test-utils";
import { TestClient } from "../../TestClient";
import { logger } from "../../../src/logger";
import {
    createClient,
    IClaimOTKsResult,
    IContent,
    IDownloadKeyResult,
    IEvent,
    IJoinedRoom,
    IndexedDBCryptoStore,
    IStartClientOpts,
    ISyncResponse,
    MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    PendingEventOrdering,
    Room,
    RoomMember,
    RoomStateEvent,
} from "../../../src/matrix";
import { DeviceInfo } from "../../../src/crypto/deviceinfo";
import { E2EKeyReceiver, IE2EKeyReceiver } from "../../test-utils/E2EKeyReceiver";
import { ISyncResponder, SyncResponder } from "../../test-utils/SyncResponder";
import { escapeRegExp } from "../../../src/utils";
import { downloadDeviceToJsDevice } from "../../../src/rust-crypto/device-converter";
import { flushPromises } from "../../test-utils/flushPromises";
import { mockInitialApiRequests } from "../../test-utils/mockEndpoints";

const ROOM_ID = "!room:id";

afterEach(() => {
    // reset fake-indexeddb after each test, to make sure we don't leak connections
    // cf https://github.com/dumbmatter/fakeIndexedDB#wipingresetting-the-indexeddb-for-a-fresh-state
    // eslint-disable-next-line no-global-assign
    indexedDB = new IDBFactory();
});

// start an Olm session with a given recipient
async function createOlmSession(olmAccount: Olm.Account, recipientTestClient: IE2EKeyReceiver): Promise<Olm.Session> {
    const keys = await recipientTestClient.awaitOneTimeKeyUpload();
    const otkId = Object.keys(keys)[0];
    const otk = keys[otkId];

    const session = new global.Olm.Session();
    session.create_outbound(olmAccount, recipientTestClient.getDeviceKey(), otk.key);
    return session;
}

// IToDeviceEvent isn't exported by src/sync-accumulator.ts
interface ToDeviceEvent {
    content: IContent;
    sender: string;
    type: string;
}

/** encrypt an event with an existing olm session */
function encryptOlmEvent(opts: {
    /** the sender's user id */
    sender?: string;
    /** the sender's curve25519 key */
    senderKey: string;
    /** the sender's ed25519 key */
    senderSigningKey: string;
    /** the olm session to use for encryption */
    p2pSession: Olm.Session;
    /** the recipient's user id */
    recipient: string;
    /** the recipient's curve25519 key */
    recipientCurve25519Key: string;
    /** the recipient's ed25519 key */
    recipientEd25519Key: string;
    /** the payload of the message */
    plaincontent?: object;
    /** the event type of the payload */
    plaintype?: string;
}): ToDeviceEvent {
    expect(opts.senderKey).toBeTruthy();
    expect(opts.p2pSession).toBeTruthy();
    expect(opts.recipient).toBeTruthy();

    const plaintext = {
        content: opts.plaincontent || {},
        recipient: opts.recipient,
        recipient_keys: {
            ed25519: opts.recipientEd25519Key,
        },
        keys: {
            ed25519: opts.senderSigningKey,
        },
        sender: opts.sender || "@bob:xyz",
        type: opts.plaintype || "m.test",
    };

    return {
        content: {
            algorithm: "m.olm.v1.curve25519-aes-sha2",
            ciphertext: {
                [opts.recipientCurve25519Key]: opts.p2pSession.encrypt(JSON.stringify(plaintext)),
            },
            sender_key: opts.senderKey,
        },
        sender: opts.sender || "@bob:xyz",
        type: "m.room.encrypted",
    };
}

// encrypt an event with megolm
function encryptMegolmEvent(opts: {
    senderKey: string;
    groupSession: Olm.OutboundGroupSession;
    plaintext?: Partial<IEvent>;
    room_id?: string;
}): IEvent {
    expect(opts.senderKey).toBeTruthy();
    expect(opts.groupSession).toBeTruthy();

    const plaintext = opts.plaintext || {};
    if (!plaintext.content) {
        plaintext.content = {
            body: "42",
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
    return encryptMegolmEventRawPlainText({ senderKey: opts.senderKey, groupSession: opts.groupSession, plaintext });
}

function encryptMegolmEventRawPlainText(opts: {
    senderKey: string;
    groupSession: Olm.OutboundGroupSession;
    plaintext: Partial<IEvent>;
}): IEvent {
    return {
        event_id: "$test_megolm_event_" + Math.random(),
        sender: "@not_the_real_sender:example.com",
        origin_server_ts: 1672944778000,
        content: {
            algorithm: "m.megolm.v1.aes-sha2",
            ciphertext: opts.groupSession.encrypt(JSON.stringify(opts.plaintext)),
            device_id: "testDevice",
            sender_key: opts.senderKey,
            session_id: opts.groupSession.session_id(),
        },
        type: "m.room.encrypted",
        unsigned: {},
    };
}

/** build an encrypted room_key event to share a group session, using an existing olm session */
function encryptGroupSessionKey(opts: {
    /** recipient's user id */
    recipient: string;
    /** the recipient's curve25519 key */
    recipientCurve25519Key: string;
    /** the recipient's ed25519 key */
    recipientEd25519Key: string;
    /** sender's olm account */
    olmAccount: Olm.Account;
    /** sender's olm session with the recipient */
    p2pSession: Olm.Session;
    groupSession: Olm.OutboundGroupSession;
    room_id?: string;
}): Partial<IEvent> {
    const senderKeys = JSON.parse(opts.olmAccount.identity_keys());
    return encryptOlmEvent({
        senderKey: senderKeys.curve25519,
        senderSigningKey: senderKeys.ed25519,
        recipient: opts.recipient,
        recipientCurve25519Key: opts.recipientCurve25519Key,
        recipientEd25519Key: opts.recipientEd25519Key,
        p2pSession: opts.p2pSession,
        plaincontent: {
            algorithm: "m.megolm.v1.aes-sha2",
            room_id: opts.room_id,
            session_id: opts.groupSession.session_id(),
            session_key: opts.groupSession.session_key(),
        },
        plaintype: "m.room_key",
    });
}

// get a /sync response which contains a single room (ROOM_ID), with the members given
function getSyncResponse(roomMembers: string[]): ISyncResponse {
    const roomResponse: IJoinedRoom = {
        summary: {
            "m.heroes": [],
            "m.joined_member_count": roomMembers.length,
            "m.invited_member_count": roomMembers.length,
        },
        state: {
            events: [
                testUtils.mkEventCustom({
                    sender: roomMembers[0],
                    type: "m.room.encryption",
                    state_key: "",
                    content: {
                        algorithm: "m.megolm.v1.aes-sha2",
                    },
                }),
            ],
        },
        timeline: {
            events: [],
            prev_batch: "",
        },
        ephemeral: { events: [] },
        account_data: { events: [] },
        unread_notifications: {},
    };

    for (let i = 0; i < roomMembers.length; i++) {
        roomResponse.state.events.push(
            testUtils.mkMembershipCustom({
                membership: "join",
                sender: roomMembers[i],
            }),
        );
    }

    return {
        next_batch: "1",
        rooms: {
            join: { [ROOM_ID]: roomResponse },
            invite: {},
            leave: {},
        },
        account_data: { events: [] },
    };
}

/**
 * Establish an Olm Session with the test user
 *
 * Waits for the test user to upload their keys, then sends a /sync response with a to-device message which will
 * establish an Olm session.
 *
 * @param testClient - the MatrixClient under test, which we expect to upload account keys, and to make a
 *    /sync request which we will respond to.
 * @param keyReceiver - an IE2EKeyReceiver which will intercept the /keys/upload request from the client under test
 * @param syncResponder - an ISyncResponder which will intercept /sync requests from the client under test
 * @param peerOlmAccount: an OlmAccount which will be used to initiate the Olm session.
 */
async function establishOlmSession(
    testClient: MatrixClient,
    keyReceiver: IE2EKeyReceiver,
    syncResponder: ISyncResponder,
    peerOlmAccount: Olm.Account,
): Promise<Olm.Session> {
    const peerE2EKeys = JSON.parse(peerOlmAccount.identity_keys());
    const p2pSession = await createOlmSession(peerOlmAccount, keyReceiver);
    const olmEvent = encryptOlmEvent({
        senderKey: peerE2EKeys.curve25519,
        senderSigningKey: peerE2EKeys.ed25519,
        recipient: testClient.getUserId()!,
        recipientCurve25519Key: keyReceiver.getDeviceKey(),
        recipientEd25519Key: keyReceiver.getSigningKey(),
        p2pSession: p2pSession,
    });
    syncResponder.sendOrQueueSyncResponse({
        next_batch: 1,
        to_device: { events: [olmEvent] },
    });
    await syncPromise(testClient);
    return p2pSession;
}

/**
 * Expect that the client shares keys with the given recipient
 *
 * Waits for an HTTP request to send the encrypted m.room_key to-device message; decrypts it and uses it
 * to establish an Olm InboundGroupSession.
 *
 * @param recipientUserID - the user id of the expected recipient
 *
 * @param recipientOlmAccount - Olm.Account for the recipient
 *
 * @param recipientOlmSession - an Olm.Session for the recipient, which must already have exchanged pre-key
 *    messages with the sender. Alternatively, null, in which case we will expect a pre-key message.
 *
 * @returns the established inbound group session
 */
async function expectSendRoomKey(
    recipientUserID: string,
    recipientOlmAccount: Olm.Account,
    recipientOlmSession: Olm.Session | null = null,
): Promise<Olm.InboundGroupSession> {
    const Olm = global.Olm;
    const testRecipientKey = JSON.parse(recipientOlmAccount.identity_keys())["curve25519"];

    function onSendRoomKey(content: any): Olm.InboundGroupSession {
        const m = content.messages[recipientUserID].DEVICE_ID;
        const ct = m.ciphertext[testRecipientKey];

        if (!recipientOlmSession) {
            expect(ct.type).toEqual(0); // pre-key message
            recipientOlmSession = new Olm.Session();
            recipientOlmSession.create_inbound(recipientOlmAccount, ct.body);
        } else {
            expect(ct.type).toEqual(1); // regular message
        }

        const decrypted = JSON.parse(recipientOlmSession.decrypt(ct.type, ct.body));
        expect(decrypted.type).toEqual("m.room_key");
        const inboundGroupSession = new Olm.InboundGroupSession();
        inboundGroupSession.create(decrypted.content.session_key);
        return inboundGroupSession;
    }
    return await new Promise<Olm.InboundGroupSession>((resolve) => {
        fetchMock.putOnce(
            new RegExp("/sendToDevice/m.room.encrypted/"),
            (url: string, opts: RequestInit): MockResponse => {
                const content = JSON.parse(opts.body as string);
                resolve(onSendRoomKey(content));
                return {};
            },
            {
                // append to the list of intercepts on this path (since we have some tests that call
                // this function multiple times)
                overwriteRoutes: false,
            },
        );
    });
}

/**
 * Expect that the client sends an encrypted event
 *
 * Waits for an HTTP request to send an encrypted message in the test room.
 *
 * @param inboundGroupSessionPromise - a promise for an Olm InboundGroupSession, which will
 *    be used to decrypt the event. We will wait for this to resolve once the HTTP request has been processed.
 *
 * @returns The content of the successfully-decrypted event
 */
async function expectSendMegolmMessage(
    inboundGroupSessionPromise: Promise<Olm.InboundGroupSession>,
): Promise<Partial<IEvent>> {
    const encryptedMessageContent = await new Promise<IContent>((resolve) => {
        fetchMock.putOnce(
            new RegExp("/send/m.room.encrypted/"),
            (url: string, opts: RequestInit): MockResponse => {
                resolve(JSON.parse(opts.body as string));
                return {
                    event_id: "$event_id",
                };
            },
            {
                // append to the list of intercepts on this path (since we have some tests that call
                // this function multiple times)
                overwriteRoutes: false,
            },
        );
    });

    // In some of the tests, the room key is sent *after* the actual event, so we may need to wait for it now.
    const inboundGroupSession = await inboundGroupSessionPromise;

    const r: any = inboundGroupSession.decrypt(encryptedMessageContent!.ciphertext);
    logger.log("Decrypted received megolm message", r);
    return JSON.parse(r.plaintext);
}

describe.each(Object.entries(CRYPTO_BACKENDS))("crypto (%s)", (backend: string, initCrypto: InitCrypto) => {
    if (!global.Olm) {
        // currently we use libolm to implement the crypto in the tests, so need it to be present.
        logger.warn("not running megolm tests: Olm not present");
        return;
    }

    // oldBackendOnly is an alternative to `it` or `test` which will skip the test if we are running against the
    // Rust backend. Once we have full support in the rust sdk, it will go away.
    const oldBackendOnly = backend === "rust-sdk" ? test.skip : test;

    const Olm = global.Olm;

    let testOlmAccount = {} as unknown as Olm.Account;
    let testSenderKey = "";

    /** the MatrixClient under test */
    let aliceClient: MatrixClient;

    /** an object which intercepts `/keys/upload` requests from {@link #aliceClient} to catch the uploaded keys */
    let keyReceiver: IE2EKeyReceiver;

    /** an object which intercepts `/sync` requests from {@link #aliceClient} */
    let syncResponder: ISyncResponder;

    async function startClientAndAwaitFirstSync(opts: IStartClientOpts = {}): Promise<void> {
        logger.log(aliceClient.getUserId() + ": starting");

        mockInitialApiRequests(aliceClient.getHomeserverUrl());

        // we let the client do a very basic initial sync, which it needs before
        // it will upload one-time keys.
        syncResponder.sendOrQueueSyncResponse({ next_batch: 1 });

        aliceClient.startClient({
            // set this so that we can get hold of failed events
            pendingEventOrdering: PendingEventOrdering.Detached,
            ...opts,
        });

        await syncPromise(aliceClient);
        logger.log(aliceClient.getUserId() + ": started");
    }

    /**
     * Set up expectations that the client will query device keys.
     *
     * We check that the query contains each of the users in `response`.
     *
     * @param response -   response to the query.
     */
    function expectAliceKeyQuery(response: IDownloadKeyResult) {
        function onQueryRequest(content: any): object {
            Object.keys(response.device_keys).forEach((userId) => {
                expect((content.device_keys! as Record<string, any>)[userId]).toEqual([]);
            });
            return response;
        }
        const rootRegexp = escapeRegExp(new URL("/_matrix/client/", aliceClient.getHomeserverUrl()).toString());
        fetchMock.postOnce(
            new RegExp(rootRegexp + "(r0|v3)/keys/query"),
            (url: string, opts: RequestInit) => onQueryRequest(JSON.parse(opts.body as string)),
            {
                // append to the list of intercepts on this path
                overwriteRoutes: false,
            },
        );
    }

    /**
     * Add an expectation for a /keys/claim request for the MatrixClient under test
     *
     * @param response - the response to return from the request. Normally an {@link IClaimOTKsResult}
     *   (or a function that returns one).
     */
    function expectAliceKeyClaim(response: MockResponse | MockResponseFunction) {
        const rootRegexp = escapeRegExp(new URL("/_matrix/client/", aliceClient.getHomeserverUrl()).toString());
        fetchMock.postOnce(new RegExp(rootRegexp + "(r0|v3)/keys/claim"), response);
    }

    /**
     * Get the device keys for testOlmAccount in a format suitable for a
     * response to /keys/query
     *
     * @param userId - The user ID to query for
     * @returns The fake query response
     */
    function getTestKeysQueryResponse(userId: string): IDownloadKeyResult {
        const testE2eKeys = JSON.parse(testOlmAccount.identity_keys());
        const testDeviceKeys: IDeviceKeys = {
            algorithms: ["m.olm.v1.curve25519-aes-sha2", "m.megolm.v1.aes-sha2"],
            device_id: "DEVICE_ID",
            keys: {
                "curve25519:DEVICE_ID": testE2eKeys.curve25519,
                "ed25519:DEVICE_ID": testE2eKeys.ed25519,
            },
            user_id: userId,
        };
        const j = anotherjson.stringify(testDeviceKeys);
        const sig = testOlmAccount.sign(j);
        testDeviceKeys.signatures = { [userId]: { "ed25519:DEVICE_ID": sig } };

        return {
            device_keys: { [userId]: { DEVICE_ID: testDeviceKeys } },
            failures: {},
        };
    }

    /**
     * Get a one-time key for testOlmAccount in a format suitable for a
     * response to /keys/claim

     * @param userId - The user ID to query for
     * @returns The fake key claim response
     */
    function getTestKeysClaimResponse(userId: string): IClaimOTKsResult {
        testOlmAccount.generate_one_time_keys(1);
        const testOneTimeKeys = JSON.parse(testOlmAccount.one_time_keys());
        testOlmAccount.mark_keys_as_published();

        const keyId = Object.keys(testOneTimeKeys.curve25519)[0];
        const oneTimeKey: string = testOneTimeKeys.curve25519[keyId];
        const unsignedKeyResult = { key: oneTimeKey };
        const j = anotherjson.stringify(unsignedKeyResult);
        const sig = testOlmAccount.sign(j);
        const keyResult = {
            ...unsignedKeyResult,
            signatures: { [userId]: { "ed25519:DEVICE_ID": sig } },
        };

        return {
            one_time_keys: { [userId]: { DEVICE_ID: { ["signed_curve25519:" + keyId]: keyResult } } },
            failures: {},
        };
    }

    beforeEach(async () => {
        // anything that we don't have a specific matcher for silently returns a 404
        fetchMock.catch(404);
        fetchMock.config.warnOnFallback = false;

        const homeserverUrl = "https://alice-server.com";
        aliceClient = createClient({
            baseUrl: homeserverUrl,
            userId: "@alice:localhost",
            accessToken: "akjgkrgjs",
            deviceId: "xzcvb",
        });

        /* set up listeners for /keys/upload and /sync */
        keyReceiver = new E2EKeyReceiver(homeserverUrl);
        syncResponder = new SyncResponder(homeserverUrl);

        await initCrypto(aliceClient);

        // create a test olm device which we will use to communicate with alice. We use libolm to implement this.
        await Olm.init();
        testOlmAccount = new Olm.Account();
        testOlmAccount.create();
        const testE2eKeys = JSON.parse(testOlmAccount.identity_keys());
        testSenderKey = testE2eKeys.curve25519;
    });

    afterEach(async () => {
        await aliceClient.stopClient();
        fetchMock.mockReset();
    });

    it("MatrixClient.getCrypto returns a CryptoApi", () => {
        expect(aliceClient.getCrypto()).toHaveProperty("globalBlacklistUnverifiedDevices");
    });

    it("Alice receives a megolm message", async () => {
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        // if we're using the old crypto impl, stub out some methods in the device manager.
        // TODO: replace this with intercepts of the /keys/query endpoint to make it impl agnostic.
        if (aliceClient.crypto) {
            aliceClient.crypto.deviceList.downloadKeys = () => Promise.resolve(new Map());
            aliceClient.crypto.deviceList.getUserByIdentityKey = () => "@bob:xyz";
        }

        const p2pSession = await createOlmSession(testOlmAccount, keyReceiver);
        const groupSession = new Olm.OutboundGroupSession();
        groupSession.create();

        // make the room_key event
        const roomKeyEncrypted = encryptGroupSessionKey({
            recipient: aliceClient.getUserId()!,
            recipientCurve25519Key: keyReceiver.getDeviceKey(),
            recipientEd25519Key: keyReceiver.getSigningKey(),
            olmAccount: testOlmAccount,
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
                join: {
                    [ROOM_ID]: { timeline: { events: [messageEncrypted] } },
                },
            },
        };

        syncResponder.sendOrQueueSyncResponse(syncResponse);
        await syncPromise(aliceClient);

        const room = aliceClient.getRoom(ROOM_ID)!;
        const event = room.getLiveTimeline().getEvents()[0];
        expect(event.isEncrypted()).toBe(true);

        // it probably won't be decrypted yet, because it takes a while to process the olm keys
        const decryptedEvent = await testUtils.awaitDecryption(event, { waitOnDecryptionFailure: true });
        expect(decryptedEvent.getContent().body).toEqual("42");
    });

    it("Alice receives a megolm message before the session keys", async () => {
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        // if we're using the old crypto impl, stub out some methods in the device manager.
        // TODO: replace this with intercepts of the /keys/query endpoint to make it impl agnostic.
        if (aliceClient.crypto) {
            aliceClient.crypto.deviceList.downloadKeys = () => Promise.resolve(new Map());
            aliceClient.crypto.deviceList.getUserByIdentityKey = () => "@bob:xyz";
        }

        const p2pSession = await createOlmSession(testOlmAccount, keyReceiver);
        const groupSession = new Olm.OutboundGroupSession();
        groupSession.create();

        // make the room_key event, but don't send it yet
        const roomKeyEncrypted = encryptGroupSessionKey({
            recipient: aliceClient.getUserId()!,
            recipientCurve25519Key: keyReceiver.getDeviceKey(),
            recipientEd25519Key: keyReceiver.getSigningKey(),
            olmAccount: testOlmAccount,
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
        syncResponder.sendOrQueueSyncResponse({
            next_batch: 1,
            rooms: { join: { [ROOM_ID]: { timeline: { events: [messageEncrypted] } } } },
        });
        await syncPromise(aliceClient);

        const room = aliceClient.getRoom(ROOM_ID)!;
        const event = room.getLiveTimeline().getEvents()[0];

        // wait for a first attempt at decryption: should fail
        await testUtils.awaitDecryption(event);
        expect(event.getContent().msgtype).toEqual("m.bad.encrypted");

        // now she gets the room_key event
        syncResponder.sendOrQueueSyncResponse({
            next_batch: 2,
            to_device: {
                events: [roomKeyEncrypted],
            },
        });
        await syncPromise(aliceClient);

        await testUtils.awaitDecryption(event, { waitOnDecryptionFailure: true });
        expect(event.getContent().body).toEqual("42");
    });

    it("Alice gets a second room_key message", async () => {
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        // if we're using the old crypto impl, stub out some methods in the device manager.
        // TODO: replace this with intercepts of the /keys/query endpoint to make it impl agnostic.
        if (aliceClient.crypto) {
            aliceClient.crypto.deviceList.downloadKeys = () => Promise.resolve(new Map());
            aliceClient.crypto.deviceList.getUserByIdentityKey = () => "@bob:xyz";
        }

        const p2pSession = await createOlmSession(testOlmAccount, keyReceiver);
        const groupSession = new Olm.OutboundGroupSession();
        groupSession.create();

        // make the room_key event
        const roomKeyEncrypted1 = encryptGroupSessionKey({
            recipient: aliceClient.getUserId()!,
            recipientCurve25519Key: keyReceiver.getDeviceKey(),
            recipientEd25519Key: keyReceiver.getSigningKey(),
            olmAccount: testOlmAccount,
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
            recipient: aliceClient.getUserId()!,
            recipientCurve25519Key: keyReceiver.getDeviceKey(),
            recipientEd25519Key: keyReceiver.getSigningKey(),
            olmAccount: testOlmAccount,
            p2pSession: p2pSession,
            groupSession: groupSession,
            room_id: ROOM_ID,
        });

        // on the first sync, send the best room key
        syncResponder.sendOrQueueSyncResponse({
            next_batch: 1,
            to_device: {
                events: [roomKeyEncrypted1],
            },
        });
        await syncPromise(aliceClient);

        // on the second sync, send the advanced room key, along with the
        // message.  This simulates the situation where Alice has been sent a
        // later copy of the room key and is reloading the client.
        syncResponder.sendOrQueueSyncResponse({
            next_batch: 2,
            to_device: {
                events: [roomKeyEncrypted2],
            },
            rooms: {
                join: { [ROOM_ID]: { timeline: { events: [messageEncrypted] } } },
            },
        });
        await syncPromise(aliceClient);

        const room = aliceClient.getRoom(ROOM_ID)!;
        await room.decryptCriticalEvents();
        const event = room.getLiveTimeline().getEvents()[0];
        expect(event.getContent().body).toEqual("42");
    });

    it("prepareToEncrypt", async () => {
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();
        aliceClient.setGlobalErrorOnUnknownDevices(false);

        // tell alice she is sharing a room with bob
        syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@bob:xyz"]));
        await syncPromise(aliceClient);

        // we expect alice first to query bob's keys...
        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

        // ... and then claim one of his OTKs
        expectAliceKeyClaim(getTestKeysClaimResponse("@bob:xyz"));

        // fire off the prepare request
        const room = aliceClient.getRoom(ROOM_ID);
        expect(room).toBeTruthy();
        const p = aliceClient.prepareToEncrypt(room!);

        // we expect to get a room key message
        await expectSendRoomKey("@bob:xyz", testOlmAccount);

        // the prepare request should complete successfully.
        await p;
    });

    it("Alice sends a megolm message with GlobalErrorOnUnknownDevices=false", async () => {
        aliceClient.setGlobalErrorOnUnknownDevices(false);
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        // Alice shares a room with Bob
        syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@bob:xyz"]));
        await syncPromise(aliceClient);

        // Once we send the message, Alice will check Bob's device list (twice, because reasons) ...
        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));
        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

        // ... and claim one of his OTKs ...
        expectAliceKeyClaim(getTestKeysClaimResponse("@bob:xyz"));

        // ... and send an m.room_key message
        const inboundGroupSessionPromise = expectSendRoomKey("@bob:xyz", testOlmAccount);

        // Finally, send the message, and expect to get an `m.room.encrypted` event that we can decrypt.
        await Promise.all([
            aliceClient.sendTextMessage(ROOM_ID, "test"),
            expectSendMegolmMessage(inboundGroupSessionPromise),
        ]);
    });

    it("We should start a new megolm session after forceDiscardSession", async () => {
        aliceClient.setGlobalErrorOnUnknownDevices(false);
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        // Alice shares a room with Bob
        syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@bob:xyz"]));
        await syncPromise(aliceClient);

        // Once we send the message, Alice will check Bob's device list (twice, because reasons) ...
        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));
        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

        // ... and claim one of his OTKs ...
        expectAliceKeyClaim(getTestKeysClaimResponse("@bob:xyz"));

        // ... and send an m.room_key message
        const inboundGroupSessionPromise = expectSendRoomKey("@bob:xyz", testOlmAccount);

        // Send the first message, and check we can decrypt it.
        await Promise.all([
            aliceClient.sendTextMessage(ROOM_ID, "test"),
            expectSendMegolmMessage(inboundGroupSessionPromise),
        ]);

        // Finally the interesting part: discard the session.
        aliceClient.forceDiscardSession(ROOM_ID);

        // Now when we send the next message, we should get a *new* megolm session.
        const inboundGroupSessionPromise2 = expectSendRoomKey("@bob:xyz", testOlmAccount);
        const p2 = expectSendMegolmMessage(inboundGroupSessionPromise2);
        await Promise.all([aliceClient.sendTextMessage(ROOM_ID, "test2"), p2]);
    });

    oldBackendOnly("Alice sends a megolm message", async () => {
        // TODO: do something about this for the rust backend.
        //   Currently it fails because we don't respect the default GlobalErrorOnUnknownDevices and
        //   send messages to unknown devices.

        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();
        const p2pSession = await establishOlmSession(aliceClient, keyReceiver, syncResponder, testOlmAccount);

        syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@bob:xyz"]));
        await syncPromise(aliceClient);

        // start out with the device unknown - the send should be rejected.
        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));
        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

        await aliceClient.sendTextMessage(ROOM_ID, "test").then(
            () => {
                throw new Error("sendTextMessage failed on an unknown device");
            },
            (e) => {
                expect(e.name).toEqual("UnknownDeviceError");
            },
        );

        // mark the device as known, and resend.
        aliceClient.setDeviceKnown("@bob:xyz", "DEVICE_ID");

        const room = aliceClient.getRoom(ROOM_ID)!;
        const pendingMsg = room.getPendingEvents()[0];

        const inboundGroupSessionPromise = expectSendRoomKey("@bob:xyz", testOlmAccount, p2pSession);

        await Promise.all([
            aliceClient.resendEvent(pendingMsg, room),
            expectSendMegolmMessage(inboundGroupSessionPromise),
        ]);
    });

    oldBackendOnly("We shouldn't attempt to send to blocked devices", async () => {
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();
        await establishOlmSession(aliceClient, keyReceiver, syncResponder, testOlmAccount);

        syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@bob:xyz"]));
        await syncPromise(aliceClient);

        logger.log("Forcing alice to download our device keys");

        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));
        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

        await aliceClient.downloadKeys(["@bob:xyz"]);

        logger.log("Telling alice to block our device");
        aliceClient.setDeviceBlocked("@bob:xyz", "DEVICE_ID");

        logger.log("Telling alice to send a megolm message");
        fetchMock.putOnce({ url: new RegExp("/send/"), name: "send-event" }, { event_id: "$event_id" });
        fetchMock.putOnce({ url: new RegExp("/sendToDevice/m.room_key.withheld/"), name: "send-withheld" }, {});

        await aliceClient.sendTextMessage(ROOM_ID, "test");

        // check that the event and withheld notifications were both sent
        expect(fetchMock.done("send-event")).toBeTruthy();
        expect(fetchMock.done("send-withheld")).toBeTruthy();
    });

    describe("get|setGlobalErrorOnUnknownDevices", () => {
        it("should raise an error if crypto is disabled", () => {
            aliceClient["cryptoBackend"] = undefined;
            expect(() => aliceClient.setGlobalErrorOnUnknownDevices(true)).toThrow("encryption disabled");
            expect(() => aliceClient.getGlobalErrorOnUnknownDevices()).toThrow("encryption disabled");
        });

        oldBackendOnly("should permit sending to unknown devices", async () => {
            expect(aliceClient.getGlobalErrorOnUnknownDevices()).toBeTruthy();

            expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
            await startClientAndAwaitFirstSync();
            const p2pSession = await establishOlmSession(aliceClient, keyReceiver, syncResponder, testOlmAccount);

            syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@bob:xyz"]));
            await syncPromise(aliceClient);

            // start out with the device unknown - the send should be rejected.
            expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));
            expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

            await aliceClient.sendTextMessage(ROOM_ID, "test").then(
                () => {
                    throw new Error("sendTextMessage failed on an unknown device");
                },
                (e) => {
                    expect(e.name).toEqual("UnknownDeviceError");
                },
            );

            // enable sending to unknown devices, and resend
            aliceClient.setGlobalErrorOnUnknownDevices(false);
            expect(aliceClient.getGlobalErrorOnUnknownDevices()).toBeFalsy();

            const room = aliceClient.getRoom(ROOM_ID)!;
            const pendingMsg = room.getPendingEvents()[0];

            const inboundGroupSessionPromise = expectSendRoomKey("@bob:xyz", testOlmAccount, p2pSession);

            await Promise.all([
                aliceClient.resendEvent(pendingMsg, room),
                expectSendMegolmMessage(inboundGroupSessionPromise),
            ]);
        });
    });

    describe("get|setGlobalBlacklistUnverifiedDevices", () => {
        it("should raise an error if crypto is disabled", () => {
            aliceClient["cryptoBackend"] = undefined;
            expect(() => aliceClient.setGlobalBlacklistUnverifiedDevices(true)).toThrow("encryption disabled");
            expect(() => aliceClient.getGlobalBlacklistUnverifiedDevices()).toThrow("encryption disabled");
        });

        oldBackendOnly("should disable sending to unverified devices", async () => {
            expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
            await startClientAndAwaitFirstSync();
            const p2pSession = await establishOlmSession(aliceClient, keyReceiver, syncResponder, testOlmAccount);

            // tell alice we share a room with bob
            syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@bob:xyz"]));
            await syncPromise(aliceClient);

            logger.log("Forcing alice to download our device keys");
            expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));
            expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

            await aliceClient.downloadKeys(["@bob:xyz"]);

            logger.log("Telling alice to block messages to unverified devices");
            expect(aliceClient.getGlobalBlacklistUnverifiedDevices()).toBeFalsy();
            aliceClient.setGlobalBlacklistUnverifiedDevices(true);
            expect(aliceClient.getGlobalBlacklistUnverifiedDevices()).toBeTruthy();

            logger.log("Telling alice to send a megolm message");
            fetchMock.putOnce(new RegExp("/send/"), { event_id: "$event_id" });
            fetchMock.putOnce(new RegExp("/sendToDevice/m.room_key.withheld/"), {});

            await aliceClient.sendTextMessage(ROOM_ID, "test");

            // Now, let's mark the device as verified, and check that keys are sent to it.

            logger.log("Marking the device as verified");
            // XXX: this is an integration test; we really ought to do this via the cross-signing dance
            const d = aliceClient.crypto!.deviceList.getStoredDevice("@bob:xyz", "DEVICE_ID")!;
            d.verified = DeviceInfo.DeviceVerification.VERIFIED;
            aliceClient.crypto?.deviceList.storeDevicesForUser("@bob:xyz", { DEVICE_ID: d });

            const inboundGroupSessionPromise = expectSendRoomKey("@bob:xyz", testOlmAccount, p2pSession);

            logger.log("Asking alice to re-send");
            await Promise.all([
                expectSendMegolmMessage(inboundGroupSessionPromise).then((decrypted) => {
                    expect(decrypted.type).toEqual("m.room.message");
                    expect(decrypted.content!.body).toEqual("test");
                }),
                aliceClient.sendTextMessage(ROOM_ID, "test"),
            ]);
        });
    });

    oldBackendOnly("We should start a new megolm session when a device is blocked", async () => {
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();
        const p2pSession = await establishOlmSession(aliceClient, keyReceiver, syncResponder, testOlmAccount);

        syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@bob:xyz"]));
        await syncPromise(aliceClient);

        logger.log("Fetching bob's devices and marking known");

        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));
        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

        await aliceClient.downloadKeys(["@bob:xyz"]);
        await aliceClient.setDeviceKnown("@bob:xyz", "DEVICE_ID");

        logger.log("Telling alice to send a megolm message");

        let megolmSessionId: string;
        const inboundGroupSessionPromise = expectSendRoomKey("@bob:xyz", testOlmAccount, p2pSession);
        inboundGroupSessionPromise.then((igs) => {
            megolmSessionId = igs.session_id();
        });

        await Promise.all([
            aliceClient.sendTextMessage(ROOM_ID, "test"),
            expectSendMegolmMessage(inboundGroupSessionPromise),
        ]);

        logger.log("Telling alice to block our device");
        aliceClient.setDeviceBlocked("@bob:xyz", "DEVICE_ID");

        logger.log("Telling alice to send another megolm message");

        fetchMock.putOnce(
            { url: new RegExp("/send/"), name: "send-event" },
            (url: string, opts: RequestInit): MockResponse => {
                const content = JSON.parse(opts.body as string);
                logger.log("/send:", content);
                // make sure that a new session is used
                expect(content.session_id).not.toEqual(megolmSessionId);
                return {
                    event_id: "$event_id",
                };
            },
        );
        fetchMock.putOnce({ url: new RegExp("/sendToDevice/m.room_key.withheld/"), name: "send-withheld" }, {});

        await aliceClient.sendTextMessage(ROOM_ID, "test2");

        // check that the event and withheld notifications were both sent
        expect(fetchMock.done("send-event")).toBeTruthy();
        expect(fetchMock.done("send-withheld")).toBeTruthy();
    });

    // https://github.com/vector-im/element-web/issues/2676
    oldBackendOnly("Alice should send to her other devices", async () => {
        // for this test, we make the testOlmAccount be another of Alice's devices.
        // it ought to get included in messages Alice sends.
        expectAliceKeyQuery(getTestKeysQueryResponse(aliceClient.getUserId()!));

        await startClientAndAwaitFirstSync();
        // an encrypted room with just alice
        const syncResponse = {
            next_batch: 1,
            rooms: {
                join: {
                    [ROOM_ID]: {
                        state: {
                            events: [
                                testUtils.mkEvent({
                                    type: "m.room.encryption",
                                    skey: "",
                                    content: { algorithm: "m.megolm.v1.aes-sha2" },
                                }),
                                testUtils.mkMembership({
                                    mship: "join",
                                    sender: aliceClient.getUserId()!,
                                }),
                            ],
                        },
                    },
                },
            },
        };
        syncResponder.sendOrQueueSyncResponse(syncResponse);

        await syncPromise(aliceClient);

        // start out with the device unknown - the send should be rejected.
        try {
            await aliceClient.sendTextMessage(ROOM_ID, "test");
            throw new Error("sendTextMessage succeeded on an unknown device");
        } catch (e) {
            expect((e as any).name).toEqual("UnknownDeviceError");
            expect([...(e as any).devices.keys()]).toEqual([aliceClient.getUserId()!]);
            expect((e as any).devices.get(aliceClient.getUserId()!).has("DEVICE_ID")).toBeTruthy();
        }

        // mark the device as known, and resend.
        aliceClient.setDeviceKnown(aliceClient.getUserId()!, "DEVICE_ID");
        expectAliceKeyClaim((url: string, opts: RequestInit): MockResponse => {
            const content = JSON.parse(opts.body as string);
            expect(content.one_time_keys[aliceClient.getUserId()!].DEVICE_ID).toEqual("signed_curve25519");
            return getTestKeysClaimResponse(aliceClient.getUserId()!);
        });

        const inboundGroupSessionPromise = expectSendRoomKey(aliceClient.getUserId()!, testOlmAccount);

        let decrypted: Partial<IEvent> = {};

        // Grab the event that we'll need to resend
        const room = aliceClient.getRoom(ROOM_ID)!;
        const pendingEvents = room.getPendingEvents();
        expect(pendingEvents.length).toEqual(1);
        const unsentEvent = pendingEvents[0];

        await Promise.all([
            expectSendMegolmMessage(inboundGroupSessionPromise).then((d) => {
                decrypted = d;
            }),
            aliceClient.resendEvent(unsentEvent, room),
        ]);

        expect(decrypted.type).toEqual("m.room.message");
        expect(decrypted.content?.body).toEqual("test");
    });

    oldBackendOnly("Alice should wait for device list to complete when sending a megolm message", async () => {
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();
        await establishOlmSession(aliceClient, keyReceiver, syncResponder, testOlmAccount);

        syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@bob:xyz"]));
        await syncPromise(aliceClient);

        // this will block
        logger.log("Forcing alice to download our device keys");
        const downloadPromise = aliceClient.downloadKeys(["@bob:xyz"]);

        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

        // so will this.
        const sendPromise = aliceClient.sendTextMessage(ROOM_ID, "test").then(
            () => {
                throw new Error("sendTextMessage failed on an unknown device");
            },
            (e) => {
                expect(e.name).toEqual("UnknownDeviceError");
            },
        );

        expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

        await Promise.all([downloadPromise, sendPromise]);
    });

    oldBackendOnly("Alice exports megolm keys and imports them to a new device", async () => {
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        // if we're using the old crypto impl, stub out some methods in the device manager.
        // TODO: replace this with intercepts of the /keys/query endpoint to make it impl agnostic.
        if (aliceClient.crypto) {
            aliceClient.crypto.deviceList.downloadKeys = () => Promise.resolve(new Map());
            aliceClient.crypto.deviceList.getUserByIdentityKey = () => "@bob:xyz";
        }

        // establish an olm session with alice
        const p2pSession = await createOlmSession(testOlmAccount, keyReceiver);

        const groupSession = new Olm.OutboundGroupSession();
        groupSession.create();

        // make the room_key event
        const roomKeyEncrypted = encryptGroupSessionKey({
            recipient: aliceClient.getUserId()!,
            recipientCurve25519Key: keyReceiver.getDeviceKey(),
            recipientEd25519Key: keyReceiver.getSigningKey(),
            olmAccount: testOlmAccount,
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
        syncResponder.sendOrQueueSyncResponse({
            next_batch: 1,
            to_device: {
                events: [roomKeyEncrypted],
            },
            rooms: {
                join: { [ROOM_ID]: { timeline: { events: [messageEncrypted] } } },
            },
        });
        await syncPromise(aliceClient);

        const room = aliceClient.getRoom(ROOM_ID)!;
        await room.decryptCriticalEvents();

        // it probably won't be decrypted yet, because it takes a while to process the olm keys
        const decryptedEvent = await testUtils.awaitDecryption(room.getLiveTimeline().getEvents()[0], {
            waitOnDecryptionFailure: true,
        });
        expect(decryptedEvent.getContent().body).toEqual("42");

        const exported = await aliceClient.exportRoomKeys();

        // start a new client
        await aliceClient.stopClient();

        const homeserverUrl = "https://alice-server2.com";
        aliceClient = createClient({
            baseUrl: homeserverUrl,
            userId: "@alice:localhost",
            accessToken: "akjgkrgjs",
            deviceId: "xzcvb",
        });

        keyReceiver = new E2EKeyReceiver(homeserverUrl);
        syncResponder = new SyncResponder(homeserverUrl);
        await initCrypto(aliceClient);
        await aliceClient.importRoomKeys(exported);
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        aliceClient.startClient();

        // if we're using the old crypto impl, stub out some methods in the device manager.
        // TODO: replace this with intercepts of the /keys/query endpoint to make it impl agnostic.
        if (aliceClient.crypto) {
            aliceClient.crypto.deviceList.getUserByIdentityKey = () => "@bob:xyz";
        }

        const syncResponse = {
            next_batch: 1,
            rooms: {
                join: { [ROOM_ID]: { timeline: { events: [messageEncrypted] } } },
            },
        };

        syncResponder.sendOrQueueSyncResponse(syncResponse);
        await syncPromise(aliceClient);

        const event = room.getLiveTimeline().getEvents()[0];
        expect(event.getContent().body).toEqual("42");
    });

    it("Alice receives an untrusted megolm key, only to receive the trusted one shortly after", async () => {
        const testClient = new TestClient("@alice:localhost", "device2", "access_token2");
        const groupSession = new Olm.OutboundGroupSession();
        groupSession.create();
        const inboundGroupSession = new Olm.InboundGroupSession();
        inboundGroupSession.create(groupSession.session_key());
        const rawEvent = encryptMegolmEvent({
            senderKey: testSenderKey,
            groupSession: groupSession,
            room_id: ROOM_ID,
        });
        await testClient.client.initCrypto();
        const keys = [
            {
                room_id: ROOM_ID,
                algorithm: "m.megolm.v1.aes-sha2",
                session_id: groupSession.session_id(),
                session_key: inboundGroupSession.export_session(0),
                sender_key: testSenderKey,
                forwarding_curve25519_key_chain: [],
                sender_claimed_keys: {},
            },
        ];
        await testClient.client.importRoomKeys(keys, { untrusted: true });

        const event1 = testUtils.mkEvent({
            event: true,
            ...rawEvent,
            room: ROOM_ID,
        });
        await event1.attemptDecryption(testClient.client.crypto!, { isRetry: true });
        expect(event1.isKeySourceUntrusted()).toBeTruthy();

        const event2 = testUtils.mkEvent({
            type: "m.room_key",
            content: {
                room_id: ROOM_ID,
                algorithm: "m.megolm.v1.aes-sha2",
                session_id: groupSession.session_id(),
                session_key: groupSession.session_key(),
            },
            event: true,
        });
        // @ts-ignore - private
        event2.senderCurve25519Key = testSenderKey;
        // @ts-ignore - private
        testClient.client.crypto!.onRoomKeyEvent(event2);

        const event3 = testUtils.mkEvent({
            event: true,
            ...rawEvent,
            room: ROOM_ID,
        });
        await event3.attemptDecryption(testClient.client.crypto!, { isRetry: true });
        expect(event3.isKeySourceUntrusted()).toBeFalsy();
        testClient.stop();
    });

    it("Alice can decrypt a message with falsey content", async () => {
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        // if we're using the old crypto impl, stub out some methods in the device manager.
        // TODO: replace this with intercepts of the /keys/query endpoint to make it impl agnostic.
        if (aliceClient.crypto) {
            aliceClient.crypto.deviceList.downloadKeys = () => Promise.resolve(new Map());
            aliceClient.crypto.deviceList.getUserByIdentityKey = () => "@bob:xyz";
        }

        const p2pSession = await createOlmSession(testOlmAccount, keyReceiver);
        const groupSession = new Olm.OutboundGroupSession();
        groupSession.create();

        // make the room_key event
        const roomKeyEncrypted = encryptGroupSessionKey({
            recipient: aliceClient.getUserId()!,
            recipientCurve25519Key: keyReceiver.getDeviceKey(),
            recipientEd25519Key: keyReceiver.getSigningKey(),
            olmAccount: testOlmAccount,
            p2pSession: p2pSession,
            groupSession: groupSession,
            room_id: ROOM_ID,
        });

        const plaintext = {
            type: "m.room.message",
            content: undefined,
            room_id: ROOM_ID,
        };

        const messageEncrypted = encryptMegolmEventRawPlainText({
            senderKey: testSenderKey,
            groupSession: groupSession,
            plaintext: plaintext,
        });

        // Alice gets both the events in a single sync
        const syncResponse = {
            next_batch: 1,
            to_device: {
                events: [roomKeyEncrypted],
            },
            rooms: {
                join: { [ROOM_ID]: { timeline: { events: [messageEncrypted] } } },
            },
        };

        syncResponder.sendOrQueueSyncResponse(syncResponse);
        await syncPromise(aliceClient);

        const room = aliceClient.getRoom(ROOM_ID)!;
        const event = room.getLiveTimeline().getEvents()[0];
        expect(event.isEncrypted()).toBe(true);

        // it probably won't be decrypted yet, because it takes a while to process the olm keys
        const decryptedEvent = await testUtils.awaitDecryption(event, { waitOnDecryptionFailure: true });
        expect(decryptedEvent.getRoomId()).toEqual(ROOM_ID);
        expect(decryptedEvent.getContent()).toEqual({});
        expect(decryptedEvent.getClearContent()).toBeUndefined();
    });

    oldBackendOnly("Alice receives shared history before being invited to a room by the sharer", async () => {
        const beccaTestClient = new TestClient("@becca:localhost", "foobar", "bazquux");
        await beccaTestClient.client.initCrypto();

        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();
        await beccaTestClient.start();

        // if we're using the old crypto impl, stub out some methods in the device manager.
        // TODO: replace this with intercepts of the /keys/query endpoint to make it impl agnostic.
        if (aliceClient.crypto) {
            aliceClient.crypto!.deviceList.downloadKeys = () => Promise.resolve(new Map());
            aliceClient.crypto!.deviceList.getDeviceByIdentityKey = () => device;
            aliceClient.crypto!.deviceList.getUserByIdentityKey = () => beccaTestClient.client.getUserId()!;
        }

        const beccaRoom = new Room(ROOM_ID, beccaTestClient.client, "@becca:localhost", {});
        beccaTestClient.client.store.storeRoom(beccaRoom);
        await beccaTestClient.client.setRoomEncryption(ROOM_ID, { algorithm: "m.megolm.v1.aes-sha2" });

        const event = new MatrixEvent({
            type: "m.room.message",
            sender: "@becca:localhost",
            room_id: ROOM_ID,
            event_id: "$1",
            content: {
                msgtype: "m.text",
                body: "test message",
            },
        });

        await beccaTestClient.client.crypto!.encryptEvent(event, beccaRoom);
        // remove keys from the event
        // @ts-ignore private properties
        event.clearEvent = undefined;
        // @ts-ignore private properties
        event.senderCurve25519Key = null;
        // @ts-ignore private properties
        event.claimedEd25519Key = null;

        const device = new DeviceInfo(beccaTestClient.client.deviceId!);

        // Create an olm session for Becca and Alice's devices
        const aliceOtks = await keyReceiver.awaitOneTimeKeyUpload();
        const aliceOtkId = Object.keys(aliceOtks)[0];
        const aliceOtk = aliceOtks[aliceOtkId];
        const p2pSession = new global.Olm.Session();
        await beccaTestClient.client.crypto!.cryptoStore.doTxn(
            "readonly",
            [IndexedDBCryptoStore.STORE_ACCOUNT],
            (txn) => {
                beccaTestClient.client.crypto!.cryptoStore.getAccount(txn, (pickledAccount: string | null) => {
                    const account = new global.Olm.Account();
                    try {
                        account.unpickle(beccaTestClient.client.crypto!.olmDevice.pickleKey, pickledAccount!);
                        p2pSession.create_outbound(account, keyReceiver.getDeviceKey(), aliceOtk.key);
                    } finally {
                        account.free();
                    }
                });
            },
        );

        const content = event.getWireContent();
        const groupSessionKey = await beccaTestClient.client.crypto!.olmDevice.getInboundGroupSessionKey(
            ROOM_ID,
            content.sender_key,
            content.session_id,
        );
        const encryptedForwardedKey = encryptOlmEvent({
            sender: "@becca:localhost",
            senderSigningKey: beccaTestClient.getSigningKey(),
            senderKey: beccaTestClient.getDeviceKey(),
            recipient: aliceClient.getUserId()!,
            recipientCurve25519Key: keyReceiver.getDeviceKey(),
            recipientEd25519Key: keyReceiver.getSigningKey(),
            p2pSession: p2pSession,
            plaincontent: {
                "algorithm": "m.megolm.v1.aes-sha2",
                "room_id": ROOM_ID,
                "sender_key": content.sender_key,
                "sender_claimed_ed25519_key": groupSessionKey!.sender_claimed_ed25519_key,
                "session_id": content.session_id,
                "session_key": groupSessionKey!.key,
                "chain_index": groupSessionKey!.chain_index,
                "forwarding_curve25519_key_chain": groupSessionKey!.forwarding_curve25519_key_chain,
                "org.matrix.msc3061.shared_history": true,
            },
            plaintype: "m.forwarded_room_key",
        });

        // Alice receives shared history
        syncResponder.sendOrQueueSyncResponse({
            next_batch: 1,
            to_device: { events: [encryptedForwardedKey] },
        });
        await syncPromise(aliceClient);

        // Alice is invited to the room by Becca
        syncResponder.sendOrQueueSyncResponse({
            next_batch: 2,
            rooms: {
                invite: {
                    [ROOM_ID]: {
                        invite_state: {
                            events: [
                                {
                                    sender: "@becca:localhost",
                                    type: "m.room.encryption",
                                    state_key: "",
                                    content: {
                                        algorithm: "m.megolm.v1.aes-sha2",
                                    },
                                },
                                {
                                    sender: "@becca:localhost",
                                    type: "m.room.member",
                                    state_key: "@alice:localhost",
                                    content: {
                                        membership: "invite",
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        });
        await syncPromise(aliceClient);

        // Alice has joined the room
        expectAliceKeyQuery({ device_keys: { "@becca:localhost": {} }, failures: {} });
        syncResponder.sendOrQueueSyncResponse(getSyncResponse(["@alice:localhost", "@becca:localhost"]));
        await syncPromise(aliceClient);

        syncResponder.sendOrQueueSyncResponse({
            next_batch: 4,
            rooms: {
                join: {
                    [ROOM_ID]: { timeline: { events: [event.event] } },
                },
            },
        });
        await syncPromise(aliceClient);

        const room = aliceClient.getRoom(ROOM_ID)!;
        const roomEvent = room.getLiveTimeline().getEvents()[0];
        expect(roomEvent.isEncrypted()).toBe(true);
        const decryptedEvent = await testUtils.awaitDecryption(roomEvent);
        expect(decryptedEvent.getContent().body).toEqual("test message");

        await beccaTestClient.stop();
    });

    oldBackendOnly("Alice receives shared history before being invited to a room by someone else", async () => {
        const beccaTestClient = new TestClient("@becca:localhost", "foobar", "bazquux");
        await beccaTestClient.client.initCrypto();

        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        await beccaTestClient.start();

        const beccaRoom = new Room(ROOM_ID, beccaTestClient.client, "@becca:localhost", {});
        beccaTestClient.client.store.storeRoom(beccaRoom);
        await beccaTestClient.client.setRoomEncryption(ROOM_ID, { algorithm: "m.megolm.v1.aes-sha2" });

        const event = new MatrixEvent({
            type: "m.room.message",
            sender: "@becca:localhost",
            room_id: ROOM_ID,
            event_id: "$1",
            content: {
                msgtype: "m.text",
                body: "test message",
            },
        });

        await beccaTestClient.client.crypto!.encryptEvent(event, beccaRoom);
        // remove keys from the event
        // @ts-ignore private properties
        event.clearEvent = undefined;
        // @ts-ignore private properties
        event.senderCurve25519Key = null;
        // @ts-ignore private properties
        event.claimedEd25519Key = null;

        const device = new DeviceInfo(beccaTestClient.client.deviceId!);
        aliceClient.crypto!.deviceList.getDeviceByIdentityKey = () => device;

        // Create an olm session for Becca and Alice's devices
        const aliceOtks = await keyReceiver.awaitOneTimeKeyUpload();
        const aliceOtkId = Object.keys(aliceOtks)[0];
        const aliceOtk = aliceOtks[aliceOtkId];
        const p2pSession = new global.Olm.Session();
        await beccaTestClient.client.crypto!.cryptoStore.doTxn(
            "readonly",
            [IndexedDBCryptoStore.STORE_ACCOUNT],
            (txn) => {
                beccaTestClient.client.crypto!.cryptoStore.getAccount(txn, (pickledAccount: string | null) => {
                    const account = new global.Olm.Account();
                    try {
                        account.unpickle(beccaTestClient.client.crypto!.olmDevice.pickleKey, pickledAccount!);
                        p2pSession.create_outbound(account, keyReceiver.getDeviceKey(), aliceOtk.key);
                    } finally {
                        account.free();
                    }
                });
            },
        );

        const content = event.getWireContent();
        const groupSessionKey = await beccaTestClient.client.crypto!.olmDevice.getInboundGroupSessionKey(
            ROOM_ID,
            content.sender_key,
            content.session_id,
        );
        const encryptedForwardedKey = encryptOlmEvent({
            sender: "@becca:localhost",
            senderKey: beccaTestClient.getDeviceKey(),
            senderSigningKey: beccaTestClient.getSigningKey(),
            recipient: aliceClient.getUserId()!,
            recipientCurve25519Key: keyReceiver.getDeviceKey(),
            recipientEd25519Key: keyReceiver.getSigningKey(),
            p2pSession: p2pSession,
            plaincontent: {
                "algorithm": "m.megolm.v1.aes-sha2",
                "room_id": ROOM_ID,
                "sender_key": content.sender_key,
                "sender_claimed_ed25519_key": groupSessionKey!.sender_claimed_ed25519_key,
                "session_id": content.session_id,
                "session_key": groupSessionKey!.key,
                "chain_index": groupSessionKey!.chain_index,
                "forwarding_curve25519_key_chain": groupSessionKey!.forwarding_curve25519_key_chain,
                "org.matrix.msc3061.shared_history": true,
            },
            plaintype: "m.forwarded_room_key",
        });

        // Alice receives forwarded history from Becca
        expectAliceKeyQuery({ device_keys: { "@becca:localhost": {} }, failures: {} });
        syncResponder.sendOrQueueSyncResponse({
            next_batch: 1,
            to_device: { events: [encryptedForwardedKey] },
        });
        await syncPromise(aliceClient);

        // Alice is invited to the room by Charlie
        syncResponder.sendOrQueueSyncResponse({
            next_batch: 2,
            rooms: {
                invite: {
                    [ROOM_ID]: {
                        invite_state: {
                            events: [
                                {
                                    sender: "@becca:localhost",
                                    type: "m.room.encryption",
                                    state_key: "",
                                    content: {
                                        algorithm: "m.megolm.v1.aes-sha2",
                                    },
                                },
                                {
                                    sender: "@charlie:localhost",
                                    type: "m.room.member",
                                    state_key: "@alice:localhost",
                                    content: {
                                        membership: "invite",
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        });
        await syncPromise(aliceClient);

        // Alice has joined the room
        expectAliceKeyQuery({ device_keys: { "@becca:localhost": {}, "@charlie:localhost": {} }, failures: {} });
        syncResponder.sendOrQueueSyncResponse(
            getSyncResponse(["@alice:localhost", "@becca:localhost", "@charlie:localhost"]),
        );
        await syncPromise(aliceClient);

        // wait for the key/device downloads for becca and charlie to complete
        await aliceClient.downloadKeys(["@becca:localhost", "@charlie:localhost"]);

        syncResponder.sendOrQueueSyncResponse({
            next_batch: 4,
            rooms: {
                join: {
                    [ROOM_ID]: { timeline: { events: [event.event] } },
                },
            },
        });
        await syncPromise(aliceClient);

        // Decryption should fail, because Alice hasn't received any keys she can trust
        const room = aliceClient.getRoom(ROOM_ID)!;
        const roomEvent = room.getLiveTimeline().getEvents()[0];
        expect(roomEvent.isEncrypted()).toBe(true);
        const decryptedEvent = await testUtils.awaitDecryption(roomEvent);
        expect(decryptedEvent.isDecryptionFailure()).toBe(true);

        await beccaTestClient.stop();
    });

    oldBackendOnly("allows sending an encrypted event as soon as room state arrives", async () => {
        /* Empirically, clients expect to be able to send encrypted events as soon as the
         * RoomStateEvent.NewMember notification is emitted, so test that works correctly.
         */
        const testRoomId = "!testRoom:id";
        expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
        await startClientAndAwaitFirstSync();

        /* Alice makes the /createRoom call */
        fetchMock.postOnce(new RegExp("/createRoom"), { room_id: testRoomId });
        await aliceClient.createRoom({
            initial_state: [
                {
                    type: "m.room.encryption",
                    state_key: "",
                    content: { algorithm: "m.megolm.v1.aes-sha2" },
                },
            ],
        });

        /* The sync arrives in two parts; first the m.room.create... */
        syncResponder.sendOrQueueSyncResponse({
            rooms: {
                join: {
                    [testRoomId]: {
                        timeline: {
                            events: [
                                {
                                    type: "m.room.create",
                                    state_key: "",
                                    event_id: "$create",
                                },
                                {
                                    type: "m.room.member",
                                    state_key: aliceClient.getUserId(),
                                    content: { membership: "join" },
                                    event_id: "$alijoin",
                                },
                            ],
                        },
                    },
                },
            },
        });
        await syncPromise(aliceClient);

        // ... and then the e2e event and an invite ...
        syncResponder.sendOrQueueSyncResponse({
            rooms: {
                join: {
                    [testRoomId]: {
                        timeline: {
                            events: [
                                {
                                    type: "m.room.encryption",
                                    state_key: "",
                                    content: { algorithm: "m.megolm.v1.aes-sha2" },
                                    event_id: "$e2e",
                                },
                                {
                                    type: "m.room.member",
                                    state_key: "@other:user",
                                    content: { membership: "invite" },
                                    event_id: "$otherinvite",
                                },
                            ],
                        },
                    },
                },
            },
        });

        // as soon as the roomMember arrives, try to send a message
        expectAliceKeyQuery({ device_keys: { "@other:user": {} }, failures: {} });
        aliceClient.on(RoomStateEvent.NewMember, (_e, _s, member: RoomMember) => {
            if (member.userId == "@other:user") {
                aliceClient.sendMessage(testRoomId, { msgtype: "m.text", body: "Hello, World" });
            }
        });

        // flush the sync and wait for the /send/ request.
        const sendEventPromise = new Promise((resolve) => {
            fetchMock.putOnce(new RegExp("/send/m.room.encrypted/"), () => {
                resolve(undefined);
                return { event_id: "asdfgh" };
            });
        });
        await syncPromise(aliceClient);
        await sendEventPromise;
    });

    describe("Lazy-loading member lists", () => {
        let p2pSession: Olm.Session;

        beforeEach(async () => {
            // set up the aliceTestClient so that it is a room with no known members
            expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
            await startClientAndAwaitFirstSync({ lazyLoadMembers: true });
            aliceClient.setGlobalErrorOnUnknownDevices(false);

            syncResponder.sendOrQueueSyncResponse(getSyncResponse([]));
            await syncPromise(aliceClient);

            p2pSession = await establishOlmSession(aliceClient, keyReceiver, syncResponder, testOlmAccount);
        });

        async function expectMembershipRequest(roomId: string, members: string[]): Promise<void> {
            const membersPath = `/rooms/${encodeURIComponent(roomId)}/members\\?not_membership=leave`;
            fetchMock.getOnce(new RegExp(membersPath), {
                chunk: [
                    testUtils.mkMembershipCustom({
                        membership: "join",
                        sender: "@bob:xyz",
                    }),
                ],
            });
        }

        oldBackendOnly("Sending an event initiates a member list sync", async () => {
            // we expect a call to the /members list...
            const memberListPromise = expectMembershipRequest(ROOM_ID, ["@bob:xyz"]);

            // then a request for bob's devices...
            expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

            // then a to-device with the room_key
            const inboundGroupSessionPromise = expectSendRoomKey("@bob:xyz", testOlmAccount, p2pSession);

            // and finally the megolm message
            const megolmMessagePromise = expectSendMegolmMessage(inboundGroupSessionPromise);

            // kick it off
            const sendPromise = aliceClient.sendTextMessage(ROOM_ID, "test");

            await Promise.all([sendPromise, megolmMessagePromise, memberListPromise]);
        });

        oldBackendOnly("loading the membership list inhibits a later load", async () => {
            const room = aliceClient.getRoom(ROOM_ID)!;
            await Promise.all([room.loadMembersIfNeeded(), expectMembershipRequest(ROOM_ID, ["@bob:xyz"])]);

            // expect a request for bob's devices...
            expectAliceKeyQuery(getTestKeysQueryResponse("@bob:xyz"));

            // then a to-device with the room_key
            const inboundGroupSessionPromise = expectSendRoomKey("@bob:xyz", testOlmAccount, p2pSession);

            // and finally the megolm message
            const megolmMessagePromise = expectSendMegolmMessage(inboundGroupSessionPromise);

            // kick it off
            const sendPromise = aliceClient.sendTextMessage(ROOM_ID, "test");

            await Promise.all([sendPromise, megolmMessagePromise]);
        });
    });

    describe("m.room_key.withheld handling", () => {
        // TODO: there are a bunch more tests for this sort of thing in spec/unit/crypto/algorithms/megolm.spec.ts.
        //   They should be converted to integ tests and moved.

        oldBackendOnly("does not block decryption on an 'm.unavailable' report", async function () {
            // there may be a key downloads for alice
            expectAliceKeyQuery({ device_keys: {}, failures: {} });

            await startClientAndAwaitFirstSync();

            // encrypt a message with a group session.
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();
            const messageEncryptedEvent = encryptMegolmEvent({
                senderKey: testSenderKey,
                groupSession: groupSession,
                room_id: ROOM_ID,
            });

            // Alice gets the room message, but not the key
            syncResponder.sendOrQueueSyncResponse({
                next_batch: 1,
                rooms: {
                    join: { [ROOM_ID]: { timeline: { events: [messageEncryptedEvent] } } },
                },
            });
            await syncPromise(aliceClient);

            // alice will (eventually) send a room-key request
            fetchMock.putOnce(new RegExp("/sendToDevice/m.room_key_request/"), {});

            // at this point, the message should be a decryption failure
            const room = aliceClient.getRoom(ROOM_ID)!;
            const event = room.getLiveTimeline().getEvents()[0];
            expect(event.isDecryptionFailure()).toBeTruthy();

            // we want to wait for the message to be updated, so create a promise for it
            const retryPromise = new Promise((resolve) => {
                event.once(MatrixEventEvent.Decrypted, (ev) => {
                    resolve(ev);
                });
            });

            // alice gets back a room-key-withheld notification
            syncResponder.sendOrQueueSyncResponse({
                next_batch: 2,
                to_device: {
                    events: [
                        {
                            type: "m.room_key.withheld",
                            sender: "@bob:example.com",
                            content: {
                                algorithm: "m.megolm.v1.aes-sha2",
                                room_id: ROOM_ID,
                                session_id: groupSession.session_id(),
                                sender_key: testSenderKey,
                                code: "m.unavailable",
                                reason: "",
                            },
                        },
                    ],
                },
            });
            await syncPromise(aliceClient);

            // the withheld notification should trigger a retry; wait for it
            await retryPromise;

            // finally: the message should still be a regular decryption failure, not a withheld notification.
            expect(event.getContent().body).not.toContain("withheld");
        });
    });

    describe("key upload request", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        function awaitKeyUploadRequest(): Promise<{ keysCount: number; fallbackKeysCount: number }> {
            return new Promise((resolve) => {
                const listener = (url: string, options: RequestInit) => {
                    const content = JSON.parse(options.body as string);
                    const keysCount = Object.keys(content?.one_time_keys || {}).length;
                    const fallbackKeysCount = Object.keys(content?.fallback_keys || {}).length;
                    if (keysCount) resolve({ keysCount, fallbackKeysCount });
                    return {
                        one_time_key_counts: {
                            // The matrix client does `/upload` requests until 50 keys are uploaded
                            // We return here 60 to avoid the `/upload` request loop
                            signed_curve25519: keysCount ? 60 : keysCount,
                        },
                    };
                };

                for (const path of ["/_matrix/client/r0/keys/upload", "/_matrix/client/v3/keys/upload"]) {
                    fetchMock.post(new URL(path, aliceClient.getHomeserverUrl()).toString(), listener, {
                        // These routes are already defined in the E2EKeyReceiver
                        // We want to overwrite the behaviour of the E2EKeyReceiver
                        overwriteRoutes: true,
                    });
                }
            });
        }

        it("should make key upload request after sync", async () => {
            let uploadPromise = awaitKeyUploadRequest();
            expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
            await startClientAndAwaitFirstSync();

            syncResponder.sendOrQueueSyncResponse(getSyncResponse([]));

            await syncPromise(aliceClient);

            // Verify that `/upload` is called on Alice's homesever
            const { keysCount, fallbackKeysCount } = await uploadPromise;
            expect(keysCount).toBeGreaterThan(0);
            expect(fallbackKeysCount).toBe(0);

            uploadPromise = awaitKeyUploadRequest();
            syncResponder.sendOrQueueSyncResponse({
                next_batch: 2,
                device_one_time_keys_count: { signed_curve25519: 0 },
                device_unused_fallback_key_types: [],
            });

            // Advance local date to 2 minutes
            // The old crypto only runs the upload every 60 seconds
            jest.setSystemTime(Date.now() + 2 * 60 * 1000);

            await syncPromise(aliceClient);

            // After we set device_one_time_keys_count to 0
            // a `/upload` is expected
            const res = await uploadPromise;
            expect(res.keysCount).toBeGreaterThan(0);
            expect(res.fallbackKeysCount).toBeGreaterThan(0);
        });
    });

    describe("getUserDeviceInfo", () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        // From https://spec.matrix.org/v1.6/client-server-api/#post_matrixclientv3keysquery
        // Using extracted response from matrix.org, it needs to have real keys etc to pass old crypto verification
        const queryResponseBody = {
            device_keys: {
                "@testing_florian1:matrix.org": {
                    EBMMPAFOPU: {
                        algorithms: ["m.olm.v1.curve25519-aes-sha2", "m.megolm.v1.aes-sha2"],
                        device_id: "EBMMPAFOPU",
                        keys: {
                            "curve25519:EBMMPAFOPU": "HyhQD4mXwNViqns0noABW9NxHbCAOkriQ4QKGGndk3w",
                            "ed25519:EBMMPAFOPU": "xSQaxrFOTXH+7Zjo+iwb445hlNPFjnx1O3KaV3Am55k",
                        },
                        signatures: {
                            "@testing_florian1:matrix.org": {
                                "ed25519:EBMMPAFOPU":
                                    "XFJVq9HmO5lfJN7l6muaUt887aUHg0/poR3p9XHGXBrLUqzfG7Qllq7jjtUjtcTc5CMD7/mpsXfuC2eV+X1uAw",
                            },
                        },
                        user_id: "@testing_florian1:matrix.org",
                        unsigned: {
                            device_display_name: "display name",
                        },
                    },
                },
            },
            failures: {},
            master_keys: {
                "@testing_florian1:matrix.org": {
                    user_id: "@testing_florian1:matrix.org",
                    usage: ["master"],
                    keys: {
                        "ed25519:O5s5RoLaz93Bjf/pg55oJeCVeYYoruQhqEd0Mda6lq0":
                            "O5s5RoLaz93Bjf/pg55oJeCVeYYoruQhqEd0Mda6lq0",
                    },
                    signatures: {
                        "@testing_florian1:matrix.org": {
                            "ed25519:UKAQMJSJZC":
                                "q4GuzzuhZfTpwrlqnJ9+AEUtEfEQ0um1PO3puwp/+vidzFicw0xEPjedpJoASYQIJ8XJAAWX8Q235EKeCzEXCA",
                        },
                    },
                },
            },
            self_signing_keys: {
                "@testing_florian1:matrix.org": {
                    user_id: "@testing_florian1:matrix.org",
                    usage: ["self_signing"],
                    keys: {
                        "ed25519:YYWIHBCuKGEy9CXiVrfBVR0N1I60JtiJTNCWjiLAFzo":
                            "YYWIHBCuKGEy9CXiVrfBVR0N1I60JtiJTNCWjiLAFzo",
                    },
                    signatures: {
                        "@testing_florian1:matrix.org": {
                            "ed25519:O5s5RoLaz93Bjf/pg55oJeCVeYYoruQhqEd0Mda6lq0":
                                "yckmxgQ3JA5bb205/RunJipnpZ37ycGNf4OFzDwAad++chd71aGHqAMQ1f6D2GVfl8XdHmiRaohZf4mGnDL0AA",
                        },
                    },
                },
            },
            user_signing_keys: {
                "@testing_florian1:matrix.org": {
                    user_id: "@testing_florian1:matrix.org",
                    usage: ["user_signing"],
                    keys: {
                        "ed25519:Maa77okgZxnABGqaiChEUnV4rVsAI61WXWeL5TSEUhs":
                            "Maa77okgZxnABGqaiChEUnV4rVsAI61WXWeL5TSEUhs",
                    },
                    signatures: {
                        "@testing_florian1:matrix.org": {
                            "ed25519:O5s5RoLaz93Bjf/pg55oJeCVeYYoruQhqEd0Mda6lq0":
                                "WxNNXb13yCrBwXUQzdDWDvWSQ/qWCfwpvssOudlAgbtMzRESMbCTDkeA8sS1awaAtUmu7FrPtDb5LYfK/EE2CQ",
                        },
                    },
                },
            },
        };

        function awaitKeyQueryRequest(): Promise<Record<string, []>> {
            return new Promise((resolve) => {
                const listener = (url: string, options: RequestInit) => {
                    const content = JSON.parse(options.body as string);
                    // Resolve with request payload
                    resolve(content.device_keys);

                    // Return response of `/keys/query`
                    return queryResponseBody;
                };

                for (const path of ["/_matrix/client/r0/keys/query", "/_matrix/client/v3/keys/query"]) {
                    fetchMock.post(new URL(path, aliceClient.getHomeserverUrl()).toString(), listener);
                }
            });
        }

        it("Download uncached keys for known user", async () => {
            const queryPromise = awaitKeyQueryRequest();

            const user = "@testing_florian1:matrix.org";
            const devicesInfo = await aliceClient.getCrypto()!.getUserDeviceInfo([user], true);

            // Wait for `/keys/query` to be called
            const deviceKeysPayload = await queryPromise;

            expect(deviceKeysPayload).toStrictEqual({ [user]: [] });
            expect(devicesInfo.get(user)?.size).toBe(1);

            // Convert the expected device to IDevice and check
            expect(devicesInfo.get(user)?.get("EBMMPAFOPU")).toStrictEqual(
                downloadDeviceToJsDevice(queryResponseBody.device_keys[user]?.EBMMPAFOPU),
            );
        });

        it("Download uncached keys for unknown user", async () => {
            const queryPromise = awaitKeyQueryRequest();

            const user = "@bob:xyz";
            const devicesInfo = await aliceClient.getCrypto()!.getUserDeviceInfo([user], true);

            // Wait for `/keys/query` to be called
            const deviceKeysPayload = await queryPromise;

            expect(deviceKeysPayload).toStrictEqual({ [user]: [] });
            // The old crypto has an empty map for `@bob:xyz`
            // The new crypto does not have the `@bob:xyz` entry in `devicesInfo`
            expect(devicesInfo.get(user)?.size).toBeFalsy();
        });

        it("Get devices from tacked users", async () => {
            jest.useFakeTimers();

            expectAliceKeyQuery({ device_keys: { "@alice:localhost": {} }, failures: {} });
            await startClientAndAwaitFirstSync();
            const queryPromise = awaitKeyQueryRequest();

            const user = "@testing_florian1:matrix.org";
            // `user` will be added to the room
            syncResponder.sendOrQueueSyncResponse(getSyncResponse([user, "@bob:xyz"]));

            // Advance local date to 2 minutes
            // The old crypto only runs the upload every 60 seconds
            jest.setSystemTime(Date.now() + 2 * 60 * 1000);

            await syncPromise(aliceClient);

            // Old crypto: for alice: run over the `sleep(5)` in `doQueuedQueries` of `DeviceList`
            jest.runAllTimers();
            // Old crypto: for alice: run the `processQueryResponseForUser` in `doQueuedQueries` of `DeviceList`
            await flushPromises();

            // Wait for alice to query `user` keys
            await queryPromise;

            // Old crypto: for `user`: run over the `sleep(5)` in `doQueuedQueries` of `DeviceList`
            jest.runAllTimers();
            // Old crypto: for `user`: run the `processQueryResponseForUser` in `doQueuedQueries` of `DeviceList`
            // It will add `@testing_florian1:matrix.org` devices to the DeviceList
            await flushPromises();

            const devicesInfo = await aliceClient.getCrypto()!.getUserDeviceInfo([user]);

            // We should only have the `user` in it
            expect(devicesInfo.size).toBe(1);
            // We are expecting only the EBMMPAFOPU device
            expect(devicesInfo.get(user)!.size).toBe(1);
            expect(devicesInfo.get(user)!.get("EBMMPAFOPU")).toEqual(
                downloadDeviceToJsDevice(queryResponseBody.device_keys[user]["EBMMPAFOPU"]),
            );
        });
    });
});
