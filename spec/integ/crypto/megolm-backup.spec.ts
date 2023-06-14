/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { Account } from "@matrix-org/olm";

import { logger } from "../../../src/logger";
import { decodeRecoveryKey } from "../../../src/crypto/recoverykey";
import { IKeyBackupInfo, IKeyBackupSession } from "../../../src/crypto/keybackup";
import { TestClient } from "../../TestClient";
import { IEvent } from "../../../src";
import { MatrixEvent, MatrixEventEvent } from "../../../src/models/event";

const ROOM_ID = "!ROOM:ID";

const SESSION_ID = "o+21hSjP+mgEmcfdslPsQdvzWnkdt0Wyo00Kp++R8Kc";

const ENCRYPTED_EVENT: Partial<IEvent> = {
    type: "m.room.encrypted",
    content: {
        algorithm: "m.megolm.v1.aes-sha2",
        sender_key: "SENDER_CURVE25519",
        session_id: SESSION_ID,
        ciphertext:
            "AwgAEjD+VwXZ7PoGPRS/H4kwpAsMp/g+WPvJVtPEKE8fmM9IcT/N" +
            "CiwPb8PehecDKP0cjm1XO88k6Bw3D17aGiBHr5iBoP7oSw8CXULXAMTkBl" +
            "mkufRQq2+d0Giy1s4/Cg5n13jSVrSb2q7VTSv1ZHAFjUCsLSfR0gxqcQs",
    },
    room_id: "!ROOM:ID",
    event_id: "$event1",
    origin_server_ts: 1507753886000,
};

const CURVE25519_KEY_BACKUP_DATA: IKeyBackupSession = {
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

const CURVE25519_BACKUP_INFO: IKeyBackupInfo = {
    algorithm: "m.megolm_backup.v1.curve25519-aes-sha2",
    version: "1",
    auth_data: {
        public_key: "hSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo",
    },
};

const RECOVERY_KEY = "EsTc LW2K PGiF wKEA 3As5 g5c4 BXwk qeeJ ZJV8 Q9fu gUMN UE4d";

/**
 * start an Olm session with a given recipient
 */
function createOlmSession(olmAccount: Olm.Account, recipientTestClient: TestClient): Promise<Olm.Session> {
    return recipientTestClient.awaitOneTimeKeyUpload().then((keys) => {
        const otkId = Object.keys(keys)[0];
        const otk = keys[otkId];

        const session = new global.Olm.Session();
        session.create_outbound(olmAccount, recipientTestClient.getDeviceKey(), otk.key);
        return session;
    });
}

describe("megolm key backups", function () {
    if (!global.Olm) {
        logger.warn("not running megolm tests: Olm not present");
        return;
    }
    const Olm = global.Olm;
    let testOlmAccount: Olm.Account;
    let aliceTestClient: TestClient;

    const setupTestClient = (): [Account, TestClient] => {
        const aliceTestClient = new TestClient("@alice:localhost", "xzcvb", "akjgkrgjs");
        const testOlmAccount = new Olm.Account();
        testOlmAccount!.create();

        return [testOlmAccount, aliceTestClient];
    };

    beforeAll(function () {
        return Olm.init();
    });

    beforeEach(async function () {
        [testOlmAccount, aliceTestClient] = setupTestClient();
        await aliceTestClient!.client.initCrypto();
        aliceTestClient!.client.crypto!.backupManager.backupInfo = CURVE25519_BACKUP_INFO;
    });

    afterEach(function () {
        return aliceTestClient!.stop();
    });

    it("Alice checks key backups when receiving a message she can't decrypt", function () {
        const syncResponse = {
            next_batch: 1,
            rooms: {
                join: {
                    [ROOM_ID]: {
                        timeline: {
                            events: [ENCRYPTED_EVENT],
                        },
                    },
                },
            },
        };

        return aliceTestClient!
            .start()
            .then(() => {
                return createOlmSession(testOlmAccount, aliceTestClient);
            })
            .then(() => {
                const privkey = decodeRecoveryKey(RECOVERY_KEY);
                return aliceTestClient!.client!.crypto!.storeSessionBackupPrivateKey(privkey);
            })
            .then(() => {
                aliceTestClient!.httpBackend.when("GET", "/sync").respond(200, syncResponse);
                aliceTestClient!.expectKeyBackupQuery(ROOM_ID, SESSION_ID, 200, CURVE25519_KEY_BACKUP_DATA);
                return aliceTestClient!.httpBackend.flushAllExpected();
            })
            .then(function (): Promise<MatrixEvent> {
                const room = aliceTestClient!.client.getRoom(ROOM_ID)!;
                const event = room.getLiveTimeline().getEvents()[0];

                if (event.getContent()) {
                    return Promise.resolve(event);
                }

                return new Promise((resolve, reject) => {
                    event.once(MatrixEventEvent.Decrypted, (ev) => {
                        logger.log(`${Date.now()} event ${event.getId()} now decrypted`);
                        resolve(ev);
                    });
                });
            })
            .then((event) => {
                expect(event.getContent()).toEqual("testytest");
            });
    });
});
