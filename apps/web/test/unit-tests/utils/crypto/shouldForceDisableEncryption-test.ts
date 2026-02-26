/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { shouldForceDisableEncryption } from "../../../../src/utils/crypto/shouldForceDisableEncryption";
import { getMockClientWithEventEmitter } from "../../../test-utils";

describe("shouldForceDisableEncryption()", () => {
    const mockClient = getMockClientWithEventEmitter({
        getClientWellKnown: jest.fn(),
    });

    beforeEach(() => {
        mockClient.getClientWellKnown.mockReturnValue(undefined);
    });

    it("should return false when there is no e2ee well known", () => {
        expect(shouldForceDisableEncryption(mockClient)).toEqual(false);
    });

    it("should return false when there is no force_disable property", () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                // empty
            },
        });
        expect(shouldForceDisableEncryption(mockClient)).toEqual(false);
    });

    it("should return false when force_disable property is falsy", () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                force_disable: false,
            },
        });
        expect(shouldForceDisableEncryption(mockClient)).toEqual(false);
    });

    it("should return false when force_disable property is not equal to true", () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                force_disable: 1,
            },
        });
        expect(shouldForceDisableEncryption(mockClient)).toEqual(false);
    });

    it("should return true when force_disable property is true", () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                force_disable: true,
            },
        });
        expect(shouldForceDisableEncryption(mockClient)).toEqual(true);
    });
});
