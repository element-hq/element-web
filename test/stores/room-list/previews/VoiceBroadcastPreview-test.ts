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

import { VoiceBroadcastPreview } from "../../../../src/stores/room-list/previews/VoiceBroadcastPreview";
import { VoiceBroadcastInfoState } from "../../../../src/voice-broadcast";
import { mkEvent } from "../../../test-utils";
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
        event.makeRedacted(mkEvent({ event: true, content: {}, user: userId, type: "m.room.redaction" }));
        expect(preview.getTextFor(event)).toBeNull();
    });
});
