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

import "../../olm-loader";
import { TestClient } from "../../TestClient";
import { logger } from "../../../src/logger";
import { DEHYDRATION_ALGORITHM } from "../../../src/crypto/dehydration";

const Olm = global.Olm;

describe("Dehydration", () => {
    if (!global.Olm) {
        logger.warn("Not running dehydration unit tests: libolm not present");
        return;
    }

    beforeAll(function () {
        return global.Olm.init();
    });

    it("should rehydrate a dehydrated device", async () => {
        const key = new Uint8Array([1, 2, 3]);
        const alice = new TestClient("@alice:example.com", "Osborne2", undefined, undefined, {
            cryptoCallbacks: {
                getDehydrationKey: async (t) => key,
            },
        });

        const dehydratedDevice = new Olm.Account();
        dehydratedDevice.create();

        alice.httpBackend.when("GET", "/dehydrated_device").respond(200, {
            device_id: "ABCDEFG",
            device_data: {
                algorithm: DEHYDRATION_ALGORITHM,
                account: dehydratedDevice.pickle(new Uint8Array(key)),
            },
        });
        alice.httpBackend.when("POST", "/dehydrated_device/claim").respond(200, {
            success: true,
        });

        expect((await Promise.all([alice.client.rehydrateDevice(), alice.httpBackend.flushAllExpected()]))[0]).toEqual(
            "ABCDEFG",
        );

        expect(alice.client.getDeviceId()).toEqual("ABCDEFG");
    });

    it("should dehydrate a device", async () => {
        const key = new Uint8Array([1, 2, 3]);
        const alice = new TestClient("@alice:example.com", "Osborne2", undefined, undefined, {
            cryptoCallbacks: {
                getDehydrationKey: async (t) => key,
            },
        });

        await alice.client.initCrypto();

        alice.httpBackend.when("GET", "/room_keys/version").respond(404, {
            errcode: "M_NOT_FOUND",
        });

        let pickledAccount = "";

        alice.httpBackend
            .when("PUT", "/dehydrated_device")
            .check((req) => {
                expect(req.data.device_data).toMatchObject({
                    algorithm: DEHYDRATION_ALGORITHM,
                    account: expect.any(String),
                });
                pickledAccount = req.data.device_data.account;
            })
            .respond(200, {
                device_id: "ABCDEFG",
            });
        alice.httpBackend
            .when("POST", "/keys/upload/ABCDEFG")
            .check((req) => {
                expect(req.data).toMatchObject({
                    "device_keys": expect.objectContaining({
                        algorithms: expect.any(Array),
                        device_id: "ABCDEFG",
                        user_id: "@alice:example.com",
                        keys: expect.objectContaining({
                            "ed25519:ABCDEFG": expect.any(String),
                            "curve25519:ABCDEFG": expect.any(String),
                        }),
                        signatures: expect.objectContaining({
                            "@alice:example.com": expect.objectContaining({
                                "ed25519:ABCDEFG": expect.any(String),
                            }),
                        }),
                    }),
                    "one_time_keys": expect.any(Object),
                    "org.matrix.msc2732.fallback_keys": expect.any(Object),
                });
            })
            .respond(200, {});

        try {
            const deviceId = (
                await Promise.all([
                    alice.client.createDehydratedDevice(new Uint8Array(key), {}),
                    alice.httpBackend.flushAllExpected(),
                ])
            )[0];

            expect(deviceId).toEqual("ABCDEFG");
            expect(deviceId).not.toEqual("");

            // try to rehydrate the dehydrated device
            const rehydrated = new Olm.Account();
            try {
                rehydrated.unpickle(new Uint8Array(key), pickledAccount);
            } finally {
                rehydrated.free();
            }
        } finally {
            alice.client?.crypto?.dehydrationManager?.stop();
            alice.client?.crypto?.deviceList.stop();
        }
    });
});
