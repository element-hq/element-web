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
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastInfoEventType,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackEvent,
    VoiceBroadcastPlaybackState,
} from "../../../src/voice-broadcast";
import { mkEvent } from "../../test-utils";

describe("VoiceBroadcastPlayback", () => {
    const userId = "@user:example.com";
    const roomId = "!room:example.com";
    let infoEvent: MatrixEvent;
    let playback: VoiceBroadcastPlayback;
    let onStateChanged: (state: VoiceBroadcastPlaybackState) => void;

    const itShouldSetTheStateTo = (state: VoiceBroadcastPlaybackState) => {
        it(`should set the state to ${state}`, () => {
            expect(playback.getState()).toBe(state);
        });
    };

    const itShouldEmitAStateChangedEvent = (state: VoiceBroadcastPlaybackState) => {
        it(`should emit a ${state} state changed event`, () => {
            expect(mocked(onStateChanged)).toHaveBeenCalledWith(state);
        });
    };

    beforeAll(() => {
        infoEvent = mkEvent({
            event: true,
            type: VoiceBroadcastInfoEventType,
            user: userId,
            room: roomId,
            content: {},
        });
    });

    beforeEach(() => {
        onStateChanged = jest.fn();

        playback = new VoiceBroadcastPlayback(infoEvent);
        jest.spyOn(playback, "removeAllListeners");
        playback.on(VoiceBroadcastPlaybackEvent.StateChanged, onStateChanged);
    });

    it("should expose the info event", () => {
        expect(playback.infoEvent).toBe(infoEvent);
    });

    it("should be in state Stopped", () => {
        expect(playback.getState()).toBe(VoiceBroadcastPlaybackState.Stopped);
    });

    describe("when calling start", () => {
        beforeEach(() => {
            playback.start();
        });

        itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);

        describe("and calling toggle", () => {
            beforeEach(() => {
                playback.toggle();
            });

            itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Stopped);
            itShouldEmitAStateChangedEvent(VoiceBroadcastPlaybackState.Stopped);
        });
    });

    describe("when calling stop", () => {
        beforeEach(() => {
            playback.stop();
        });

        itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Stopped);

        describe("and calling toggle", () => {
            beforeEach(() => {
                playback.toggle();
            });

            itShouldSetTheStateTo(VoiceBroadcastPlaybackState.Playing);
            itShouldEmitAStateChangedEvent(VoiceBroadcastPlaybackState.Stopped);
        });
    });

    describe("when calling destroy", () => {
        beforeEach(() => {
            playback.destroy();
        });

        it("should call removeAllListeners", () => {
            expect(playback.removeAllListeners).toHaveBeenCalled();
        });
    });
});
