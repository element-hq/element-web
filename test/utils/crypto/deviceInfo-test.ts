/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { Mocked, mocked } from "jest-mock";
import { Device, MatrixClient } from "matrix-js-sdk/src/matrix";

import { getDeviceCryptoInfo, getUserDeviceIds } from "../../../src/utils/crypto/deviceInfo";
import { getMockClientWithEventEmitter, mockClientMethodsCrypto } from "../../test-utils";

describe("getDeviceCryptoInfo()", () => {
    let mockClient: Mocked<MatrixClient>;

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({ ...mockClientMethodsCrypto() });
    });

    it("should return undefined on clients with no crypto", async () => {
        jest.spyOn(mockClient, "getCrypto").mockReturnValue(undefined);
        await expect(getDeviceCryptoInfo(mockClient, "@user:id", "device_id")).resolves.toBeUndefined();
    });

    it("should return undefined for unknown users", async () => {
        mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(new Map());
        await expect(getDeviceCryptoInfo(mockClient, "@user:id", "device_id")).resolves.toBeUndefined();
    });

    it("should return undefined for unknown devices", async () => {
        mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(new Map([["@user:id", new Map()]]));
        await expect(getDeviceCryptoInfo(mockClient, "@user:id", "device_id")).resolves.toBeUndefined();
    });

    it("should return the right result for known devices", async () => {
        const mockDevice = { deviceId: "device_id" } as Device;
        mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(
            new Map([["@user:id", new Map([["device_id", mockDevice]])]]),
        );
        await expect(getDeviceCryptoInfo(mockClient, "@user:id", "device_id")).resolves.toBe(mockDevice);
        expect(mockClient.getCrypto()!.getUserDeviceInfo).toHaveBeenCalledWith(["@user:id"], undefined);
    });
});

describe("getUserDeviceIds", () => {
    let mockClient: Mocked<MatrixClient>;

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({ ...mockClientMethodsCrypto() });
    });

    it("should return empty set on clients with no crypto", async () => {
        jest.spyOn(mockClient, "getCrypto").mockReturnValue(undefined);
        await expect(getUserDeviceIds(mockClient, "@user:id")).resolves.toEqual(new Set());
    });

    it("should return empty set for unknown users", async () => {
        mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(new Map());
        await expect(getUserDeviceIds(mockClient, "@user:id")).resolves.toEqual(new Set());
    });

    it("should return the right result for known users", async () => {
        const mockDevice = { deviceId: "device_id" } as Device;
        mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(
            new Map([["@user:id", new Map([["device_id", mockDevice]])]]),
        );
        await expect(getUserDeviceIds(mockClient, "@user:id")).resolves.toEqual(new Set(["device_id"]));
        expect(mockClient.getCrypto()!.getUserDeviceInfo).toHaveBeenCalledWith(["@user:id"]);
    });
});
