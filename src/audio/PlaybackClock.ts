/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { SimpleObservable } from "matrix-widget-api";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { IDestroyable } from "../utils/IDestroyable";

/**
 * Tracks accurate human-perceptible time for an audio clip, as informed
 * by managed playback. This clock is tightly coupled with the operation
 * of the Playback class, making assumptions about how the provided
 * AudioContext will be used (suspended/resumed to preserve time, etc).
 *
 * But why do we need a clock? The AudioContext exposes time information,
 * and so does the audio buffer, but not in a way that is useful for humans
 * to perceive. The audio buffer time is often lagged behind the context
 * time due to internal processing delays of the audio API. Additionally,
 * the context's time is tracked from when it was first initialized/started,
 * not related to positioning within the clip. However, the context time
 * is the most accurate time we can use to determine position within the
 * clip if we're fast enough to track the pauses and stops.
 *
 * As a result, we track every play, pause, stop, and seek event from the
 * Playback class (kinda: it calls us, which is close enough to the same
 * thing). These events are then tracked on the AudioContext time scale,
 * with assumptions that code execution will result in negligible desync
 * of the clock, or at least no perceptible difference in time. It's
 * extremely important that the calling code, and the clock's own code,
 * is extremely fast between the event happening and the clock time being
 * tracked - anything more than a dozen milliseconds is likely to stack up
 * poorly, leading to clock desync.
 *
 * Clock desync can be dangerous for the stability of the playback controls:
 * if the clock thinks the user is somewhere else in the clip, it could
 * inform the playback of the wrong place in time, leading to dead air in
 * the output or, if severe enough, a clock that won't stop running while
 * the audio is paused/stopped. Other examples include the clip stopping at
 * 90% time due to playback ending, the clip playing from the wrong spot
 * relative to the time, and negative clock time.
 *
 * Note that the clip duration is fed to the clock: this is to ensure that
 * we have the most accurate time possible to present.
 */
export class PlaybackClock implements IDestroyable {
    private clipStart = 0;
    private stopped = true;
    private lastCheck = 0;
    private observable = new SimpleObservable<number[]>();
    private timerId?: number;
    private clipDuration = 0;
    private placeholderDuration = 0;

    public constructor(private context: AudioContext) {}

    public get durationSeconds(): number {
        return this.clipDuration || this.placeholderDuration;
    }

    public set durationSeconds(val: number) {
        this.clipDuration = val;
        this.observable.update([this.timeSeconds, this.clipDuration]);
    }

    public get timeSeconds(): number {
        // The modulo is to ensure that we're only looking at the most recent clip
        // time, as the context is long-running and multiple plays might not be
        // informed to us (if the control is looping, for example). By taking the
        // remainder of the division operation, we're assuming that playback is
        // incomplete or stopped, thus giving an accurate position within the active
        // clip segment.
        return (this.context.currentTime - this.clipStart) % this.clipDuration;
    }

    public get liveData(): SimpleObservable<number[]> {
        return this.observable;
    }

    private checkTime = (force = false): void => {
        const now = this.timeSeconds; // calculated dynamically
        if (this.lastCheck !== now || force) {
            this.observable.update([now, this.durationSeconds]);
            this.lastCheck = now;
        }
    };

    /**
     * Populates default information about the audio clip from the event body.
     * The placeholders will be overridden once known.
     * @param {MatrixEvent} event The event to use for placeholders.
     */
    public populatePlaceholdersFrom(event: MatrixEvent): void {
        const durationMs = Number(event.getContent()["info"]?.["duration"]);
        if (Number.isFinite(durationMs)) this.placeholderDuration = durationMs / 1000;
    }

    /**
     * Mark the time in the audio context where the clip starts/has been loaded.
     * This is to ensure the clock isn't skewed into thinking it is ~0.5s into
     * a clip when the duration is set.
     */
    public flagLoadTime(): void {
        this.clipStart = this.context.currentTime;
    }

    public flagStart(): void {
        if (this.stopped) {
            this.clipStart = this.context.currentTime;
            this.stopped = false;
        }

        if (!this.timerId) {
            // 100ms interval to make sure the time is as accurate as possible without being overly insane
            this.timerId = window.setInterval(this.checkTime, 100);
        }
    }

    public flagStop(): void {
        this.stopped = true;

        // Reset the clock time now so that the update going out will trigger components
        // to check their seek/position information (alongside the clock).
        this.clipStart = this.context.currentTime;
    }

    public syncTo(contextTime: number, clipTime: number): void {
        this.clipStart = contextTime - clipTime;
        this.stopped = false; // count as a mid-stream pause (if we were stopped)
        this.checkTime(true);
    }

    public destroy(): void {
        this.observable.close();
        if (this.timerId) clearInterval(this.timerId);
    }
}
