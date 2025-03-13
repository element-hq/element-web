/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixError, type UIAFlow } from "matrix-js-sdk/src/matrix";

import { deleteDevicesWithInteractiveAuth } from "../../../../../../src/components/views/settings/devices/deleteDevices";
import Modal from "../../../../../../src/Modal";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../../test-utils";

describe("deleteDevices()", () => {
    const userId = "@alice:server.org";
    const deviceIds = ["device_1", "device_2"];
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        deleteMultipleDevices: jest.fn(),
    });

    const modalSpy = jest.spyOn(Modal, "createDialog") as jest.SpyInstance;

    const interactiveAuthError = new MatrixError({ flows: [] as UIAFlow[] }, 401);

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
