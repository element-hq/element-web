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
import { MatrixClient } from "matrix-js-sdk/src/client";

import { textForVoiceBroadcastStoppedEventWithoutLink, VoiceBroadcastInfoState } from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

describe("textForVoiceBroadcastStoppedEventWithoutLink", () => {
    const otherUserId = "@other:example.com";
    const roomId = "!room:example.com";
    let client: MatrixClient;

    beforeAll(() => {
        client = stubClient();
    });

    const getText = (senderId: string, startEventId?: string) => {
        const event = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Stopped,
            senderId,
            client.deviceId!,
        );
        return textForVoiceBroadcastStoppedEventWithoutLink(event);
    };

    it("when called for an own broadcast it should return the expected text", () => {
        expect(getText(client.getUserId()!)).toBe("You ended a voice broadcast");
    });

    it("when called for other ones broadcast it should return the expected text", () => {
        expect(getText(otherUserId)).toBe(`${otherUserId} ended a voice broadcast`);
    });

    it("when not logged in it should return the exptected text", () => {
        mocked(client.getUserId).mockReturnValue(null);
        expect(getText(otherUserId)).toBe(`${otherUserId} ended a voice broadcast`);
    });
});
