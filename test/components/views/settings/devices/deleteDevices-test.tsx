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

import { UIAFlow } from "matrix-js-sdk/src/matrix";

import { deleteDevicesWithInteractiveAuth } from "../../../../../src/components/views/settings/devices/deleteDevices";
import Modal from "../../../../../src/Modal";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../test-utils";

describe("deleteDevices()", () => {
    const userId = "@alice:server.org";
    const deviceIds = ["device_1", "device_2"];
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        deleteMultipleDevices: jest.fn(),
    });

    const modalSpy = jest.spyOn(Modal, "createDialog") as jest.SpyInstance;

    const interactiveAuthError = { httpStatus: 401, data: { flows: [] as UIAFlow[] } };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("deletes devices and calls onFinished when interactive auth is not required", async () => {
        mockClient.deleteMultipleDevices.mockResolvedValue({});
        const onFinished = jest.fn();

        await deleteDevicesWithInteractiveAuth(mockClient, deviceIds, onFinished);

        expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(deviceIds, undefined);
        expect(onFinished).toHaveBeenCalledWith(true, undefined);

        // didnt open modal
        expect(modalSpy).not.toHaveBeenCalled();
    });

    it("throws without opening auth dialog when delete fails with a non-401 status code", async () => {
        const error = new Error("");
        // @ts-ignore
        error.httpStatus = 404;
        mockClient.deleteMultipleDevices.mockRejectedValue(error);
        const onFinished = jest.fn();

        await expect(deleteDevicesWithInteractiveAuth(mockClient, deviceIds, onFinished)).rejects.toThrow(error);

        expect(onFinished).not.toHaveBeenCalled();

        // didnt open modal
        expect(modalSpy).not.toHaveBeenCalled();
    });

    it("throws without opening auth dialog when delete fails without data.flows", async () => {
        const error = new Error("");
        // @ts-ignore
        error.httpStatus = 401;
        // @ts-ignore
        error.data = {};
        mockClient.deleteMultipleDevices.mockRejectedValue(error);
        const onFinished = jest.fn();

        await expect(deleteDevicesWithInteractiveAuth(mockClient, deviceIds, onFinished)).rejects.toThrow(error);

        expect(onFinished).not.toHaveBeenCalled();

        // didnt open modal
        expect(modalSpy).not.toHaveBeenCalled();
    });

    it("opens interactive auth dialog when delete fails with 401", async () => {
        mockClient.deleteMultipleDevices.mockRejectedValue(interactiveAuthError);
        const onFinished = jest.fn();

        await deleteDevicesWithInteractiveAuth(mockClient, deviceIds, onFinished);

        expect(onFinished).not.toHaveBeenCalled();

        // opened modal
        expect(modalSpy).toHaveBeenCalled();

        const { title, authData, aestheticsForStagePhases } = modalSpy.mock.calls[0][1]!;

        // modal opened as expected
        expect(title).toEqual("Authentication");
        expect(authData).toEqual(interactiveAuthError.data);
        expect(aestheticsForStagePhases).toMatchSnapshot();
    });
});
