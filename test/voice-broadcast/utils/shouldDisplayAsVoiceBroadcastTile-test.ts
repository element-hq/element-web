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

import { EventType, IEvent, MatrixEvent } from "matrix-js-sdk/src/matrix";

import {
    shouldDisplayAsVoiceBroadcastTile,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
} from "../../../src/voice-broadcast";
import { mkEvent } from "../../test-utils";

describe("shouldDisplayAsVoiceBroadcastTile", () => {
    let event: MatrixEvent;
    const roomId = "!room:example.com";
    const senderId = "@user:example.com";

    const itShouldReturnFalse = () => {
        it("should return false", () => {
            expect(shouldDisplayAsVoiceBroadcastTile(event)).toBe(false);
        });
    };

    const itShouldReturnTrue = () => {
        it("should return true", () => {
            expect(shouldDisplayAsVoiceBroadcastTile(event)).toBe(true);
        });
    };

    describe("when a broken event occurs", () => {
        beforeEach(() => {
            event = 23 as unknown as MatrixEvent;
        });

        itShouldReturnFalse();
    });

    describe("when a non-voice broadcast info event occurs", () => {
        beforeEach(() => {
            event = mkEvent({
                event: true,
                type: EventType.RoomMessage,
                room: roomId,
                user: senderId,
                content: {},
            });
        });

        itShouldReturnFalse();
    });

    describe("when a voice broadcast info event with empty content occurs", () => {
        beforeEach(() => {
            event = mkEvent({
                event: true,
                type: VoiceBroadcastInfoEventType,
                room: roomId,
                user: senderId,
                content: {},
            });
        });

        itShouldReturnFalse();
    });

    describe("when a voice broadcast info event with undefined content occurs", () => {
        beforeEach(() => {
            event = mkEvent({
                event: true,
                type: VoiceBroadcastInfoEventType,
                room: roomId,
                user: senderId,
                content: {},
            });
            event.getContent = () => ({} as any);
        });

        itShouldReturnFalse();
    });

    describe("when a voice broadcast info event in state started occurs", () => {
        beforeEach(() => {
            event = mkEvent({
                event: true,
                type: VoiceBroadcastInfoEventType,
                room: roomId,
                user: senderId,
                content: {
                    state: VoiceBroadcastInfoState.Started,
                },
            });
        });

        itShouldReturnTrue();
    });

    describe("when a redacted event occurs", () => {
        beforeEach(() => {
            event = mkEvent({
                event: true,
                type: VoiceBroadcastInfoEventType,
                room: roomId,
                user: senderId,
                content: {},
                unsigned: {
                    redacted_because: {} as unknown as IEvent,
                },
            });
            event.getContent = () => ({} as any);
        });

        itShouldReturnTrue();
    });

    describe.each([VoiceBroadcastInfoState.Paused, VoiceBroadcastInfoState.Resumed, VoiceBroadcastInfoState.Stopped])(
        "when a voice broadcast info event in state %s occurs",
        (state: VoiceBroadcastInfoState) => {
            beforeEach(() => {
                event = mkEvent({
                    event: true,
                    type: VoiceBroadcastInfoEventType,
                    room: roomId,
                    user: senderId,
                    content: {
                        state,
                    },
                });
            });

            itShouldReturnFalse();
        },
    );
});
