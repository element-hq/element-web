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

// @ts-ignore - we know that this is not a module. We're looking for a path.
import decoderWasmPath from "opus-recorder/dist/decoderWorker.min.wasm";
import wavEncoderPath from "opus-recorder/dist/waveWorker.min.js";
import decoderPath from "opus-recorder/dist/decoderWorker.min.js";
import { logger } from "matrix-js-sdk/src/logger";

import { SAMPLE_RATE } from "./VoiceRecording";

export function createAudioContext(opts?: AudioContextOptions): AudioContext {
    if (window.AudioContext) {
        return new AudioContext(opts);
    } else if (window.webkitAudioContext) {
        // While the linter is correct that "a constructor name should not start with
        // a lowercase letter", it's also wrong to think that we have control over this.
        // eslint-disable-next-line new-cap
        return new window.webkitAudioContext(opts);
    } else {
        throw new Error("Unsupported browser");
    }
}

export function decodeOgg(audioBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    // Condensed version of decoder example, using a promise:
    // https://github.com/chris-rudmin/opus-recorder/blob/master/example/decoder.html
    return new Promise((resolve) => {
        // no reject because the workers don't seem to have a fail path
        logger.log("Decoder WASM path: " + decoderWasmPath); // so we use the variable (avoid tree shake)
        const typedArray = new Uint8Array(audioBuffer);
        const decoderWorker = new Worker(decoderPath);
        const wavWorker = new Worker(wavEncoderPath);

        decoderWorker.postMessage({
            command: "init",
            decoderSampleRate: SAMPLE_RATE,
            outputBufferSampleRate: SAMPLE_RATE,
        });

        wavWorker.postMessage({
            command: "init",
            wavBitDepth: 24, // standard for 48khz (SAMPLE_RATE)
            wavSampleRate: SAMPLE_RATE,
        });

        decoderWorker.onmessage = (ev) => {
            if (ev.data === null) {
                // null == done
                wavWorker.postMessage({ command: "done" });
                return;
            }

            wavWorker.postMessage(
                {
                    command: "encode",
                    buffers: ev.data,
                },
                ev.data.map((b: Float32Array) => b.buffer),
            );
        };

        wavWorker.onmessage = (ev) => {
            if (ev.data.message === "page") {
                // The encoding comes through as a single page
                resolve(new Blob([ev.data.page], { type: "audio/wav" }).arrayBuffer());
            }
        };

        decoderWorker.postMessage(
            {
                command: "decode",
                pages: typedArray,
            },
            [typedArray.buffer],
        );
    });
}
