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

import {SimpleObservable} from "matrix-widget-api";
import {IDestroyable} from "../utils/IDestroyable";

// Because keeping track of time is sufficiently complicated...
export class PlaybackClock implements IDestroyable {
    private clipStart = 0;
    private stopped = true;
    private lastCheck = 0;
    private observable = new SimpleObservable<number[]>();
    private timerId: number;
    private clipDuration = 0;

    public constructor(private context: AudioContext) {
    }

    public get durationSeconds(): number {
        return this.clipDuration;
    }

    public set durationSeconds(val: number) {
        this.clipDuration = val;
        this.observable.update([this.timeSeconds, this.clipDuration]);
    }

    public get timeSeconds(): number {
        return (this.context.currentTime - this.clipStart) % this.clipDuration;
    }

    public get liveData(): SimpleObservable<number[]> {
        return this.observable;
    }

    private checkTime = () => {
        const now = this.timeSeconds;
        if (this.lastCheck !== now) {
            this.observable.update([now, this.durationSeconds]);
            this.lastCheck = now;
        }
    };

    public flagStart() {
        if (this.stopped) {
            this.clipStart = this.context.currentTime;
            this.stopped = false;
        }

        if (!this.timerId) {
            // case to number because the types are wrong
            // 100ms interval to make sure the time is as accurate as possible
            this.timerId = <number><any>setInterval(this.checkTime, 100);
        }
    }

    public flagStop() {
        this.stopped = true;
    }

    public destroy() {
        this.observable.close();
        if (this.timerId) clearInterval(this.timerId);
    }
}
