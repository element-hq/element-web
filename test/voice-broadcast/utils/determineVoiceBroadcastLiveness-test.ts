/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { VoiceBroadcastInfoState, VoiceBroadcastLiveness } from "../../../src/voice-broadcast";
import { determineVoiceBroadcastLiveness } from "../../../src/voice-broadcast/utils/determineVoiceBroadcastLiveness";

const testData: Array<{ state: VoiceBroadcastInfoState; expected: VoiceBroadcastLiveness }> = [
    { state: VoiceBroadcastInfoState.Started, expected: "live" },
    { state: VoiceBroadcastInfoState.Resumed, expected: "live" },
    { state: VoiceBroadcastInfoState.Paused, expected: "grey" },
    { state: VoiceBroadcastInfoState.Stopped, expected: "not-live" },
];

describe("determineVoiceBroadcastLiveness", () => {
    it.each(testData)("should return the expected value for a %s broadcast", ({ state, expected }) => {
        expect(determineVoiceBroadcastLiveness(state)).toBe(expected);
    });

    it("should return »non-live« for an undefined state", () => {
        // @ts-ignore
        expect(determineVoiceBroadcastLiveness(undefined)).toBe("not-live");
    });

    it("should return »non-live« for an unknown state", () => {
        // @ts-ignore
        expect(determineVoiceBroadcastLiveness("unknown test state")).toBe("not-live");
    });
});
