/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { SimpleObservable } from "matrix-widget-api";

import { type Playback, PlaybackState } from "../../src/audio/Playback";
import { type PlaybackClock } from "../../src/audio/PlaybackClock";
import { UPDATE_EVENT } from "../../src/stores/AsyncStore";
import { type PublicInterface } from "../@types/common";

export const createTestPlayback = (overrides: Partial<Playback> = {}): Playback => {
    const eventEmitter = new EventEmitter();

    return {
        thumbnailWaveform: [1, 2, 3],
        sizeBytes: 23,
        waveform: [4, 5, 6],
        waveformData: new SimpleObservable<number[]>(),
        destroy: jest.fn(),
        play: jest.fn(),
        prepare: jest.fn(),
        pause: jest.fn(),
        stop: jest.fn(),
        toggle: jest.fn(),
        skipTo: jest.fn(),
        isPlaying: false,
        clockInfo: createTestPlaybackClock(),
        currentState: PlaybackState.Stopped,
        emit: (event: PlaybackState, ...args: any[]): boolean => {
            eventEmitter.emit(event, ...args);
            eventEmitter.emit(UPDATE_EVENT, event, ...args);
            return true;
        },
        // EventEmitter
        on: eventEmitter.on.bind(eventEmitter) as Playback["on"],
        once: eventEmitter.once.bind(eventEmitter) as Playback["once"],
        off: eventEmitter.off.bind(eventEmitter) as Playback["off"],
        addListener: eventEmitter.addListener.bind(eventEmitter) as Playback["addListener"],
        removeListener: eventEmitter.removeListener.bind(eventEmitter) as Playback["removeListener"],
        removeAllListeners: eventEmitter.removeAllListeners.bind(eventEmitter) as Playback["removeAllListeners"],
        getMaxListeners: eventEmitter.getMaxListeners.bind(eventEmitter) as Playback["getMaxListeners"],
        setMaxListeners: eventEmitter.setMaxListeners.bind(eventEmitter) as Playback["setMaxListeners"],
        listeners: eventEmitter.listeners.bind(eventEmitter) as Playback["listeners"],
        rawListeners: eventEmitter.rawListeners.bind(eventEmitter) as Playback["rawListeners"],
        listenerCount: eventEmitter.listenerCount.bind(eventEmitter) as Playback["listenerCount"],
        eventNames: eventEmitter.eventNames.bind(eventEmitter) as Playback["eventNames"],
        prependListener: eventEmitter.prependListener.bind(eventEmitter) as Playback["prependListener"],
        prependOnceListener: eventEmitter.prependOnceListener.bind(eventEmitter) as Playback["prependOnceListener"],
        liveData: new SimpleObservable<number[]>(),
        durationSeconds: 31415,
        timeSeconds: 3141,
        ...overrides,
    } as PublicInterface<Playback> as Playback;
};

export const createTestPlaybackClock = (): PlaybackClock => {
    return {
        durationSeconds: 31,
        timeSeconds: 41,
        liveData: new SimpleObservable<number[]>(),
        populatePlaceholdersFrom: jest.fn(),
        flagLoadTime: jest.fn(),
        flagStart: jest.fn(),
        flagStop: jest.fn(),
        syncTo: jest.fn(),
        destroy: jest.fn(),
    } as PublicInterface<PlaybackClock> as PlaybackClock;
};
