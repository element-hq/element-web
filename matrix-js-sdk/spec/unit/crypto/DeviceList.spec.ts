/*
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
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

import { logger } from "../../../src/logger";
import * as utils from "../../../src/utils";
import { MemoryCryptoStore } from "../../../src/crypto/store/memory-crypto-store";
import { DeviceList } from "../../../src/crypto/DeviceList";
import { IDownloadKeyResult, MatrixClient } from "../../../src";
import { OlmDevice } from "../../../src/crypto/OlmDevice";
import { CryptoStore } from "../../../src/crypto/store/base";

const signedDeviceList: IDownloadKeyResult = {
    failures: {},
    device_keys: {
        "@test1:sw1v.org": {
            HGKAWHRVJQ: {
                signatures: {
                    "@test1:sw1v.org": {
                        "ed25519:HGKAWHRVJQ":
                            "8PB450fxKDn5s8IiRZ2N2t6MiueQYVRLHFEzqIi1eLdxx1w" +
                            "XEPC1/1Uz9T4gwnKlMVAKkhB5hXQA/3kjaeLABw",
                    },
                },
                user_id: "@test1:sw1v.org",
                keys: {
                    "ed25519:HGKAWHRVJQ": "0gI/T6C+mn1pjtvnnW2yB2l1IIBb/5ULlBXi/LXFSEQ",
                    "curve25519:HGKAWHRVJQ": "mbIZED1dBsgIgkgzxDpxKkJmsr4hiWlGzQTvUnQe3RY",
                },
                algorithms: ["m.olm.v1.curve25519-aes-sha2", "m.megolm.v1.aes-sha2"],
                device_id: "HGKAWHRVJQ",
                unsigned: {
                    device_display_name: "",
                },
            },
        },
    },
};

const signedDeviceList2: IDownloadKeyResult = {
    failures: {},
    device_keys: {
        "@test2:sw1v.org": {
            QJVRHWAKGH: {
                signatures: {
                    "@test2:sw1v.org": {
                        "ed25519:QJVRHWAKGH":
                            "w1xxdLe1iIqzEFHLRVYQeuiM6t2N2ZRiI8s5nDKxf054BP8" +
                            "1CPEX/AQXh5BhkKAVMlKnwg4T9zU1/wBALeajk3",
                    },
                },
                user_id: "@test2:sw1v.org",
                keys: {
                    "ed25519:QJVRHWAKGH": "Ig0/C6T+bBII1l2By2Wnnvtjp1nm/iXBlLU5/QESFXL",
                    "curve25519:QJVRHWAKGH": "YR3eQnUvTQzGlWih4rsmJkKxpDxzgkgIgsBd1DEZIbm",
                },
                algorithms: ["m.olm.v1.curve25519-aes-sha2", "m.megolm.v1.aes-sha2"],
                device_id: "QJVRHWAKGH",
                unsigned: {
                    device_display_name: "",
                },
            },
        },
    },
};

describe("DeviceList", function () {
    let downloadSpy: jest.Mock;
    let cryptoStore: CryptoStore;
    let deviceLists: DeviceList[] = [];

    beforeEach(function () {
        deviceLists = [];

        downloadSpy = jest.fn();
        cryptoStore = new MemoryCryptoStore();
    });

    afterEach(function () {
        for (const dl of deviceLists) {
            dl.stop();
        }
    });

    function createTestDeviceList(keyDownloadChunkSize = 250) {
        const baseApis = {
            downloadKeysForUsers: downloadSpy,
            getUserId: () => "@test1:sw1v.org",
            deviceId: "HGKAWHRVJQ",
        } as unknown as MatrixClient;
        const mockOlm = {
            verifySignature: function (key: string, message: string, signature: string) {},
        } as unknown as OlmDevice;
        const dl = new DeviceList(baseApis, cryptoStore, mockOlm, keyDownloadChunkSize);
        deviceLists.push(dl);
        return dl;
    }

    it("should successfully download and store device keys", function () {
        const dl = createTestDeviceList();

        dl.startTrackingDeviceList("@test1:sw1v.org");

        const queryDefer1 = utils.defer<IDownloadKeyResult>();
        downloadSpy.mockReturnValue(queryDefer1.promise);

        const prom1 = dl.refreshOutdatedDeviceLists();
        expect(downloadSpy).toHaveBeenCalledWith(["@test1:sw1v.org"], {});
        queryDefer1.resolve(utils.deepCopy(signedDeviceList));

        return prom1.then(() => {
            const storedKeys = dl.getRawStoredDevicesForUser("@test1:sw1v.org");
            expect(Object.keys(storedKeys)).toEqual(["HGKAWHRVJQ"]);
            dl.stop();
        });
    });

    it("should have an outdated devicelist on an invalidation while an " + "update is in progress", function () {
        const dl = createTestDeviceList();

        dl.startTrackingDeviceList("@test1:sw1v.org");

        const queryDefer1 = utils.defer<IDownloadKeyResult>();
        downloadSpy.mockReturnValue(queryDefer1.promise);

        const prom1 = dl.refreshOutdatedDeviceLists();
        expect(downloadSpy).toHaveBeenCalledWith(["@test1:sw1v.org"], {});
        downloadSpy.mockReset();

        // outdated notif arrives while the request is in flight.
        const queryDefer2 = utils.defer();
        downloadSpy.mockReturnValue(queryDefer2.promise);

        dl.invalidateUserDeviceList("@test1:sw1v.org");
        dl.refreshOutdatedDeviceLists();

        // TODO: Fix this test so we actually await the call and assertions and remove
        // the eslint disable, https://github.com/matrix-org/matrix-js-sdk/issues/2977
        //
        // eslint-disable-next-line jest/valid-expect-in-promise
        dl.saveIfDirty()
            .then(() => {
                // the first request completes
                queryDefer1.resolve({
                    failures: {},
                    device_keys: {
                        "@test1:sw1v.org": {},
                    },
                });
                return prom1;
            })
            .then(() => {
                // uh-oh; user restarts before second request completes. The new instance
                // should know we never got a complete device list.
                logger.log("Creating new devicelist to simulate app reload");
                downloadSpy.mockReset();
                const dl2 = createTestDeviceList();
                const queryDefer3 = utils.defer<IDownloadKeyResult>();
                downloadSpy.mockReturnValue(queryDefer3.promise);

                const prom3 = dl2.refreshOutdatedDeviceLists();
                expect(downloadSpy).toHaveBeenCalledWith(["@test1:sw1v.org"], {});
                dl2.stop();

                queryDefer3.resolve(utils.deepCopy(signedDeviceList));

                // allow promise chain to complete
                return prom3;
            })
            .then(() => {
                const storedKeys = dl.getRawStoredDevicesForUser("@test1:sw1v.org");
                expect(Object.keys(storedKeys)).toEqual(["HGKAWHRVJQ"]);
                dl.stop();
            });
    });

    it("should download device keys in batches", function () {
        const dl = createTestDeviceList(1);

        dl.startTrackingDeviceList("@test1:sw1v.org");
        dl.startTrackingDeviceList("@test2:sw1v.org");

        const queryDefer1 = utils.defer<IDownloadKeyResult>();
        downloadSpy.mockReturnValueOnce(queryDefer1.promise);
        const queryDefer2 = utils.defer<IDownloadKeyResult>();
        downloadSpy.mockReturnValueOnce(queryDefer2.promise);

        const prom1 = dl.refreshOutdatedDeviceLists();
        expect(downloadSpy).toHaveBeenCalledTimes(2);
        expect(downloadSpy).toHaveBeenNthCalledWith(1, ["@test1:sw1v.org"], {});
        expect(downloadSpy).toHaveBeenNthCalledWith(2, ["@test2:sw1v.org"], {});
        queryDefer1.resolve(utils.deepCopy(signedDeviceList));
        queryDefer2.resolve(utils.deepCopy(signedDeviceList2));

        return prom1.then(() => {
            const storedKeys1 = dl.getRawStoredDevicesForUser("@test1:sw1v.org");
            expect(Object.keys(storedKeys1)).toEqual(["HGKAWHRVJQ"]);
            const storedKeys2 = dl.getRawStoredDevicesForUser("@test2:sw1v.org");
            expect(Object.keys(storedKeys2)).toEqual(["QJVRHWAKGH"]);
            dl.stop();
        });
    });
});
