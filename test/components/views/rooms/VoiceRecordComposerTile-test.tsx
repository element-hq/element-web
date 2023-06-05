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

import React, { createRef, RefObject } from "react";
import { render } from "@testing-library/react";
import { MatrixClient, MsgType, Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import VoiceRecordComposerTile from "../../../../src/components/views/rooms/VoiceRecordComposerTile";
import { doMaybeLocalRoomAction } from "../../../../src/utils/local-room";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { IUpload, VoiceMessageRecording } from "../../../../src/audio/VoiceMessageRecording";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { VoiceRecordingStore } from "../../../../src/stores/VoiceRecordingStore";
import { PlaybackClock } from "../../../../src/audio/PlaybackClock";
import { mkEvent } from "../../../test-utils";
import SettingsStore from "../../../../src/settings/SettingsStore";

jest.mock("../../../../src/utils/local-room", () => ({
    doMaybeLocalRoomAction: jest.fn(),
}));

jest.mock("../../../../src/stores/VoiceRecordingStore", () => ({
    VoiceRecordingStore: {
        getVoiceRecordingId: jest.fn().mockReturnValue("voice-recording-id"),
        instance: {
            getActiveRecording: jest.fn(),
            disposeRecording: jest.fn(),
        },
    },
}));

describe("<VoiceRecordComposerTile/>", () => {
    let voiceRecordComposerTile: RefObject<VoiceRecordComposerTile>;
    let mockRecorder: VoiceMessageRecording;
    let mockUpload: IUpload;
    let mockClient: MatrixClient;
    const roomId = "!room:example.com";

    beforeEach(() => {
        mockClient = {
            getSafeUserId: jest.fn().mockReturnValue("@alice:example.com"),
            sendMessage: jest.fn(),
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
            permalinkCreator: new RoomPermalinkCreator(room),
        };
        mockUpload = {
            mxc: "mxc://example.com/voice",
        };
        mockRecorder = {
            on: jest.fn(),
            off: jest.fn(),
            stop: jest.fn(),
            upload: () => Promise.resolve(mockUpload),
            durationSeconds: 1337,
            contentType: "audio/ogg",
            getPlayback: () => ({
                on: jest.fn(),
                off: jest.fn(),
                prepare: jest.fn().mockResolvedValue(void 0),
                clockInfo: {
                    timeSeconds: 0,
                    liveData: {
                        onUpdate: jest.fn(),
                    },
                } as unknown as PlaybackClock,
                waveform: [1.4, 2.5, 3.6],
                waveformData: {
                    onUpdate: jest.fn(),
                },
                thumbnailWaveform: [1.4, 2.5, 3.6],
            }),
        } as unknown as VoiceMessageRecording;
        mocked(VoiceRecordingStore.instance.getActiveRecording).mockReturnValue(mockRecorder);
        render(<VoiceRecordComposerTile {...props} />);

        mocked(doMaybeLocalRoomAction).mockImplementation(
            <T,>(roomId: string, fn: (actualRoomId: string) => Promise<T>, _client?: MatrixClient) => {
                return fn(roomId);
            },
        );

        jest.spyOn(SettingsStore, "getValue").mockImplementation(
            (settingName) => settingName === "feature_intentional_mentions",
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
                "org.matrix.msc3952.mentions": {},
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
                permalinkCreator: new RoomPermalinkCreator(room),
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
                "org.matrix.msc3952.mentions": { user_ids: ["@bob:test"] },
            });
        });
    });
});
