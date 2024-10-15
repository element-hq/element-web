/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
            event.getContent = () => ({}) as any;
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
            event.getContent = () => ({}) as any;
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
