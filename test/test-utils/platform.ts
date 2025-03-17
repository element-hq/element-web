/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MethodLikeKeys, mocked, type MockedObject } from "jest-mock";

import BasePlatform from "../../src/BasePlatform";
import PlatformPeg from "../../src/PlatformPeg";

// doesn't implement abstract
// @ts-ignore
class MockPlatform extends BasePlatform {
    constructor(platformMocks: Partial<Record<keyof BasePlatform, unknown>>) {
        super();
        Object.assign(this, platformMocks);
    }
}
/**
 * Mock Platform Peg
 * Creates a mock BasePlatform class
 * spies on PlatformPeg.get and returns mock platform
 * @returns MockPlatform instance
 */
export const mockPlatformPeg = (
    platformMocks: Partial<Record<MethodLikeKeys<BasePlatform>, unknown>> = {},
): MockedObject<BasePlatform> => {
    const mockPlatform = new MockPlatform(platformMocks);
    jest.spyOn(PlatformPeg, "get").mockReturnValue(mockPlatform);
    return mocked(mockPlatform);
};

export const unmockPlatformPeg = () => {
    jest.spyOn(PlatformPeg, "get").mockRestore();
};
