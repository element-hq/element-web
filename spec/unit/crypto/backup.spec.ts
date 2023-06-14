/*
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

import "../../olm-loader";
import { logger } from "../../../src/logger";
import * as olmlib from "../../../src/crypto/olmlib";
import { MatrixClient } from "../../../src/client";
import { MatrixEvent } from "../../../src/models/event";
import * as algorithms from "../../../src/crypto/algorithms";
import { MemoryCryptoStore } from "../../../src/crypto/store/memory-crypto-store";
import * as testUtils from "../../test-utils/test-utils";
import { OlmDevice } from "../../../src/crypto/OlmDevice";
import { Crypto } from "../../../src/crypto";
import { resetCrossSigningKeys } from "./crypto-utils";
import { BackupManager } from "../../../src/crypto/backup";
import { StubStore } from "../../../src/store/stub";
import { IndexedDBCryptoStore, MatrixScheduler } from "../../../src";
import { CryptoStore } from "../../../src/crypto/store/base";
import { MegolmDecryption as MegolmDecryptionClass } from "../../../src/crypto/algorithms/megolm";
import { IKeyBackupInfo } from "../../../src/crypto/keybackup";

const Olm = global.Olm;

const MegolmDecryption = algorithms.DECRYPTION_CLASSES.get("m.megolm.v1.aes-sha2")!;

const ROOM_ID = "!ROOM:ID";

const SESSION_ID = "o+21hSjP+mgEmcfdslPsQdvzWnkdt0Wyo00Kp++R8Kc";
const ENCRYPTED_EVENT = new MatrixEvent({
    type: "m.room.encrypted",
    room_id: "!ROOM:ID",
    content: {
        algorithm: "m.megolm.v1.aes-sha2",
        sender_key: "SENDER_CURVE25519",
        session_id: SESSION_ID,
        ciphertext:
            "AwgAEjD+VwXZ7PoGPRS/H4kwpAsMp/g+WPvJVtPEKE8fmM9IcT/N" +
            "CiwPb8PehecDKP0cjm1XO88k6Bw3D17aGiBHr5iBoP7oSw8CXULXAMTkBl" +
            "mkufRQq2+d0Giy1s4/Cg5n13jSVrSb2q7VTSv1ZHAFjUCsLSfR0gxqcQs",
    },
    event_id: "$event1",
    origin_server_ts: 1507753886000,
});

const CURVE25519_KEY_BACKUP_DATA = {
    first_message_index: 0,
    forwarded_count: 0,
    is_verified: false,
    session_data: {
        ciphertext:
            "2z2M7CZ+azAiTHN1oFzZ3smAFFt+LEOYY6h3QO3XXGdw" +
            "6YpNn/gpHDO6I/rgj1zNd4FoTmzcQgvKdU8kN20u5BWRHxaHTZ" +
            "Slne5RxE6vUdREsBgZePglBNyG0AogR/PVdcrv/v18Y6rLM5O9" +
            "SELmwbV63uV9Kuu/misMxoqbuqEdG7uujyaEKtjlQsJ5MGPQOy" +
            "Syw7XrnesSwF6XWRMxcPGRV0xZr3s9PI350Wve3EncjRgJ9IGF" +
            "ru1bcptMqfXgPZkOyGvrphHoFfoK7nY3xMEHUiaTRfRIjq8HNV" +
            "4o8QY1qmWGnxNBQgOlL8MZlykjg3ULmQ3DtFfQPj/YYGS3jzxv" +
            "C+EBjaafmsg+52CTeK3Rswu72PX450BnSZ1i3If4xWAUKvjTpe" +
            "Ug5aDLqttOv1pITolTJDw5W/SD+b5rjEKg1CFCHGEGE9wwV3Nf" +
            "QHVCQL+dfpd7Or0poy4dqKMAi3g0o3Tg7edIF8d5rREmxaALPy" +
            "iie8PHD8mj/5Y0GLqrac4CD6+Mop7eUTzVovprjg",
        mac: "5lxYBHQU80M",
        ephemeral: "/Bn0A4UMFwJaDDvh0aEk1XZj3k1IfgCxgFY9P9a0b14",
    },
};

const AES256_KEY_BACKUP_DATA = {
    first_message_index: 0,
    forwarded_count: 0,
    is_verified: false,
    session_data: {
        iv: "b3Jqqvm5S9QdmXrzssspLQ",
        ciphertext:
            "GOOASO3E9ThogkG0zMjEduGLM3u9jHZTkS7AvNNbNj3q1znwk4OlaVKXce" +
            "7ynofiiYIiS865VlOqrKEEXv96XzRyUpgn68e3WsicwYl96EtjIEh/iY003PG2Qd" +
            "EluT899Ax7PydpUHxEktbWckMppYomUR5q8x1KI1SsOQIiJaIGThmIMPANRCFiK0" +
            "WQj+q+dnhzx4lt9AFqU5bKov8qKnw2qGYP7/+6RmJ0Kpvs8tG6lrcNDEHtFc2r0r" +
            "KKubDypo0Vc8EWSwsAHdKa36ewRavpreOuE8Z9RLfY0QIR1ecXrMqW0CdGFr7H3P" +
            "vcjF8sjwvQAavzxEKT1WMGizSMLeKWo2mgZ5cKnwV5HGUAw596JQvKs9laG2U89K" +
            "YrT0sH30vi62HKzcBLcDkWkUSNYPz7UiZ1MM0L380UA+1ZOXSOmtBA9xxzzbc8Xd" +
            "fRimVgklGdxrxjzuNLYhL2BvVH4oPWonD9j0bvRwE6XkimdbGQA8HB7UmXXjE8WA" +
            "RgaDHkfzoA3g3aeQ",
        mac: "uR988UYgGL99jrvLLPX3V1ows+UYbktTmMxPAo2kxnU",
    },
};

const CURVE25519_BACKUP_INFO = {
    algorithm: olmlib.MEGOLM_BACKUP_ALGORITHM,
    version: "1",
    auth_data: {
        public_key: "hSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo",
    },
};

const AES256_BACKUP_INFO: IKeyBackupInfo = {
    algorithm: "org.matrix.msc3270.v1.aes-hmac-sha2",
    version: "1",
    auth_data: {} as IKeyBackupInfo["auth_data"],
};

const keys: Record<string, Uint8Array> = {};

function getCrossSigningKey(type: string) {
    return Promise.resolve(keys[type]);
}

function saveCrossSigningKeys(k: Record<string, Uint8Array>) {
    Object.assign(keys, k);
}

function makeTestScheduler(): MatrixScheduler {
    return (["getQueueForEvent", "queueEvent", "removeEventFromQueue", "setProcessFunction"] as const).reduce(
        (r, k) => {
            r[k] = jest.fn();
            return r;
        },
        {} as MatrixScheduler,
    );
}

function makeTestClient(cryptoStore: CryptoStore) {
    const scheduler = makeTestScheduler();
    const store = new StubStore();

    const client = new MatrixClient({
        baseUrl: "https://my.home.server",
        idBaseUrl: "https://identity.server",
        accessToken: "my.access.token",
        fetchFn: jest.fn(), // NOP
        store: store,
        scheduler: scheduler,
        userId: "@alice:bar",
        deviceId: "device",
        cryptoStore: cryptoStore,
        cryptoCallbacks: { getCrossSigningKey, saveCrossSigningKeys },
    });

    // initialising the crypto library will trigger a key upload request, which we can stub out
    client.uploadKeysRequest = jest.fn();
    return client;
}

describe("MegolmBackup", function () {
    if (!global.Olm) {
        logger.warn("Not running megolm backup unit tests: libolm not present");
        return;
    }

    beforeAll(function () {
        return Olm.init();
    });

    let olmDevice: OlmDevice;
    let mockOlmLib: typeof olmlib;
    let mockCrypto: Crypto;
    let cryptoStore: CryptoStore;
    let megolmDecryption: MegolmDecryptionClass;
    beforeEach(async function () {
        mockCrypto = testUtils.mock(Crypto, "Crypto");
        // @ts-ignore making mock
        mockCrypto.backupManager = testUtils.mock(BackupManager, "BackupManager");
        mockCrypto.backupManager.backupInfo = CURVE25519_BACKUP_INFO;

        cryptoStore = new MemoryCryptoStore();

        olmDevice = new OlmDevice(cryptoStore);

        // we stub out the olm encryption bits
        mockOlmLib = {} as unknown as typeof olmlib;
        mockOlmLib.ensureOlmSessionsForDevices = jest.fn();
        mockOlmLib.encryptMessageForDevice = jest.fn().mockResolvedValue(undefined);
    });

    describe("backup", function () {
        let mockBaseApis: MatrixClient;

        beforeEach(function () {
            mockBaseApis = {} as unknown as MatrixClient;

            megolmDecryption = new MegolmDecryption({
                userId: "@user:id",
                crypto: mockCrypto,
                olmDevice: olmDevice,
                baseApis: mockBaseApis,
                roomId: ROOM_ID,
            }) as MegolmDecryptionClass;

            // @ts-ignore private field access
            megolmDecryption.olmlib = mockOlmLib;

            // clobber the setTimeout function to run 100x faster.
            // ideally we would use lolex, but we have no oportunity
            // to tick the clock between the first try and the retry.
            const realSetTimeout = global.setTimeout;
            jest.spyOn(global, "setTimeout").mockImplementation(function (f, n) {
                return realSetTimeout(f!, n! / 100);
            });
        });

        afterEach(function () {
            jest.spyOn(global, "setTimeout").mockRestore();
        });

        it("automatically calls the key back up", function () {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();

            // construct a fake decrypted key event via the use of a mocked
            // 'crypto' implementation.
            const event = new MatrixEvent({
                type: "m.room.encrypted",
            });
            event.getWireType = () => "m.room.encrypted";
            event.getWireContent = () => {
                return {
                    algorithm: "m.olm.v1.curve25519-aes-sha2",
                };
            };
            const decryptedData = {
                clearEvent: {
                    type: "m.room_key",
                    content: {
                        algorithm: "m.megolm.v1.aes-sha2",
                        room_id: ROOM_ID,
                        session_id: groupSession.session_id(),
                        session_key: groupSession.session_key(),
                    },
                },
                senderCurve25519Key: "SENDER_CURVE25519",
                claimedEd25519Key: "SENDER_ED25519",
            };

            mockCrypto.decryptEvent = function () {
                return Promise.resolve(decryptedData);
            };
            mockCrypto.cancelRoomKeyRequest = function () {};

            // @ts-ignore readonly field write
            mockCrypto.backupManager = {
                backupGroupSession: jest.fn(),
            };

            return event
                .attemptDecryption(mockCrypto)
                .then(() => {
                    return megolmDecryption.onRoomKeyEvent(event);
                })
                .then(() => {
                    expect(mockCrypto.backupManager.backupGroupSession).toHaveBeenCalled();
                });
        });

        it("sends backups to the server (Curve25519 version)", function () {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();
            const ibGroupSession = new Olm.InboundGroupSession();
            ibGroupSession.create(groupSession.session_key());

            const client = makeTestClient(cryptoStore);

            megolmDecryption = new MegolmDecryption({
                userId: "@user:id",
                crypto: mockCrypto,
                olmDevice: olmDevice,
                baseApis: client,
                roomId: ROOM_ID,
            }) as MegolmDecryptionClass;

            // @ts-ignore private field access
            megolmDecryption.olmlib = mockOlmLib;

            return client
                .initCrypto()
                .then(() => {
                    return cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_SESSIONS], (txn) => {
                        cryptoStore.addEndToEndInboundGroupSession(
                            "F0Q2NmyJNgUVj9DGsb4ZQt3aVxhVcUQhg7+gvW0oyKI",
                            groupSession.session_id(),
                            {
                                forwardingCurve25519KeyChain: undefined!,
                                keysClaimed: {
                                    ed25519: "SENDER_ED25519",
                                },
                                room_id: ROOM_ID,
                                session: ibGroupSession.pickle(olmDevice.pickleKey),
                            },
                            txn,
                        );
                    });
                })
                .then(async () => {
                    await client.enableKeyBackup({
                        algorithm: olmlib.MEGOLM_BACKUP_ALGORITHM,
                        version: "1",
                        auth_data: {
                            public_key: "hSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo",
                        },
                    });
                    let numCalls = 0;
                    return new Promise<void>((resolve, reject) => {
                        client.http.authedRequest = function (method, path, queryParams, data, opts): any {
                            ++numCalls;
                            expect(numCalls).toBeLessThanOrEqual(1);
                            if (numCalls >= 2) {
                                // exit out of retry loop if there's something wrong
                                reject(new Error("authedRequest called too many timmes"));
                                return Promise.resolve({});
                            }
                            expect(method).toBe("PUT");
                            expect(path).toBe("/room_keys/keys");
                            expect(queryParams?.version).toBe("1");
                            expect((data as Record<string, any>).rooms[ROOM_ID].sessions).toBeDefined();
                            expect((data as Record<string, any>).rooms[ROOM_ID].sessions).toHaveProperty(
                                groupSession.session_id(),
                            );
                            resolve();
                            return Promise.resolve({});
                        };
                        client.crypto!.backupManager.backupGroupSession(
                            "F0Q2NmyJNgUVj9DGsb4ZQt3aVxhVcUQhg7+gvW0oyKI",
                            groupSession.session_id(),
                        );
                    }).then(() => {
                        expect(numCalls).toBe(1);
                        client.stopClient();
                    });
                });
        });

        it("sends backups to the server (AES-256 version)", function () {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();
            const ibGroupSession = new Olm.InboundGroupSession();
            ibGroupSession.create(groupSession.session_key());

            const client = makeTestClient(cryptoStore);

            megolmDecryption = new MegolmDecryption({
                userId: "@user:id",
                crypto: mockCrypto,
                olmDevice: olmDevice,
                baseApis: client,
                roomId: ROOM_ID,
            }) as MegolmDecryptionClass;

            // @ts-ignore private field access
            megolmDecryption.olmlib = mockOlmLib;

            return client
                .initCrypto()
                .then(() => {
                    return client.crypto!.storeSessionBackupPrivateKey(new Uint8Array(32));
                })
                .then(() => {
                    return cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_SESSIONS], (txn) => {
                        cryptoStore.addEndToEndInboundGroupSession(
                            "F0Q2NmyJNgUVj9DGsb4ZQt3aVxhVcUQhg7+gvW0oyKI",
                            groupSession.session_id(),
                            {
                                forwardingCurve25519KeyChain: undefined!,
                                keysClaimed: {
                                    ed25519: "SENDER_ED25519",
                                },
                                room_id: ROOM_ID,
                                session: ibGroupSession.pickle(olmDevice.pickleKey),
                            },
                            txn,
                        );
                    });
                })
                .then(async () => {
                    await client.enableKeyBackup({
                        algorithm: "org.matrix.msc3270.v1.aes-hmac-sha2",
                        version: "1",
                        auth_data: {
                            iv: "PsCAtR7gMc4xBd9YS3A9Ow",
                            mac: "ZSDsTFEZK7QzlauCLMleUcX96GQZZM7UNtk4sripSqQ",
                        },
                    });
                    let numCalls = 0;
                    return new Promise<void>((resolve, reject) => {
                        client.http.authedRequest = function (method, path, queryParams, data, opts): any {
                            ++numCalls;
                            expect(numCalls).toBeLessThanOrEqual(1);
                            if (numCalls >= 2) {
                                // exit out of retry loop if there's something wrong
                                reject(new Error("authedRequest called too many timmes"));
                                return Promise.resolve({});
                            }
                            expect(method).toBe("PUT");
                            expect(path).toBe("/room_keys/keys");
                            expect(queryParams?.version).toBe("1");
                            expect((data as Record<string, any>).rooms[ROOM_ID].sessions).toBeDefined();
                            expect((data as Record<string, any>).rooms[ROOM_ID].sessions).toHaveProperty(
                                groupSession.session_id(),
                            );
                            resolve();
                            return Promise.resolve({});
                        };
                        client.crypto!.backupManager.backupGroupSession(
                            "F0Q2NmyJNgUVj9DGsb4ZQt3aVxhVcUQhg7+gvW0oyKI",
                            groupSession.session_id(),
                        );
                    }).then(() => {
                        expect(numCalls).toBe(1);
                        client.stopClient();
                    });
                });
        });

        it("signs backups with the cross-signing master key", async function () {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();
            const ibGroupSession = new Olm.InboundGroupSession();
            ibGroupSession.create(groupSession.session_key());

            const client = makeTestClient(cryptoStore);

            megolmDecryption = new MegolmDecryption({
                userId: "@user:id",
                crypto: mockCrypto,
                olmDevice: olmDevice,
                baseApis: client,
                roomId: ROOM_ID,
            }) as MegolmDecryptionClass;

            // @ts-ignore private field access
            megolmDecryption.olmlib = mockOlmLib;

            await client.initCrypto();
            client.uploadDeviceSigningKeys = async function (e) {
                return {};
            };
            client.uploadKeySignatures = async function (e) {
                return { failures: {} };
            };
            await resetCrossSigningKeys(client);
            let numCalls = 0;
            await Promise.all([
                new Promise<void>((resolve, reject) => {
                    let backupInfo: Record<string, any> | BodyInit | undefined;
                    client.http.authedRequest = function (method, path, queryParams, data, opts): any {
                        ++numCalls;
                        expect(numCalls).toBeLessThanOrEqual(2);
                        /* eslint-disable jest/no-conditional-expect */
                        if (numCalls === 1) {
                            expect(method).toBe("POST");
                            expect(path).toBe("/room_keys/version");
                            try {
                                // make sure auth_data is signed by the master key
                                olmlib.pkVerify(
                                    (data as Record<string, any>).auth_data,
                                    client.getCrossSigningId()!,
                                    "@alice:bar",
                                );
                            } catch (e) {
                                reject(e);
                                return Promise.resolve({});
                            }
                            backupInfo = data;
                            return Promise.resolve({});
                        } else if (numCalls === 2) {
                            expect(method).toBe("GET");
                            expect(path).toBe("/room_keys/version");
                            resolve();
                            return Promise.resolve(backupInfo);
                        } else {
                            // exit out of retry loop if there's something wrong
                            reject(new Error("authedRequest called too many times"));
                            return Promise.resolve({});
                        }
                        /* eslint-enable jest/no-conditional-expect */
                    };
                }),
                client.createKeyBackupVersion({
                    algorithm: olmlib.MEGOLM_BACKUP_ALGORITHM,
                    auth_data: {
                        public_key: "hSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo",
                    },
                }),
            ]);
            expect(numCalls).toBe(2);
            client.stopClient();
        });

        it("retries when a backup fails", async function () {
            const groupSession = new Olm.OutboundGroupSession();
            groupSession.create();
            const ibGroupSession = new Olm.InboundGroupSession();
            ibGroupSession.create(groupSession.session_key());

            const scheduler = makeTestScheduler();
            const store = new StubStore();
            const client = new MatrixClient({
                baseUrl: "https://my.home.server",
                idBaseUrl: "https://identity.server",
                accessToken: "my.access.token",
                fetchFn: jest.fn(), // NOP
                store: store,
                scheduler: scheduler,
                userId: "@alice:bar",
                deviceId: "device",
                cryptoStore: cryptoStore,
            });
            // initialising the crypto library will trigger a key upload request, which we can stub out
            client.uploadKeysRequest = jest.fn();

            megolmDecryption = new MegolmDecryption({
                userId: "@user:id",
                crypto: mockCrypto,
                olmDevice: olmDevice,
                baseApis: client,
                roomId: ROOM_ID,
            }) as MegolmDecryptionClass;

            // @ts-ignore private field access
            megolmDecryption.olmlib = mockOlmLib;

            await client.initCrypto();
            await cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_SESSIONS], (txn) => {
                cryptoStore.addEndToEndInboundGroupSession(
                    "F0Q2NmyJNgUVj9DGsb4ZQt3aVxhVcUQhg7+gvW0oyKI",
                    groupSession.session_id(),
                    {
                        forwardingCurve25519KeyChain: undefined!,
                        keysClaimed: {
                            ed25519: "SENDER_ED25519",
                        },
                        room_id: ROOM_ID,
                        session: ibGroupSession.pickle(olmDevice.pickleKey),
                    },
                    txn,
                );
            });

            await client.enableKeyBackup({
                algorithm: olmlib.MEGOLM_BACKUP_ALGORITHM,
                version: "1",
                auth_data: {
                    public_key: "hSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo",
                },
            });
            let numCalls = 0;

            await new Promise<void>((resolve, reject) => {
                client.http.authedRequest = function (method, path, queryParams, data, opts): any {
                    ++numCalls;
                    expect(numCalls).toBeLessThanOrEqual(2);
                    if (numCalls >= 3) {
                        // exit out of retry loop if there's something wrong
                        reject(new Error("authedRequest called too many timmes"));
                        return Promise.resolve({});
                    }
                    expect(method).toBe("PUT");
                    expect(path).toBe("/room_keys/keys");
                    expect(queryParams?.version).toBe("1");
                    expect((data as Record<string, any>).rooms[ROOM_ID].sessions).toBeDefined();
                    expect((data as Record<string, any>).rooms[ROOM_ID].sessions).toHaveProperty(
                        groupSession.session_id(),
                    );
                    if (numCalls > 1) {
                        resolve();
                        return Promise.resolve({});
                    } else {
                        return Promise.reject(new Error("this is an expected failure"));
                    }
                };
                return client.crypto!.backupManager.backupGroupSession(
                    "F0Q2NmyJNgUVj9DGsb4ZQt3aVxhVcUQhg7+gvW0oyKI",
                    groupSession.session_id(),
                );
            });
            expect(numCalls).toBe(2);
            client.stopClient();
        });
    });

    describe("restore", function () {
        let client: MatrixClient;

        beforeEach(function () {
            client = makeTestClient(cryptoStore);

            megolmDecryption = new MegolmDecryption({
                userId: "@user:id",
                crypto: mockCrypto,
                olmDevice: olmDevice,
                baseApis: client,
                roomId: ROOM_ID,
            }) as MegolmDecryptionClass;

            // @ts-ignore private field access
            megolmDecryption.olmlib = mockOlmLib;

            return client.initCrypto();
        });

        afterEach(function () {
            client.stopClient();
        });

        it("can restore from backup (Curve25519 version)", function () {
            client.http.authedRequest = function () {
                return Promise.resolve<any>(CURVE25519_KEY_BACKUP_DATA);
            };
            return client
                .restoreKeyBackupWithRecoveryKey(
                    "EsTc LW2K PGiF wKEA 3As5 g5c4 BXwk qeeJ ZJV8 Q9fu gUMN UE4d",
                    ROOM_ID,
                    SESSION_ID,
                    CURVE25519_BACKUP_INFO,
                )
                .then(() => {
                    return megolmDecryption.decryptEvent(ENCRYPTED_EVENT);
                })
                .then((res) => {
                    expect(res.clearEvent.content).toEqual("testytest");
                    expect(res.untrusted).toBeTruthy(); // keys from Curve25519 backup are untrusted
                });
        });

        it("can restore from backup (AES-256 version)", function () {
            client.http.authedRequest = function () {
                return Promise.resolve<any>(AES256_KEY_BACKUP_DATA);
            };
            return client
                .restoreKeyBackupWithRecoveryKey(
                    "EsTc LW2K PGiF wKEA 3As5 g5c4 BXwk qeeJ ZJV8 Q9fu gUMN UE4d",
                    ROOM_ID,
                    SESSION_ID,
                    AES256_BACKUP_INFO,
                )
                .then(() => {
                    return megolmDecryption.decryptEvent(ENCRYPTED_EVENT);
                })
                .then((res) => {
                    expect(res.clearEvent.content).toEqual("testytest");
                    expect(res.untrusted).toBeFalsy(); // keys from AES backup are trusted
                });
        });

        it("can restore backup by room (Curve25519 version)", function () {
            client.http.authedRequest = function () {
                return Promise.resolve<any>({
                    rooms: {
                        [ROOM_ID]: {
                            sessions: {
                                [SESSION_ID]: CURVE25519_KEY_BACKUP_DATA,
                            },
                        },
                    },
                });
            };
            return client
                .restoreKeyBackupWithRecoveryKey(
                    "EsTc LW2K PGiF wKEA 3As5 g5c4 BXwk qeeJ ZJV8 Q9fu gUMN UE4d",
                    null!,
                    null!,
                    CURVE25519_BACKUP_INFO,
                )
                .then(() => {
                    return megolmDecryption.decryptEvent(ENCRYPTED_EVENT);
                })
                .then((res) => {
                    expect(res.clearEvent.content).toEqual("testytest");
                });
        });

        it("has working cache functions", async function () {
            const key = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
            await client.crypto!.storeSessionBackupPrivateKey(key);
            const result = await client.crypto!.getSessionBackupPrivateKey();
            expect(new Uint8Array(result!)).toEqual(key);
        });

        it("caches session backup keys as it encounters them", async function () {
            const cachedNull = await client.crypto!.getSessionBackupPrivateKey();
            expect(cachedNull).toBeNull();
            client.http.authedRequest = function () {
                return Promise.resolve<any>(CURVE25519_KEY_BACKUP_DATA);
            };
            await new Promise<void>((resolve) => {
                client.restoreKeyBackupWithRecoveryKey(
                    "EsTc LW2K PGiF wKEA 3As5 g5c4 BXwk qeeJ ZJV8 Q9fu gUMN UE4d",
                    ROOM_ID,
                    SESSION_ID,
                    CURVE25519_BACKUP_INFO,
                    { cacheCompleteCallback: resolve },
                );
            });
            const cachedKey = await client.crypto!.getSessionBackupPrivateKey();
            expect(cachedKey).not.toBeNull();
        });

        it("fails if an known algorithm is used", async function () {
            const BAD_BACKUP_INFO = Object.assign({}, CURVE25519_BACKUP_INFO, {
                algorithm: "this.algorithm.does.not.exist",
            });
            client.http.authedRequest = function () {
                return Promise.resolve<any>(CURVE25519_KEY_BACKUP_DATA);
            };

            await expect(
                client.restoreKeyBackupWithRecoveryKey(
                    "EsTc LW2K PGiF wKEA 3As5 g5c4 BXwk qeeJ ZJV8 Q9fu gUMN UE4d",
                    ROOM_ID,
                    SESSION_ID,
                    BAD_BACKUP_INFO,
                ),
            ).rejects.toThrow();
        });
    });

    describe("flagAllGroupSessionsForBackup", () => {
        it("should return number of sesions needing backup", async () => {
            const scheduler = makeTestScheduler();
            const store = new StubStore();
            const client = new MatrixClient({
                baseUrl: "https://my.home.server",
                idBaseUrl: "https://identity.server",
                accessToken: "my.access.token",
                fetchFn: jest.fn(), // NOP
                store,
                scheduler,
                userId: "@alice:bar",
                deviceId: "device",
                cryptoStore,
            });
            // initialising the crypto library will trigger a key upload request, which we can stub out
            client.uploadKeysRequest = jest.fn();

            await client.initCrypto();

            cryptoStore.countSessionsNeedingBackup = jest.fn().mockReturnValue(6);
            await expect(client.flagAllGroupSessionsForBackup()).resolves.toBe(6);
            client.stopClient();
        });
    });
});
