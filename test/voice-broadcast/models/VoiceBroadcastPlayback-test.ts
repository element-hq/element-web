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

import { Playback, PlaybackState } from "../../../src/audio/Playback";
import { PlaybackManager } from "../../../src/audio/PlaybackManager";
import { RelationsHelperEvent } from "../../../src/events/RelationsHelper";
import { MediaEventHelper } from "../../../src/utils/MediaEventHelper";
import {
    VoiceBroadcastInfoState,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackEvent,
    VoiceBroadcastPlaybackState,
} from "../../../src/voice-broadcast";
import { flushPromises, stubClient } from "../../test-utils";
import { createTestPlayback } from "../../test-utils/audio";
import { mkVoiceBroadcastChunkEvent, mkVoiceBroadcastInfoStateEvent } from "../utils/test-utils";

jest.mock("../../../src/events/getReferenceRelationsForEvent", () => ({
    getReferenceRelationsForEvent: jest.fn(),
}));

jest.mock("../../../src/utils/MediaEventHelper", () => ({
    MediaEventHelper: jest.fn(),
}));

describe("VoiceBroadcastPlayback", () => {
    const userId = "@user:example.com";
    let deviceId: string;
    const roomId = "!room:example.com";
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
        return mkVoiceBroadcastInfoStateEvent(
            roomId,
            state,
            userId,
            deviceId,
        );
    };

    const mkPlayback = async () => {
        const playback = new VoiceBroadcastPlayback(infoEvent, client);
        jest.spyOn(playback, "removeAllListeners");
        playback.on(VoiceBroadcastPlaybackEvent.StateChanged, onStateChanged);
        await flushPromises();
        return playback;
    };

    const setUpChunkEvents = (chunkEvents: MatrixEvent[]) => {
        mocked(client.relations).mockResolvedValueOnce({
            events: chunkEvents,
        });
    };

    beforeAll(() => {
        client = stubClient();
        deviceId = client.getDeviceId() || "";

        chunk1Event = mkVoiceBroadcastChunkEvent(userId, roomId, chunk1Length, 1);
        chunk2Event = mkVoiceBroadcastChunkEvent(userId, roomId, chunk2Length, 2);
        chunk2Event.setTxnId("tx-id-1");
        chunk2BEvent = mkVoiceBroadcastChunkEvent(userId, roomId, chunk2Length, 2);
        chunk2BEvent.setTxnId("tx-id-1");
        chunk3Event = mkVoiceBroadcastChunkEvent(userId, roomId, chunk3Length, 3);

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
    });

    beforeEach(() => {
        jest.clearAllMocks();
        onStateChanged = jest.fn();
    });

    afterEach(() => {
        playback.destroy();
    });

    describe(`when there is a ${VoiceBroadcastInfoState.Resumed} broadcast without chunks yet`, () => {
        beforeEach(async () => {
            // info relation
            mocked(client.relations).mockResolvedValueOnce({ events: [] });
            setUpChunkEvents([]);
            infoEvent = mkInfoEvent(VoiceBroadcastInfoState.Resumed);
            playback = await mkPlayback();
        });

        describe("and calling start", () => {
            startPlayback();

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
                    // TODO Michael W: Use RelationsHelper
                    // @ts-ignore
                    playback.chunkRelationHelper.emit(RelationsHelperEvent.Add, chunk1Event);
                });

                itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);

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
            // info relation
            mocked(client.relations).mockResolvedValueOnce({ events: [] });
            setUpChunkEvents([chunk2Event, chunk1Event]);
            infoEvent = mkInfoEvent(VoiceBroadcastInfoState.Resumed);
            playback = await mkPlayback();
        });

        it("durationSeconds should have the length of the known chunks", () => {
            expect(playback.durationSeconds).toEqual(6.5);
        });

        describe("and an event with the same transaction Id occurs", () => {
            beforeEach(() => {
                // @ts-ignore
                playback.chunkRelationHelper.emit(RelationsHelperEvent.Add, chunk2BEvent);
            });

            it("durationSeconds should not change", () => {
                expect(playback.durationSeconds).toEqual(6.5);
            });
        });

        describe("and calling start", () => {
            startPlayback();

            it("should play the last chunk", () => {
                // assert that the last chunk is played first
                expect(chunk2Playback.play).toHaveBeenCalled();
                expect(chunk1Playback.play).not.toHaveBeenCalled();
            });

            describe("and the playback of the last chunk ended", () => {
                beforeEach(() => {
                    chunk2Playback.emit(PlaybackState.Stopped);
                });

                itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Buffering);

                describe("and the next chunk arrived", () => {
                    beforeEach(() => {
                        // TODO Michael W: Use RelationsHelper
                        // @ts-ignore
                        playback.chunkRelationHelper.emit(RelationsHelperEvent.Add, chunk3Event);
                    });

                    itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);

                    it("should play the next chunk", () => {
                        expect(chunk3Playback.play).toHaveBeenCalled();
                    });
                });
            });
        });
    });

    describe("when there is a stopped voice broadcast", () => {
        beforeEach(async () => {
            setUpChunkEvents([chunk2Event, chunk1Event]);
            infoEvent = mkInfoEvent(VoiceBroadcastInfoState.Stopped);
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

            describe("and the chunk playback progresses", () => {
                beforeEach(() => {
                    chunk1Playback.clockInfo.liveData.update([11]);
                });

                it("should update the time", () => {
                    expect(playback.timeSeconds).toBe(11);
                });
            });

            describe("and skipping to the middle of the second chunk", () => {
                const middleOfSecondChunk = (chunk1Length + (chunk2Length / 2)) / 1000;

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
