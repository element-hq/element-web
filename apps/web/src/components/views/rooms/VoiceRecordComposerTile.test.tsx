/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { createRef, type RefObject } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "test-utils-rtl";
import { type MatrixClient, MsgType, type Room } from "matrix-js-sdk/src/matrix";
import { mkEvent } from "test-utils";

import VoiceRecordComposerTile from "./VoiceRecordComposerTile";
import { doMaybeLocalRoomAction } from "../../../utils/local-room";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { type IUpload, type VoiceMessageRecording } from "../../../audio/VoiceMessageRecording";
import { VoiceRecordingStore } from "../../../stores/VoiceRecordingStore";
import { type PlaybackClock } from "../../../audio/PlaybackClock";

vi.mock("../../../utils/local-room", () => ({
    doMaybeLocalRoomAction: vi.fn(),
}));

vi.mock("../../../stores/VoiceRecordingStore", () => ({
    VoiceRecordingStore: {
        getVoiceRecordingId: vi.fn().mockReturnValue("voice-recording-id"),
        instance: {
            getActiveRecording: vi.fn(),
            disposeRecording: vi.fn(),
        },
    },
}));

describe("<VoiceRecordComposerTile/>", () => {
    let voiceRecordComposerTile: RefObject<VoiceRecordComposerTile | null>;
    let mockRecorder: VoiceMessageRecording;
    let mockUpload: IUpload;
    let mockClient: MatrixClient;
    const roomId = "!room:example.com";

    beforeEach(() => {
        mockClient = {
            getSafeUserId: vi.fn().mockReturnValue("@alice:example.com"),
            sendMessage: vi.fn(),
        } as unknown as MatrixClient;
        MatrixClientPeg.get = () => mockClient;
        MatrixClientPeg.safeGet = () => mockClient;

        const room = {
            roomId,
        } as unknown as Room;

        voiceRecordComposerTile = createRef();
        const props = {
            room,
            ref: voiceRecordComposerTile,
        };
        mockUpload = {
            mxc: "mxc://example.com/voice",
        };
        mockRecorder = {
            on: vi.fn(),
            off: vi.fn(),
            stop: vi.fn(),
            upload: () => Promise.resolve(mockUpload),
            durationSeconds: 1337,
            contentType: "audio/ogg",
            getPlayback: () => ({
                on: vi.fn(),
                off: vi.fn(),
                prepare: vi.fn().mockResolvedValue(void 0),
                clockInfo: {
                    timeSeconds: 0,
                    liveData: {
                        onUpdate: vi.fn(),
                    },
                } as unknown as PlaybackClock,
                waveform: [1.4, 2.5, 3.6],
                waveformData: {
                    onUpdate: vi.fn(),
                },
                thumbnailWaveform: [1.4, 2.5, 3.6],
            }),
        } as unknown as VoiceMessageRecording;
        vi.mocked(VoiceRecordingStore.instance.getActiveRecording).mockReturnValue(mockRecorder);
        render(<VoiceRecordComposerTile {...props} />);

        vi.mocked(doMaybeLocalRoomAction).mockImplementation(
            <T,>(roomId: string, fn: (actualRoomId: string) => Promise<T>, _client?: MatrixClient) => {
                return fn(roomId);
            },
        );
    });

    describe("send", () => {
        it("should send the voice recording", async () => {
            await voiceRecordComposerTile.current!.send();
            expect(mockClient.sendMessage).toHaveBeenCalledWith(roomId, {
                "body": "Voice message",
                "file": undefined,
                "info": {
                    duration: 1337000,
                    mimetype: "audio/ogg",
                    size: undefined,
                },
                "msgtype": MsgType.Audio,
                "org.matrix.msc1767.audio": {
                    duration: 1337000,
                    waveform: [1434, 2560, 3686],
                },
                "org.matrix.msc1767.file": {
                    file: undefined,
                    mimetype: "audio/ogg",
                    name: "Voice message.ogg",
                    size: undefined,
                    url: "mxc://example.com/voice",
                },
                "org.matrix.msc1767.text": "Voice message",
                "org.matrix.msc3245.voice": {},
                "url": "mxc://example.com/voice",
                "m.mentions": {},
            });
        });

        it("reply with voice recording", async () => {
            const room = {
                roomId,
            } as unknown as Room;

            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: roomId,
                content: {},
                event: true,
            });

            const props = {
                room,
                ref: voiceRecordComposerTile,
                replyToEvent,
            };
            render(<VoiceRecordComposerTile {...props} />);

            await voiceRecordComposerTile.current!.send();
            expect(mockClient.sendMessage).toHaveBeenCalledWith(roomId, {
                "body": "Voice message",
                "file": undefined,
                "info": {
                    duration: 1337000,
                    mimetype: "audio/ogg",
                    size: undefined,
                },
                "msgtype": MsgType.Audio,
                "org.matrix.msc1767.audio": {
                    duration: 1337000,
                    waveform: [1434, 2560, 3686],
                },
                "org.matrix.msc1767.file": {
                    file: undefined,
                    mimetype: "audio/ogg",
                    name: "Voice message.ogg",
                    size: undefined,
                    url: "mxc://example.com/voice",
                },
                "org.matrix.msc1767.text": "Voice message",
                "org.matrix.msc3245.voice": {},
                "url": "mxc://example.com/voice",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: replyToEvent.getId(),
                    },
                },
                "m.mentions": { user_ids: ["@bob:test"] },
            });
        });
    });
});
