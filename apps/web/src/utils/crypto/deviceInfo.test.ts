/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, type Mocked } from "vitest";
import { type Device, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { getMockClientWithEventEmitter, mockClientMethodsCrypto } from "test-utils";

import { getDeviceCryptoInfo, getUserDeviceIds } from "./deviceInfo";

describe("getDeviceCryptoInfo()", () => {
    let mockClient: Mocked<MatrixClient>;

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({ ...mockClientMethodsCrypto() });
    });

    it("should return undefined on clients with no crypto", async () => {
        vi.spyOn(mockClient, "getCrypto").mockReturnValue(undefined);
        await expect(getDeviceCryptoInfo(mockClient, "@user:id", "device_id")).resolves.toBeUndefined();
    });

    it("should return undefined for unknown users", async () => {
        vi.mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(new Map());
        await expect(getDeviceCryptoInfo(mockClient, "@user:id", "device_id")).resolves.toBeUndefined();
    });

    it("should return undefined for unknown devices", async () => {
        vi.mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(new Map([["@user:id", new Map()]]));
        await expect(getDeviceCryptoInfo(mockClient, "@user:id", "device_id")).resolves.toBeUndefined();
    });

    it("should return the right result for known devices", async () => {
        const mockDevice = { deviceId: "device_id" } as Device;
        vi.mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(
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
        vi.spyOn(mockClient, "getCrypto").mockReturnValue(undefined);
        await expect(getUserDeviceIds(mockClient, "@user:id")).resolves.toEqual(new Set());
    });

    it("should return empty set for unknown users", async () => {
        vi.mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(new Map());
        await expect(getUserDeviceIds(mockClient, "@user:id")).resolves.toEqual(new Set());
    });

    it("should return the right result for known users", async () => {
        const mockDevice = { deviceId: "device_id" } as Device;
        vi.mocked(mockClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(
            new Map([["@user:id", new Map([["device_id", mockDevice]])]]),
        );
        await expect(getUserDeviceIds(mockClient, "@user:id")).resolves.toEqual(new Set(["device_id"]));
        expect(mockClient.getCrypto()!.getUserDeviceInfo).toHaveBeenCalledWith(["@user:id"]);
    });
});
