/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { shouldDisplayAsVoiceBroadcastRecordingTile, VoiceBroadcastInfoState } from "../../../src/voice-broadcast";
import { createTestClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

type TestTuple = [string | null, string, string, string, VoiceBroadcastInfoState, boolean];

const testCases: TestTuple[] = [
    [
        "@user1:example.com", // own MXID
        "@user1:example.com", // sender MXID
        "ABC123", // own device ID
        "ABC123", // sender device ID
        VoiceBroadcastInfoState.Started,
        true, // expected return value
    ],
    ["@user1:example.com", "@user1:example.com", "ABC123", "ABC123", VoiceBroadcastInfoState.Paused, true],
    ["@user1:example.com", "@user1:example.com", "ABC123", "ABC123", VoiceBroadcastInfoState.Resumed, true],
    ["@user1:example.com", "@user1:example.com", "ABC123", "ABC123", VoiceBroadcastInfoState.Stopped, false],
    ["@user2:example.com", "@user1:example.com", "ABC123", "ABC123", VoiceBroadcastInfoState.Started, false],
    [null, "@user1:example.com", "ABC123", "ABC123", VoiceBroadcastInfoState.Started, false],
    // other device
    ["@user1:example.com", "@user1:example.com", "ABC123", "JKL123", VoiceBroadcastInfoState.Started, false],
    ["@user1:example.com", "@user1:example.com", "ABC123", "JKL123", VoiceBroadcastInfoState.Paused, false],
    ["@user1:example.com", "@user1:example.com", "ABC123", "JKL123", VoiceBroadcastInfoState.Resumed, false],
];

describe("shouldDisplayAsVoiceBroadcastRecordingTile", () => {
    let event: MatrixEvent;
    let client: MatrixClient;

    beforeAll(() => {
        client = createTestClient();
    });

    describe.each<TestTuple>(testCases)(
        "when called with user »%s«, sender »%s«, device »%s«, sender device »%s« state »%s«",
        (userId, senderId, deviceId, senderDeviceId, state, expected) => {
            beforeEach(() => {
                event = mkVoiceBroadcastInfoStateEvent("!room:example.com", state, senderId, senderDeviceId);
                mocked(client.getUserId).mockReturnValue(userId);
                mocked(client.getDeviceId).mockReturnValue(deviceId);
            });

            it(`should return ${expected}`, () => {
                expect(shouldDisplayAsVoiceBroadcastRecordingTile(state, client, event)).toBe(expected);
            });
        },
    );

    it("should return false, when all params are null", () => {
        event = mkVoiceBroadcastInfoStateEvent("!room:example.com", null, null, null);
        // @ts-ignore Simulate null state received for any reason.
        expect(shouldDisplayAsVoiceBroadcastRecordingTile(null, client, event)).toBe(false);
    });

    it("should return false, when all params are undefined", () => {
        event = mkVoiceBroadcastInfoStateEvent("!room:example.com", undefined, undefined, undefined);
        // @ts-ignore Simulate undefined state received for any reason.
        expect(shouldDisplayAsVoiceBroadcastRecordingTile(undefined, client, event)).toBe(false);
    });
});
