/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { Room } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastPreview } from "../../../../src/stores/room-list/previews/VoiceBroadcastPreview";
import { VoiceBroadcastInfoState } from "../../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../../../voice-broadcast/utils/test-utils";

describe("VoiceBroadcastPreview.getTextFor", () => {
    const roomId = "!room:example.com";
    const userId = "@user:example.com";
    const deviceId = "d42";
    let preview: VoiceBroadcastPreview;

    beforeAll(() => {
        preview = new VoiceBroadcastPreview();
    });

    it("when passing an event with empty content, it should return null", () => {
        const event = mkEvent({
            event: true,
            content: {},
            user: userId,
            type: "m.room.message",
        });
        expect(preview.getTextFor(event)).toBeNull();
    });

    it("when passing a broadcast started event, it should return null", () => {
        const event = mkVoiceBroadcastInfoStateEvent(roomId, VoiceBroadcastInfoState.Started, userId, deviceId);
        expect(preview.getTextFor(event)).toBeNull();
    });

    it("when passing a broadcast stopped event, it should return the expected text", () => {
        const event = mkVoiceBroadcastInfoStateEvent(roomId, VoiceBroadcastInfoState.Stopped, userId, deviceId);
        expect(preview.getTextFor(event)).toBe("@user:example.com ended a voice broadcast");
    });

    it("when passing a redacted broadcast stopped event, it should return null", () => {
        const event = mkVoiceBroadcastInfoStateEvent(roomId, VoiceBroadcastInfoState.Stopped, userId, deviceId);
        event.makeRedacted(
            mkEvent({ event: true, content: {}, user: userId, type: "m.room.redaction" }),
            new Room(roomId, stubClient(), userId),
        );
        expect(preview.getTextFor(event)).toBeNull();
    });
});
