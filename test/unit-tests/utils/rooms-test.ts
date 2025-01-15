/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { privateShouldBeEncrypted } from "../../../src/utils/rooms";
import { getMockClientWithEventEmitter } from "../../test-utils";

describe("privateShouldBeEncrypted()", () => {
    const mockClient = getMockClientWithEventEmitter({
        getClientWellKnown: jest.fn(),
    });

    beforeEach(() => {
        mockClient.getClientWellKnown.mockReturnValue(undefined);
    });

    it("should return true when there is no e2ee well known", () => {
        expect(privateShouldBeEncrypted(mockClient)).toEqual(true);
    });

    it("should return true when default is not set to false", () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                default: true,
            },
        });
        expect(privateShouldBeEncrypted(mockClient)).toEqual(true);
    });

    it("should return true when there is no default property", () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                // no default
            },
        });
        expect(privateShouldBeEncrypted(mockClient)).toEqual(true);
    });

    it("should return false when encryption is force disabled", () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                force_disable: true,
                default: true,
            },
        });
        expect(privateShouldBeEncrypted(mockClient)).toEqual(false);
    });

    it("should return false when default encryption setting is false", () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                force_disable: false,
                default: false,
            },
        });
        expect(privateShouldBeEncrypted(mockClient)).toEqual(false);
    });

    it("should return true when default encryption setting is set to something other than false", () => {
        mockClient.getClientWellKnown.mockReturnValue({
            "io.element.e2ee": {
                default: "test",
            },
        });
        expect(privateShouldBeEncrypted(mockClient)).toEqual(true);
    });
});
