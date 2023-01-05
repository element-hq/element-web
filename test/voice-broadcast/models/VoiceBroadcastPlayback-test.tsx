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
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { Playback, PlaybackState } from "../../../src/audio/Playback";
import { PlaybackManager } from "../../../src/audio/PlaybackManager";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import { MediaEventHelper } from "../../../src/utils/MediaEventHelper";
import {
    VoiceBroadcastInfoState,
    VoiceBroadcastLiveness,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackEvent,
    VoiceBroadcastPlaybackState,
    VoiceBroadcastRecording,
} from "../../../src/voice-broadcast";
import { flushPromises, stubClient } from "../../test-utils";
import { createTestPlayback } from "../../test-utils/audio";
import { mkVoiceBroadcastChunkEvent, mkVoiceBroadcastInfoStateEvent } from "../utils/test-utils";

jest.mock("../../../src/utils/MediaEventHelper", () => ({
    MediaEventHelper: jest.fn(),
}));

describe("VoiceBroadcastPlayback", () => {
    const userId = "@user:example.com";
    let deviceId: string;
    const roomId = "!room:example.com";
    let room: Room;
    let client: MatrixClient;
    let infoEvent: MatrixEvent;
    let playback: VoiceBroadcastPlayback;
    let onStateChanged: (state: VoiceBroadcastPlaybackState) => void;
    let chunk1Event: MatrixEvent;
    let chunk2Event: MatrixEvent;
    let chunk2BEvent: MatrixEvent;
    let chunk3Event: MatrixEvent;
    const chunk1Length = 2300;
    const chunk2Length = 4200;
    const chunk3Length = 6900;
    const chunk1Data = new ArrayBuffer(2);
    const chunk2Data = new ArrayBuffer(3);
    const chunk3Data = new ArrayBuffer(3);
    let chunk1Helper: MediaEventHelper;
    let chunk2Helper: MediaEventHelper;
    let chunk3Helper: MediaEventHelper;
    let chunk1Playback: Playback;
    let chunk2Playback: Playback;
    let chunk3Playback: Playback;

    const queryConfirmListeningDialog = () => {
        return screen.queryByText(
            "If you start listening to this live broadcast, your current live broadcast recording will be ended.",
        );
    };

    const waitForDialog = async () => {
        await flushPromises();
        await flushPromises();
    };

    const itShouldSetTheStateTo = (state: VoiceBroadcastPlaybackState) => {
        it(`should set the state to ${state}`, () => {
            expect(playback.getState()).toBe(state);
        });
    };

    const itShouldEmitAStateChangedEvent = (state: VoiceBroadcastPlaybackState) => {
        it(`should emit a ${state} state changed event`, () => {
            expect(mocked(onStateChanged)).toHaveBeenCalledWith(state, playback);
        });
    };

    const itShouldHaveLiveness = (liveness: VoiceBroadcastLiveness): void => {
        it(`should have liveness ${liveness}`, () => {
            expect(playback.getLiveness()).toBe(liveness);
        });
    };

    const startPlayback = () => {
        beforeEach(async () => {
            await playback.start();
        });
    };

    const pausePlayback = () => {
        beforeEach(() => {
            playback.pause();
        });
    };

    const stopPlayback = () => {
        beforeEach(() => {
            playback.stop();
        });
    };

    const mkChunkHelper = (data: ArrayBuffer): MediaEventHelper => {
        return {
            sourceBlob: {
                cachedValue: new Blob(),
                done: false,
                value: {
                    // @ts-ignore
                    arrayBuffer: jest.fn().mockResolvedValue(data),
                },
            },
        };
    };

    const mkInfoEvent = (state: VoiceBroadcastInfoState) => {
        return mkVoiceBroadcastInfoStateEvent(roomId, state, userId, deviceId);
    };

    const mkPlayback = async () => {
        const playback = new VoiceBroadcastPlayback(
            infoEvent,
            client,
            SdkContextClass.instance.voiceBroadcastRecordingsStore,
        );
        jest.spyOn(playback, "removeAllListeners");
        jest.spyOn(playback, "destroy");
        playback.on(VoiceBroadcastPlaybackEvent.StateChanged, onStateChanged);
        await flushPromises();
        return playback;
    };

    const setUpChunkEvents = (chunkEvents: MatrixEvent[]) => {
        mocked(client.relations).mockResolvedValueOnce({
            events: chunkEvents,
        });
    };

    const createChunkEvents = () => {
        chunk1Event = mkVoiceBroadcastChunkEvent(infoEvent.getId()!, userId, roomId, chunk1Length, 1);
        chunk2Event = mkVoiceBroadcastChunkEvent(infoEvent.getId()!, userId, roomId, chunk2Length, 2);
        chunk2Event.setTxnId("tx-id-1");
        chunk2BEvent = mkVoiceBroadcastChunkEvent(infoEvent.getId()!, userId, roomId, chunk2Length, 2);
        chunk2BEvent.setTxnId("tx-id-1");
        chunk3Event = mkVoiceBroadcastChunkEvent(infoEvent.getId()!, userId, roomId, chunk3Length, 3);

        chunk1Helper = mkChunkHelper(chunk1Data);
        chunk2Helper = mkChunkHelper(chunk2Data);
        chunk3Helper = mkChunkHelper(chunk3Data);

        chunk1Playback = createTestPlayback();
        chunk2Playback = createTestPlayback();
        chunk3Playback = createTestPlayback();

        jest.spyOn(PlaybackManager.instance, "createPlaybackInstance").mockImplementation(
            (buffer: ArrayBuffer, _waveForm?: number[]) => {
                if (buffer === chunk1Data) return chunk1Playback;
                if (buffer === chunk2Data) return chunk2Playback;
                if (buffer === chunk3Data) return chunk3Playback;

                throw new Error("unexpected buffer");
            },
        );

        mocked(MediaEventHelper).mockImplementation((event: MatrixEvent): any => {
            if (event === chunk1Event) return chunk1Helper;
            if (event === chunk2Event) return chunk2Helper;
            if (event === chunk3Event) return chunk3Helper;
        });
    };

    beforeEach(() => {
        client = stubClient();
        deviceId = client.getDeviceId() || "";
        jest.clearAllMocks();
        room = new Room(roomId, client, client.getSafeUserId());
        mocked(client.getRoom).mockImplementation((roomId: string): Room | null => {
            if (roomId === room.roomId) return room;
            return null;
        });
        onStateChanged = jest.fn();
    });

    afterEach(async () => {
        SdkContextClass.instance.voiceBroadcastPlaybacksStore.getCurrent()?.stop();
        SdkContextClass.instance.voiceBroadcastPlaybacksStore.clearCurrent();
        await SdkContextClass.instance.voiceBroadcastRecordingsStore.getCurrent()?.stop();
        SdkContextClass.instance.voiceBroadcastRecordingsStore.clearCurrent();
        playback.destroy();
    });

    describe(`when there is a ${VoiceBroadcastInfoState.Resumed} broadcast without chunks yet`, () => {
        beforeEach(async () => {
            infoEvent = mkInfoEvent(VoiceBroadcastInfoState.Resumed);
            createChunkEvents();
            room.addLiveEvents([infoEvent]);
            playback = await mkPlayback();
        });

        describe("and calling start", () => {
            startPlayback();

            itShouldHaveLiveness("live");

            it("should be in buffering state", () => {
                expect(playback.getState()).toBe(VoiceBroadcastPlaybackState.Buffering);
            });

            it("should have duration 0", () => {
                expect(playback.durationSeconds).toBe(0);
            });

            it("should be at time 0", () => {
                expect(playback.timeSeconds).toBe(0);
            });

            describe("and calling stop", () => {
                stopPlayback();
                itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Stopped);

                describe("and calling pause", () => {
                    pausePlayback();
                    // stopped voice broadcasts cannot be paused
                    itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Stopped);
                });
            });

            describe("and calling pause", () => {
                pausePlayback();
                itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Paused);
            });

            describe("and receiving the first chunk", () => {
                beforeEach(() => {
                    room.relations.aggregateChildEvent(chunk1Event);
                });

                itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);
                itShouldHaveLiveness("live");

                it("should update the duration", () => {
                    expect(playback.durationSeconds).toBe(2.3);
                });

                it("should play the first chunk", () => {
                    expect(chunk1Playback.play).toHaveBeenCalled();
                });
            });
        });
    });

    describe(`when there is a ${VoiceBroadcastInfoState.Resumed} voice broadcast with some chunks`, () => {
        beforeEach(async () => {
            mocked(client.relations).mockResolvedValueOnce({ events: [] });
            infoEvent = mkInfoEvent(VoiceBroadcastInfoState.Resumed);
            createChunkEvents();
            setUpChunkEvents([chunk2Event, chunk1Event]);
            room.addLiveEvents([infoEvent, chunk1Event, chunk2Event]);
            room.relations.aggregateChildEvent(chunk2Event);
            room.relations.aggregateChildEvent(chunk1Event);
            playback = await mkPlayback();
        });

        it("durationSeconds should have the length of the known chunks", () => {
            expect(playback.durationSeconds).toEqual(6.5);
        });

        describe("and an event with the same transaction Id occurs", () => {
            beforeEach(() => {
                room.addLiveEvents([chunk2BEvent]);
                room.relations.aggregateChildEvent(chunk2BEvent);
            });

            it("durationSeconds should not change", () => {
                expect(playback.durationSeconds).toEqual(6.5);
            });
        });

        describe("and calling start", () => {
            startPlayback();

            it("should play the last chunk", () => {
                expect(playback.getState()).toBe(VoiceBroadcastPlaybackState.Playing);
                // assert that the last chunk is played first
                expect(chunk2Playback.play).toHaveBeenCalled();
                expect(chunk1Playback.play).not.toHaveBeenCalled();
            });

            describe(
                "and receiving a stop info event with last_chunk_sequence = 2 and " +
                    "the playback of the last available chunk ends",
                () => {
                    beforeEach(() => {
                        const stoppedEvent = mkVoiceBroadcastInfoStateEvent(
                            roomId,
                            VoiceBroadcastInfoState.Stopped,
                            client.getSafeUserId(),
                            client.deviceId!,
                            infoEvent,
                            2,
                        );
                        room.addLiveEvents([stoppedEvent]);
                        room.relations.aggregateChildEvent(stoppedEvent);
                        chunk2Playback.emit(PlaybackState.Stopped);
                    });

                    itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Stopped);
                },
            );

            describe(
                "and receiving a stop info event with last_chunk_sequence = 3 and " +
                    "the playback of the last available chunk ends",
                () => {
                    beforeEach(() => {
                        const stoppedEvent = mkVoiceBroadcastInfoStateEvent(
                            roomId,
                            VoiceBroadcastInfoState.Stopped,
                            client.getSafeUserId(),
                            client.deviceId!,
                            infoEvent,
                            3,
                        );
                        room.addLiveEvents([stoppedEvent]);
                        room.relations.aggregateChildEvent(stoppedEvent);
                        chunk2Playback.emit(PlaybackState.Stopped);
                    });

                    itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Buffering);

                    describe("and the next chunk arrives", () => {
                        beforeEach(() => {
                            room.addLiveEvents([chunk3Event]);
                            room.relations.aggregateChildEvent(chunk3Event);
                        });

                        itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);

                        it("should play the next chunk", () => {
                            expect(chunk3Playback.play).toHaveBeenCalled();
                        });
                    });
                },
            );

            describe("and the info event is deleted", () => {
                beforeEach(() => {
                    infoEvent.makeRedacted(new MatrixEvent({}));
                });

                it("should stop and destroy the playback", () => {
                    expect(playback.getState()).toBe(VoiceBroadcastPlaybackState.Stopped);
                    expect(playback.destroy).toHaveBeenCalled();
                });
            });
        });

        describe("and currently recording a broadcast", () => {
            let recording: VoiceBroadcastRecording;

            beforeEach(async () => {
                recording = new VoiceBroadcastRecording(
                    mkVoiceBroadcastInfoStateEvent(
                        roomId,
                        VoiceBroadcastInfoState.Started,
                        client.getSafeUserId(),
                        client.deviceId,
                    ),
                    client,
                );
                jest.spyOn(recording, "stop");
                SdkContextClass.instance.voiceBroadcastRecordingsStore.setCurrent(recording);
                playback.start();
                await waitForDialog();
            });

            it("should display a confirm modal", () => {
                expect(queryConfirmListeningDialog()).toBeInTheDocument();
            });

            describe("when confirming the dialog", () => {
                beforeEach(async () => {
                    await userEvent.click(screen.getByText("Yes, end my recording"));
                });

                it("should stop the recording", () => {
                    expect(recording.stop).toHaveBeenCalled();
                    expect(SdkContextClass.instance.voiceBroadcastRecordingsStore.getCurrent()).toBeNull();
                });

                it("should not start the playback", () => {
                    expect(playback.getState()).toBe(VoiceBroadcastPlaybackState.Playing);
                });
            });

            describe("when not confirming the dialog", () => {
                beforeEach(async () => {
                    await userEvent.click(screen.getByText("No"));
                });

                it("should not stop the recording", () => {
                    expect(recording.stop).not.toHaveBeenCalled();
                });

                it("should start the playback", () => {
                    expect(playback.getState()).toBe(VoiceBroadcastPlaybackState.Stopped);
                });
            });
        });
    });

    describe("when there is a stopped voice broadcast", () => {
        beforeEach(async () => {
            infoEvent = mkInfoEvent(VoiceBroadcastInfoState.Stopped);
            createChunkEvents();
            setUpChunkEvents([chunk2Event, chunk1Event]);
            room.addLiveEvents([infoEvent, chunk1Event, chunk2Event]);
            playback = await mkPlayback();
        });

        it("should expose the info event", () => {
            expect(playback.infoEvent).toBe(infoEvent);
        });

        itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Stopped);

        describe("and calling start", () => {
            startPlayback();

            itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);

            it("should play the chunks beginning with the first one", () => {
                // assert that the first chunk is being played
                expect(chunk1Playback.play).toHaveBeenCalled();
                expect(chunk2Playback.play).not.toHaveBeenCalled();
            });

            describe("and calling start again", () => {
                it("should not play the first chunk a second time", () => {
                    expect(chunk1Playback.play).toHaveBeenCalledTimes(1);
                });
            });

            describe("and the chunk playback progresses", () => {
                beforeEach(() => {
                    chunk1Playback.clockInfo.liveData.update([11]);
                });

                it("should update the time", () => {
                    expect(playback.timeSeconds).toBe(11);
                });
            });

            describe("and skipping to the middle of the second chunk", () => {
                const middleOfSecondChunk = (chunk1Length + chunk2Length / 2) / 1000;

                beforeEach(async () => {
                    await playback.skipTo(middleOfSecondChunk);
                });

                it("should play the second chunk", () => {
                    expect(chunk1Playback.stop).toHaveBeenCalled();
                    expect(chunk2Playback.play).toHaveBeenCalled();
                });

                it("should update the time", () => {
                    expect(playback.timeSeconds).toBe(middleOfSecondChunk);
                });

                describe("and skipping to the start", () => {
                    beforeEach(async () => {
                        await playback.skipTo(0);
                    });

                    it("should play the second chunk", () => {
                        expect(chunk1Playback.play).toHaveBeenCalled();
                        expect(chunk2Playback.stop).toHaveBeenCalled();
                    });

                    it("should update the time", () => {
                        expect(playback.timeSeconds).toBe(0);
                    });
                });
            });

            describe("and the first chunk ends", () => {
                beforeEach(() => {
                    chunk1Playback.emit(PlaybackState.Stopped);
                });

                it("should play until the end", () => {
                    // assert first chunk was unloaded
                    expect(chunk1Playback.destroy).toHaveBeenCalled();

                    // assert that the second chunk is being played
                    expect(chunk2Playback.play).toHaveBeenCalled();

                    // simulate end of second chunk
                    chunk2Playback.emit(PlaybackState.Stopped);

                    // assert that the entire playback is now in stopped state
                    expect(playback.getState()).toBe(VoiceBroadcastPlaybackState.Stopped);
                });
            });

            describe("and calling pause", () => {
                pausePlayback();
                itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Paused);
                itShouldEmitAStateChangedEvent(VoiceBroadcastPlaybackState.Paused);
            });

            describe("and calling stop", () => {
                stopPlayback();
                itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Stopped);

                it("should stop the playback", () => {
                    expect(chunk1Playback.stop).toHaveBeenCalled();
                });

                describe("and skipping to somewhere in the middle of the first chunk", () => {
                    beforeEach(async () => {
                        mocked(chunk1Playback.play).mockClear();
                        await playback.skipTo(1);
                    });

                    it("should not start the playback", () => {
                        expect(chunk1Playback.play).not.toHaveBeenCalled();
                    });
                });
            });

            describe("and calling destroy", () => {
                beforeEach(() => {
                    playback.destroy();
                });

                it("should call removeAllListeners", () => {
                    expect(playback.removeAllListeners).toHaveBeenCalled();
                });

                it("should call destroy on the playbacks", () => {
                    expect(chunk1Playback.destroy).toHaveBeenCalled();
                    expect(chunk2Playback.destroy).toHaveBeenCalled();
                });
            });
        });

        describe("and calling toggle for the first time", () => {
            beforeEach(async () => {
                await playback.toggle();
            });

            itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);

            describe("and calling toggle a second time", () => {
                beforeEach(async () => {
                    await playback.toggle();
                });

                itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Paused);

                describe("and calling toggle a third time", () => {
                    beforeEach(async () => {
                        await playback.toggle();
                    });

                    itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);
                });
            });
        });

        describe("and calling stop", () => {
            stopPlayback();

            itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Stopped);

            describe("and calling toggle", () => {
                beforeEach(async () => {
                    mocked(onStateChanged).mockReset();
                    await playback.toggle();
                });

                itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);
                itShouldEmitAStateChangedEvent(VoiceBroadcastPlaybackState.Playing);
            });
        });
    });
});
