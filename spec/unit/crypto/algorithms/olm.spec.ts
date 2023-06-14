/*
Copyright 2018,2019 New Vector Ltd
Copyright 2019, 2022 The Matrix.org Foundation C.I.C.

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

import { MockedObject } from "jest-mock";

import "../../../olm-loader";
import { MemoryCryptoStore } from "../../../../src/crypto/store/memory-crypto-store";
import { logger } from "../../../../src/logger";
import { OlmDevice } from "../../../../src/crypto/OlmDevice";
import * as olmlib from "../../../../src/crypto/olmlib";
import { DeviceInfo } from "../../../../src/crypto/deviceinfo";
import { MatrixClient } from "../../../../src";

function makeOlmDevice() {
    const cryptoStore = new MemoryCryptoStore();
    const olmDevice = new OlmDevice(cryptoStore);
    return olmDevice;
}

async function setupSession(initiator: OlmDevice, opponent: OlmDevice) {
    await opponent.generateOneTimeKeys(1);
    const keys = await opponent.getOneTimeKeys();
    const firstKey = Object.values(keys["curve25519"])[0];

    const sid = await initiator.createOutboundSession(opponent.deviceCurve25519Key!, firstKey);
    return sid;
}

function alwaysSucceed<T>(promise: Promise<T>): Promise<T | void> {
    // swallow any exception thrown by a promise, so that
    // Promise.all doesn't abort
    return promise.catch(() => {});
}

describe("OlmDevice", function () {
    if (!global.Olm) {
        logger.warn("Not running megolm unit tests: libolm not present");
        return;
    }

    beforeAll(function () {
        return global.Olm.init();
    });

    let aliceOlmDevice: OlmDevice;
    let bobOlmDevice: OlmDevice;

    beforeEach(async function () {
        aliceOlmDevice = makeOlmDevice();
        bobOlmDevice = makeOlmDevice();
        await aliceOlmDevice.init();
        await bobOlmDevice.init();
    });

    describe("olm", function () {
        it("can decrypt messages", async function () {
            const sid = await setupSession(aliceOlmDevice, bobOlmDevice);

            const ciphertext = (await aliceOlmDevice.encryptMessage(
                bobOlmDevice.deviceCurve25519Key!,
                sid,
                "The olm or proteus is an aquatic salamander in the family Proteidae",
            )) as any; // OlmDevice.encryptMessage has incorrect return type

            const result = await bobOlmDevice.createInboundSession(
                aliceOlmDevice.deviceCurve25519Key!,
                ciphertext.type,
                ciphertext.body,
            );
            expect(result.payload).toEqual("The olm or proteus is an aquatic salamander in the family Proteidae");
        });

        it("exports picked account and olm sessions", async function () {
            const sessionId = await setupSession(aliceOlmDevice, bobOlmDevice);

            const exported = await bobOlmDevice.export();
            // At this moment only Alice (the “initiator” in setupSession) has a session
            expect(exported.sessions).toEqual([]);

            const MESSAGE = "The olm or proteus is an aquatic salamander" + " in the family Proteidae";
            const ciphertext = (await aliceOlmDevice.encryptMessage(
                bobOlmDevice.deviceCurve25519Key!,
                sessionId,
                MESSAGE,
            )) as any; // OlmDevice.encryptMessage has incorrect return type

            const bobRecreatedOlmDevice = makeOlmDevice();
            bobRecreatedOlmDevice.init({ fromExportedDevice: exported });

            const decrypted = await bobRecreatedOlmDevice.createInboundSession(
                aliceOlmDevice.deviceCurve25519Key!,
                ciphertext.type,
                ciphertext.body,
            );
            expect(decrypted.payload).toEqual(MESSAGE);

            const exportedAgain = await bobRecreatedOlmDevice.export();
            // this time we expect Bob to have a session to export
            expect(exportedAgain.sessions).toHaveLength(1);

            const MESSAGE_2 = "In contrast to most amphibians," + " the olm is entirely aquatic";
            const ciphertext2 = (await aliceOlmDevice.encryptMessage(
                bobOlmDevice.deviceCurve25519Key!,
                sessionId,
                MESSAGE_2,
            )) as any; // OlmDevice.encryptMessage has incorrect return type

            const bobRecreatedAgainOlmDevice = makeOlmDevice();
            bobRecreatedAgainOlmDevice.init({ fromExportedDevice: exportedAgain });

            // Note: "decrypted_2" does not have the same structure as "decrypted"
            const decrypted2 = await bobRecreatedAgainOlmDevice.decryptMessage(
                aliceOlmDevice.deviceCurve25519Key!,
                decrypted.session_id,
                ciphertext2.type,
                ciphertext2.body,
            );
            expect(decrypted2).toEqual(MESSAGE_2);
        });

        it("creates only one session at a time", async function () {
            // if we call ensureOlmSessionsForDevices multiple times, it should
            // only try to create one session at a time, even if the server is
            // slow
            let count = 0;
            const baseApis = {
                claimOneTimeKeys: () => {
                    // simulate a very slow server (.5 seconds to respond)
                    count++;
                    return new Promise((resolve, reject) => {
                        setTimeout(reject, 500);
                    });
                },
            } as unknown as MockedObject<MatrixClient>;
            const devicesByUser = new Map([
                [
                    "@bob:example.com",
                    [
                        DeviceInfo.fromStorage(
                            {
                                keys: {
                                    "curve25519:ABCDEFG": "akey",
                                },
                            },
                            "ABCDEFG",
                        ),
                    ],
                ],
            ]);

            // start two tasks that try to ensure that there's an olm session
            const promises = Promise.all([
                alwaysSucceed(olmlib.ensureOlmSessionsForDevices(aliceOlmDevice, baseApis, devicesByUser)),
                alwaysSucceed(olmlib.ensureOlmSessionsForDevices(aliceOlmDevice, baseApis, devicesByUser)),
            ]);

            await new Promise((resolve) => {
                setTimeout(resolve, 200);
            });

            // after .2s, both tasks should have started, but one should be
            // waiting on the other before trying to create a session, so
            // claimOneTimeKeys should have only been called once
            expect(count).toBe(1);

            await promises;

            // after waiting for both tasks to complete, the first task should
            // have failed, so the second task should have tried to create a
            // new session and will have called claimOneTimeKeys
            expect(count).toBe(2);
        });

        it("avoids deadlocks when two tasks are ensuring the same devices", async function () {
            // This test checks whether `ensureOlmSessionsForDevices` properly
            // handles multiple tasks in flight ensuring some set of devices in
            // common without deadlocks.

            let claimRequestCount = 0;
            const baseApis = {
                claimOneTimeKeys: () => {
                    // simulate a very slow server (.5 seconds to respond)
                    claimRequestCount++;
                    return new Promise((resolve, reject) => {
                        setTimeout(reject, 500);
                    });
                },
            } as unknown as MockedObject<MatrixClient>;

            const deviceBobA = DeviceInfo.fromStorage(
                {
                    keys: {
                        "curve25519:BOB-A": "akey",
                    },
                },
                "BOB-A",
            );
            const deviceBobB = DeviceInfo.fromStorage(
                {
                    keys: {
                        "curve25519:BOB-B": "bkey",
                    },
                },
                "BOB-B",
            );

            // There's no required ordering of devices per user, so here we
            // create two different orderings so that each task reserves a
            // device the other task needs before continuing.
            const devicesByUserAB = new Map([["@bob:example.com", [deviceBobA, deviceBobB]]]);
            const devicesByUserBA = new Map([["@bob:example.com", [deviceBobB, deviceBobA]]]);

            const task1 = alwaysSucceed(olmlib.ensureOlmSessionsForDevices(aliceOlmDevice, baseApis, devicesByUserAB));

            // After a single tick through the first task, it should have
            // claimed ownership of all devices to avoid deadlocking others.
            expect(Object.keys(aliceOlmDevice.sessionsInProgress).length).toBe(2);

            const task2 = alwaysSucceed(olmlib.ensureOlmSessionsForDevices(aliceOlmDevice, baseApis, devicesByUserBA));

            // The second task should not have changed the ownership count, as
            // it's waiting on the first task.
            expect(Object.keys(aliceOlmDevice.sessionsInProgress).length).toBe(2);

            // Track the tasks, but don't await them yet.
            const promises = Promise.all([task1, task2]);

            await new Promise((resolve) => {
                setTimeout(resolve, 200);
            });

            // After .2s, the first task should have made an initial claim request.
            expect(claimRequestCount).toBe(1);

            await promises;

            // After waiting for both tasks to complete, the first task should
            // have failed, so the second task should have tried to create a
            // new session and will have called claimOneTimeKeys
            expect(claimRequestCount).toBe(2);
        });
    });
});
