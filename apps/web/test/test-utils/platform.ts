/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MethodLikeKeys } from "jest-mock";
import { type MockedObject } from "vitest";

import BasePlatform from "../../src/BasePlatform";
import PlatformPeg from "../../src/PlatformPeg";
import * as SessionLock from "../../src/utils/SessionLock";
import { vi } from "../setup/adapter.ts";

// doesn't implement abstract
// @ts-ignore
class MockPlatform extends BasePlatform {
    constructor(platformMocks: Partial<Record<keyof BasePlatform, unknown>>) {
        super();
        Object.assign(this, platformMocks);
    }

    public checkSessionLockFree(): boolean {
        return SessionLock.checkSessionLockFree();
    }

    public async getSessionLock(onNewInstance: () => Promise<void>): Promise<boolean> {
        return SessionLock.getSessionLock(onNewInstance);
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
    vi.spyOn(PlatformPeg, "get").mockReturnValue(mockPlatform);
    return vi.mocked(mockPlatform);
};

export const unmockPlatformPeg = () => {
    vi.spyOn(PlatformPeg, "get").mockRestore();
};
