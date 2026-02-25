/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import type BasePlatform from "../../../../src/BasePlatform";
import { type IConfigOptions } from "../../../../src/IConfigOptions";
import { getDeviceClientInformation, recordClientInformation } from "../../../../src/utils/device/clientInformation";
import { getMockClientWithEventEmitter } from "../../../test-utils";
import { DEFAULTS } from "../../../../src/SdkConfig";
import { type DeepReadonly } from "../../../../src/@types/common";

describe("recordClientInformation()", () => {
    const deviceId = "my-device-id";
    const version = "1.2.3";
    const isElectron = window.electron;

    const mockClient = getMockClientWithEventEmitter({
        getDeviceId: jest.fn().mockReturnValue(deviceId),
        setAccountData: jest.fn(),
    });

    const sdkConfig: DeepReadonly<IConfigOptions> = {
        ...DEFAULTS,
        brand: "Test Brand",
        element_call: { use_exclusively: false, brand: "Element Call" },
    };

    const platform = {
        getAppVersion: jest.fn().mockResolvedValue(version),
    } as unknown as BasePlatform;

    beforeEach(() => {
        jest.clearAllMocks();
        window.electron = undefined;
    });

    afterAll(() => {
        // restore global
        window.electron = isElectron;
    });

    it("saves client information without url for electron clients", async () => {
        window.electron = {} as Electron;

        await recordClientInformation(mockClient, sdkConfig, platform);

        expect(mockClient.setAccountData).toHaveBeenCalledWith(`io.element.matrix_client_information.${deviceId}`, {
            name: sdkConfig.brand,
            version,
            url: undefined,
        });
    });

    it("saves client information with url for non-electron clients", async () => {
        await recordClientInformation(mockClient, sdkConfig, platform);

        expect(mockClient.setAccountData).toHaveBeenCalledWith(`io.element.matrix_client_information.${deviceId}`, {
            name: sdkConfig.brand,
            version,
            url: "localhost",
        });
    });
});

describe("getDeviceClientInformation()", () => {
    const deviceId = "my-device-id";

    const mockClient = getMockClientWithEventEmitter({
        getAccountData: jest.fn(),
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("returns an empty object when no event exists for the device", () => {
        expect(getDeviceClientInformation(mockClient, deviceId)).toEqual({});

        expect(mockClient.getAccountData).toHaveBeenCalledWith(`io.element.matrix_client_information.${deviceId}`);
    });

    it("returns client information for the device", () => {
        const eventContent = {
            name: "Element Web",
            version: "1.2.3",
            url: "test.com",
        };
        const event = new MatrixEvent({
            type: `io.element.matrix_client_information.${deviceId}`,
            content: eventContent,
        });
        mockClient.getAccountData.mockReturnValue(event);
        expect(getDeviceClientInformation(mockClient, deviceId)).toEqual(eventContent);
    });

    it("excludes values with incorrect types", () => {
        const eventContent = {
            extraField: "hello",
            name: "Element Web",
            // wrong format
            version: { value: "1.2.3" },
            url: "test.com",
        };
        const event = new MatrixEvent({
            type: `io.element.matrix_client_information.${deviceId}`,
            content: eventContent,
        });
        mockClient.getAccountData.mockReturnValue(event);
        // invalid fields excluded
        expect(getDeviceClientInformation(mockClient, deviceId)).toEqual({
            name: eventContent.name,
            url: eventContent.url,
        });
    });
});
