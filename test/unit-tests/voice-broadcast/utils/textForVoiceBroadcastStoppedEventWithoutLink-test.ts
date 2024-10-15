/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

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
