/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { logger } from "matrix-js-sdk/src/logger";

import { createAudioContext } from "./compat";

const formatMap = {
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
};

export class BackgroundAudio {
    private audioContext = createAudioContext();
    private sounds: Record<string, AudioBuffer> = {};

    public async pickFormatAndPlay<F extends Array<keyof typeof formatMap>>(
        urlPrefix: string,
        formats: F,
        loop = false,
    ): Promise<AudioBufferSourceNode> {
        const format = this.pickFormat(...formats);
        if (!format) {
            console.log("Browser doesn't support any of the formats", formats);
            // Will probably never happen. If happened, format="" and will fail to load audio. Who cares...
        }

        return this.play(`${urlPrefix}.${format}`, loop);
    }

    public async play(url: string, loop = false): Promise<AudioBufferSourceNode> {
        if (!this.sounds.hasOwnProperty(url)) {
            // No cache, fetch it
            const response = await fetch(url);
            if (response.status != 200) {
                logger.warn("Failed to fetch error audio");
            }
            const buffer = await response.arrayBuffer();
            const sound = await this.audioContext.decodeAudioData(buffer);
            this.sounds[url] = sound;
        }
        const source = this.audioContext.createBufferSource();
        source.buffer = this.sounds[url];
        source.loop = loop;
        source.connect(this.audioContext.destination);
        source.start();
        return source;
    }

    private pickFormat<F extends Array<keyof typeof formatMap>>(...formats: F): F[number] | null {
        // Detect supported formats
        const audioElement = document.createElement("audio");

        for (const format of formats) {
            if (audioElement.canPlayType(formatMap[format])) {
                return format;
            }
        }
        return null;
    }
}
