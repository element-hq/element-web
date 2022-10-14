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
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import {
    shouldDisplayAsVoiceBroadcastRecordingTile,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
} from "../../../src/voice-broadcast";
import { createTestClient, mkEvent } from "../../test-utils";

const testCases = [
    [
        "@user1:example.com", // own MXID
        "@user1:example.com", // sender MXID
        VoiceBroadcastInfoState.Started,
        true, // expected return value
    ],
    [
        "@user1:example.com",
        "@user1:example.com",
        VoiceBroadcastInfoState.Paused,
        true,
    ],
    [
        "@user1:example.com",
        "@user1:example.com",
        VoiceBroadcastInfoState.Running,
        true,
    ],
    [
        "@user1:example.com",
        "@user1:example.com",
        VoiceBroadcastInfoState.Stopped,
        false,
    ],
    [
        "@user2:example.com",
        "@user1:example.com",
        VoiceBroadcastInfoState.Started,
        false,
    ],
    [
        null,
        null,
        null,
        false,
    ],
    [
        undefined,
        undefined,
        undefined,
        false,
    ],
];

describe("shouldDisplayAsVoiceBroadcastRecordingTile", () => {
    let event: MatrixEvent;
    let client: MatrixClient;

    beforeAll(() => {
        client = createTestClient();
    });

    describe.each(testCases)(
        "when called with user »%s«, sender »%s«, state »%s«",
        (userId: string, senderId: string, state: VoiceBroadcastInfoState, expected: boolean) => {
            beforeEach(() => {
                event = mkEvent({
                    event: true,
                    type: VoiceBroadcastInfoEventType,
                    room: "!room:example.com",
                    user: senderId,
                    content: {},
                });
                mocked(client.getUserId).mockReturnValue(userId);
            });

            it(`should return ${expected}`, () => {
                expect(shouldDisplayAsVoiceBroadcastRecordingTile(state, client, event)).toBe(expected);
            });
        });
});
