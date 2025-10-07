/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Mocked } from "jest-mock";
import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { SimpleObservable } from "matrix-widget-api";

import { PlaybackQueue } from "../../../src/audio/PlaybackQueue";
import { PlaybackState, type Playback } from "../../../src/audio/Playback";
import { MockEventEmitter } from "../../test-utils";
import { UPDATE_EVENT } from "../../../src/stores/AsyncStore";


describe("PlaybackQueue", () => {
    let playbackQueue: PlaybackQueue;

    beforeEach(() => {
        const mockRoom = {
            getMember: jest.fn(),
        } as unknown as Mocked<Room>;
        playbackQueue = new PlaybackQueue(mockRoom);
    });

    it("does not cause playbackstate to be paused if skipping to 0", () => {
        const mockEvent = {
            getId: jest.fn().mockReturnValue("$foo:bar"),
        } as unknown as Mocked<MatrixEvent>;
        const mockPlayback = new MockEventEmitter({
            clockInfo: {
                liveData: new SimpleObservable<number[]>(),
            },
            skipTo: jest.fn(),
        }) as unknown as Mocked<Playback>;

        // Enqueue
        playbackQueue.unsortedEnqueue(mockEvent, mockPlayback);

        // Emit our clockInfo of 0, which will playbackQueue to save the state.
        mockPlayback.clockInfo.liveData.update([0]);

        // Fire an update event to say that we have stopped.
        // Note that Playback really emits an UPDATE_EVENT whenever state changes, the types are lies.
        mockPlayback.emit(UPDATE_EVENT as any, PlaybackState.Stopped);

        expect(mockPlayback.skipTo).not.toHaveBeenCalled();
    });
});
