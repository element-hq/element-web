/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import SdkConfig, { DEFAULTS } from "../../../src/SdkConfig";
import { getMaxBroadcastLength } from "../../../src/voice-broadcast";

describe("getMaxBroadcastLength", () => {
    afterEach(() => {
        SdkConfig.reset();
    });

    describe("when there is a value provided by Sdk config", () => {
        beforeEach(() => {
            SdkConfig.put({
                voice_broadcast: {
                    max_length: 42,
                },
            });
        });

        it("should return this value", () => {
            expect(getMaxBroadcastLength()).toBe(42);
        });
    });

    describe("when Sdk config does not provide a value", () => {
        it("should return this value", () => {
            expect(getMaxBroadcastLength()).toBe(DEFAULTS.voice_broadcast!.max_length);
        });
    });

    describe("if there are no defaults", () => {
        it("should return the fallback value", () => {
            expect(DEFAULTS.voice_broadcast!.max_length).toBe(4 * 60 * 60);
            expect(getMaxBroadcastLength()).toBe(4 * 60 * 60);
        });
    });
});
