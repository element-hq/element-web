/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { HTTPError, type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { createCrossSigning } from "../src/CreateCrossSigning";
import { createTestClient } from "./test-utils";
import Modal from "../src/Modal";

describe("CreateCrossSigning", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = createTestClient();
    });

    it("should call bootstrapCrossSigning with an authUploadDeviceSigningKeys function", async () => {
        await createCrossSigning(client);

        expect(client.getCrypto()?.bootstrapCrossSigning).toHaveBeenCalledWith({
            authUploadDeviceSigningKeys: expect.any(Function),
        });
    });

    it("should upload", async () => {
        client.uploadDeviceSigningKeys = jest.fn().mockRejectedValueOnce(
            new MatrixError({
                flows: [
                    {
                        stages: ["m.login.password"],
                    },
                ],
            }),
        );

        await createCrossSigning(client);

        const { authUploadDeviceSigningKeys } = mocked(client.getCrypto()!).bootstrapCrossSigning.mock.calls[0][0];

        const makeRequest = jest.fn();
        await authUploadDeviceSigningKeys!(makeRequest);
        expect(makeRequest).toHaveBeenCalledWith({});
    });

    it("should prompt user if upload failed with UIA", async () => {
        const createDialog = jest.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([true]),
            close: jest.fn(),
        });

        client.uploadDeviceSigningKeys = jest.fn().mockRejectedValueOnce(
            new MatrixError({
                flows: [
                    {
                        stages: ["dummy.mystery_flow_nobody_knows"],
                    },
                ],
            }),
        );

        await createCrossSigning(client);

        const { authUploadDeviceSigningKeys } = mocked(client.getCrypto()!).bootstrapCrossSigning.mock.calls[0][0];

        const makeRequest = jest.fn().mockRejectedValue(
            new MatrixError({
                flows: [
                    {
                        stages: ["dummy.mystery_flow_nobody_knows"],
                    },
                ],
            }),
        );
        await authUploadDeviceSigningKeys!(makeRequest);
        expect(makeRequest).not.toHaveBeenCalledWith();
        expect(createDialog).toHaveBeenCalled();
    });

    it("should throw error if server fails with something other than UIA", async () => {
        await createCrossSigning(client);

        const { authUploadDeviceSigningKeys } = mocked(client.getCrypto()!).bootstrapCrossSigning.mock.calls[0][0];

        const error = new HTTPError("Internal Server Error", 500);
        const makeRequest = jest.fn().mockRejectedValue(error);
        await expect(authUploadDeviceSigningKeys!(makeRequest)).rejects.toThrow(error);
        expect(makeRequest).not.toHaveBeenCalledWith();
    });
});
