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

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import BasePlatform from "../../../src/BasePlatform";
import { IConfigOptions } from "../../../src/IConfigOptions";
import { getDeviceClientInformation, recordClientInformation } from "../../../src/utils/device/clientInformation";
import { getMockClientWithEventEmitter } from "../../test-utils";
import { DEFAULTS } from "../../../src/SdkConfig";
import { DeepReadonly } from "../../../src/@types/common";

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
        element_call: { url: "", use_exclusively: false, brand: "Element Call" },
    };

    const platform = {
        getAppVersion: jest.fn().mockResolvedValue(version),
    } as unknown as BasePlatform;

    beforeEach(() => {
        jest.clearAllMocks();
        window.electron = false;
    });

    afterAll(() => {
        // restore global
        window.electron = isElectron;
    });

    it("saves client information without url for electron clients", async () => {
        window.electron = true;

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
