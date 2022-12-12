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

import { MethodLikeKeys, mocked, MockedObject } from "jest-mock";

import BasePlatform from "../../src/BasePlatform";
import PlatformPeg from "../../src/PlatformPeg";

// doesn't implement abstract
// @ts-ignore
class MockPlatform extends BasePlatform {
    constructor(platformMocks: Partial<Record<MethodLikeKeys<BasePlatform>, unknown>>) {
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
