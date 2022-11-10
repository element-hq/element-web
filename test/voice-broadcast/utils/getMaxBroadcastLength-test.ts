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

import { mocked } from "jest-mock";

import SdkConfig, { DEFAULTS } from "../../../src/SdkConfig";
import { getMaxBroadcastLength } from "../../../src/voice-broadcast";

jest.mock("../../../src/SdkConfig");

describe("getMaxBroadcastLength", () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("when there is a value provided by Sdk config", () => {
        beforeEach(() => {
            mocked(SdkConfig.get).mockReturnValue({ max_length: 42 });
        });

        it("should return this value", () => {
            expect(getMaxBroadcastLength()).toBe(42);
        });
    });

    describe("when Sdk config does not provide a value", () => {
        beforeEach(() => {
            DEFAULTS.voice_broadcast = {
                max_length: 23,
            };
        });

        it("should return this value", () => {
            expect(getMaxBroadcastLength()).toBe(23);
        });
    });

    describe("if there are no defaults", () => {
        beforeEach(() => {
            DEFAULTS.voice_broadcast = undefined;
        });

        it("should return the fallback value", () => {
            expect(getMaxBroadcastLength()).toBe(4 * 60 * 60);
        });
    });
});
