/*
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

import { TestClient } from "../TestClient";
import * as testUtils from "../test-utils/test-utils";
import { logger } from "../../src/logger";

const ROOM_ID = "!room:id";

/**
 * get a /sync response which contains a single e2e room (ROOM_ID), with the
 * members given
 *
 * @returns sync response
 */
function getSyncResponse(roomMembers: string[]) {
    const stateEvents = [
        testUtils.mkEvent({
            type: "m.room.encryption",
            skey: "",
            content: {
                algorithm: "m.megolm.v1.aes-sha2",
            },
        }),
    ];

    Array.prototype.push.apply(
        stateEvents,
        roomMembers.map((m) =>
            testUtils.mkMembership({
                mship: "join",
                sender: m,
            }),
        ),
    );

    const syncResponse = {
        next_batch: 1,
        rooms: {
            join: {
                [ROOM_ID]: {
                    state: {
                        events: stateEvents,
                    },
                },
            },
        },
    };

    return syncResponse;
}

describe("DeviceList management:", function () {
    if (!global.Olm) {
        logger.warn("not running deviceList tests: Olm not present");
        return;
    }

    let aliceTestClient: TestClient;
    let sessionStoreBackend: Storage;

    async function createTestClient() {
        const testClient = new TestClient("@alice:localhost", "xzcvb", "akjgkrgjs", sessionStoreBackend);
        await testClient.client.initCrypto();
        return testClient;
    }

    beforeEach(async function () {
        // we create our own sessionStoreBackend so that we can use it for
        // another TestClient.
        sessionStoreBackend = new testUtils.MockStorageApi();

        aliceTestClient = await createTestClient();
    });

    afterEach(function () {
        return aliceTestClient.stop();
    });

    it("Alice shouldn't do a second /query for non-e2e-capable devices", function () {
        aliceTestClient.expectKeyQuery({
            device_keys: { "@alice:localhost": {} },
            failures: {},
        });
        return aliceTestClient
            .start()
            .then(function () {
                const syncResponse = getSyncResponse(["@bob:xyz"]);
                aliceTestClient.httpBackend.when("GET", "/sync").respond(200, syncResponse);

                return aliceTestClient.flushSync();
            })
            .then(function () {
                logger.log("Forcing alice to download our device keys");

                aliceTestClient.httpBackend.when("POST", "/keys/query").respond(200, {
                    device_keys: {
                        "@bob:xyz": {},
                    },
                });

                return Promise.all([
                    aliceTestClient.client.downloadKeys(["@bob:xyz"]),
                    aliceTestClient.httpBackend.flush("/keys/query", 1),
                ]);
            })
            .then(function () {
                logger.log("Telling alice to send a megolm message");

                aliceTestClient.httpBackend.when("PUT", "/send/").respond(200, {
                    event_id: "$event_id",
                });

                return Promise.all([
                    aliceTestClient.client.sendTextMessage(ROOM_ID, "test"),

                    // the crypto stuff can take a while, so give the requests a whole second.
                    aliceTestClient.httpBackend.flushAllExpected({
                        timeout: 1000,
                    }),
                ]);
            });
    });

    it.skip("We should not get confused by out-of-order device query responses", () => {
        // https://github.com/vector-im/element-web/issues/3126
        aliceTestClient.expectKeyQuery({
            device_keys: { "@alice:localhost": {} },
            failures: {},
        });
        return aliceTestClient
            .start()
            .then(() => {
                aliceTestClient.httpBackend
                    .when("GET", "/sync")
                    .respond(200, getSyncResponse(["@bob:xyz", "@chris:abc"]));
                return aliceTestClient.flushSync();
            })
            .then(() => {
                // to make sure the initial device queries are flushed out, we
                // attempt to send a message.

                aliceTestClient.httpBackend.when("POST", "/keys/query").respond(200, {
                    device_keys: {
                        "@bob:xyz": {},
                        "@chris:abc": {},
                    },
                });

                aliceTestClient.httpBackend.when("PUT", "/send/").respond(200, { event_id: "$event1" });

                return Promise.all([
                    aliceTestClient.client.sendTextMessage(ROOM_ID, "test"),
                    aliceTestClient.httpBackend
                        .flush("/keys/query", 1)
                        .then(() => aliceTestClient.httpBackend.flush("/send/", 1)),
                    aliceTestClient.client.crypto!.deviceList.saveIfDirty(),
                ]);
            })
            .then(() => {
                // @ts-ignore accessing a protected field
                aliceTestClient.client.cryptoStore!.getEndToEndDeviceData(null, (data) => {
                    expect(data!.syncToken).toEqual(1);
                });

                // invalidate bob's and chris's device lists in separate syncs
                aliceTestClient.httpBackend.when("GET", "/sync").respond(200, {
                    next_batch: "2",
                    device_lists: {
                        changed: ["@bob:xyz"],
                    },
                });
                aliceTestClient.httpBackend.when("GET", "/sync").respond(200, {
                    next_batch: "3",
                    device_lists: {
                        changed: ["@chris:abc"],
                    },
                });
                // flush both syncs
                return aliceTestClient.flushSync().then(() => {
                    return aliceTestClient.flushSync();
                });
            })
            .then(() => {
                // check that we don't yet have a request for chris's devices.
                aliceTestClient.httpBackend
                    .when("POST", "/keys/query", {
                        device_keys: {
                            "@chris:abc": {},
                        },
                        token: "3",
                    })
                    .respond(200, {
                        device_keys: { "@chris:abc": {} },
                    });
                return aliceTestClient.httpBackend.flush("/keys/query", 1);
            })
            .then((flushed) => {
                expect(flushed).toEqual(0);
                return aliceTestClient.client.crypto!.deviceList.saveIfDirty();
            })
            .then(() => {
                // @ts-ignore accessing a protected field
                aliceTestClient.client.cryptoStore!.getEndToEndDeviceData(null, (data) => {
                    const bobStat = data!.trackingStatus["@bob:xyz"];
                    if (bobStat != 1 && bobStat != 2) {
                        throw new Error("Unexpected status for bob: wanted 1 or 2, got " + bobStat);
                    }
                    const chrisStat = data!.trackingStatus["@chris:abc"];
                    if (chrisStat != 1 && chrisStat != 2) {
                        throw new Error("Unexpected status for chris: wanted 1 or 2, got " + chrisStat);
                    }
                });

                // now add an expectation for a query for bob's devices, and let
                // it complete.
                aliceTestClient.httpBackend
                    .when("POST", "/keys/query", {
                        device_keys: {
                            "@bob:xyz": {},
                        },
                        token: "2",
                    })
                    .respond(200, {
                        device_keys: { "@bob:xyz": {} },
                    });
                return aliceTestClient.httpBackend.flush("/keys/query", 1);
            })
            .then((flushed) => {
                expect(flushed).toEqual(1);

                // wait for the client to stop processing the response
                return aliceTestClient.client.downloadKeys(["@bob:xyz"]);
            })
            .then(() => {
                return aliceTestClient.client.crypto!.deviceList.saveIfDirty();
            })
            .then(() => {
                // @ts-ignore accessing a protected field
                aliceTestClient.client.cryptoStore!.getEndToEndDeviceData(null, (data) => {
                    const bobStat = data!.trackingStatus["@bob:xyz"];
                    expect(bobStat).toEqual(3);
                    const chrisStat = data!.trackingStatus["@chris:abc"];
                    if (chrisStat != 1 && chrisStat != 2) {
                        throw new Error("Unexpected status for chris: wanted 1 or 2, got " + bobStat);
                    }
                });

                // now let the query for chris's devices complete.
                return aliceTestClient.httpBackend.flush("/keys/query", 1);
            })
            .then((flushed) => {
                expect(flushed).toEqual(1);

                // wait for the client to stop processing the response
                return aliceTestClient.client.downloadKeys(["@chris:abc"]);
            })
            .then(() => {
                return aliceTestClient.client.crypto!.deviceList.saveIfDirty();
            })
            .then(() => {
                // @ts-ignore accessing a protected field
                aliceTestClient.client.cryptoStore!.getEndToEndDeviceData(null, (data) => {
                    const bobStat = data!.trackingStatus["@bob:xyz"];
                    const chrisStat = data!.trackingStatus["@bob:xyz"];

                    expect(bobStat).toEqual(3);
                    expect(chrisStat).toEqual(3);
                    expect(data!.syncToken).toEqual(3);
                });
            });
    });

    // https://github.com/vector-im/element-web/issues/4983
    describe("Alice should know she has stale device lists", () => {
        beforeEach(async function () {
            await aliceTestClient.start();

            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, getSyncResponse(["@bob:xyz"]));
            await aliceTestClient.flushSync();

            aliceTestClient.httpBackend.when("POST", "/keys/query").respond(200, {
                device_keys: {
                    "@bob:xyz": {},
                },
            });
            await aliceTestClient.httpBackend.flush("/keys/query", 1);
            await aliceTestClient.client.crypto!.deviceList.saveIfDirty();

            // @ts-ignore accessing a protected field
            aliceTestClient.client.cryptoStore!.getEndToEndDeviceData(null, (data) => {
                const bobStat = data!.trackingStatus["@bob:xyz"];

                // Alice should be tracking bob's device list
                expect(bobStat).toBeGreaterThan(0);
            });
        });

        it("when Bob leaves", async function () {
            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, {
                next_batch: 2,
                device_lists: {
                    left: ["@bob:xyz"],
                },
                rooms: {
                    join: {
                        [ROOM_ID]: {
                            timeline: {
                                events: [
                                    testUtils.mkMembership({
                                        mship: "leave",
                                        sender: "@bob:xyz",
                                    }),
                                ],
                            },
                        },
                    },
                },
            });

            await aliceTestClient.flushSync();
            await aliceTestClient.client.crypto!.deviceList.saveIfDirty();

            // @ts-ignore accessing a protected field
            aliceTestClient.client.cryptoStore!.getEndToEndDeviceData(null, (data) => {
                const bobStat = data!.trackingStatus["@bob:xyz"];

                // Alice should have marked bob's device list as untracked
                expect(bobStat).toEqual(0);
            });
        });

        it("when Alice leaves", async function () {
            aliceTestClient.httpBackend.when("GET", "/sync").respond(200, {
                next_batch: 2,
                device_lists: {
                    left: ["@bob:xyz"],
                },
                rooms: {
                    leave: {
                        [ROOM_ID]: {
                            timeline: {
                                events: [
                                    testUtils.mkMembership({
                                        mship: "leave",
                                        sender: "@bob:xyz",
                                    }),
                                ],
                            },
                        },
                    },
                },
            });

            await aliceTestClient.flushSync();
            await aliceTestClient.client.crypto!.deviceList.saveIfDirty();

            // @ts-ignore accessing a protected field
            aliceTestClient.client.cryptoStore!.getEndToEndDeviceData(null, (data) => {
                const bobStat = data!.trackingStatus["@bob:xyz"];

                // Alice should have marked bob's device list as untracked
                expect(bobStat).toEqual(0);
            });
        });

        it("when Bob leaves whilst Alice is offline", async function () {
            aliceTestClient.stop();

            const anotherTestClient = await createTestClient();

            try {
                await anotherTestClient.start();
                anotherTestClient.httpBackend.when("GET", "/sync").respond(200, getSyncResponse([]));
                await anotherTestClient.flushSync();
                await anotherTestClient.client?.crypto?.deviceList?.saveIfDirty();

                // @ts-ignore accessing private property
                anotherTestClient.client.cryptoStore.getEndToEndDeviceData(null, (data) => {
                    const bobStat = data!.trackingStatus["@bob:xyz"];

                    // Alice should have marked bob's device list as untracked
                    expect(bobStat).toEqual(0);
                });
            } finally {
                anotherTestClient.stop();
            }
        });
    });
});
