/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

declare module "opus-recorder/dist/recorder.min.js" {
    export default class Recorder {
        public static isRecordingSupported(): boolean;

        public constructor(config: {
            bufferLength?: number;
            encoderApplication?: number;
            encoderFrameSize?: number;
            encoderPath?: string;
            encoderSampleRate?: number;
            encoderBitRate?: number;
            maxFramesPerPage?: number;
            mediaTrackConstraints?: boolean;
            monitorGain?: number;
            numberOfChannels?: number;
            recordingGain?: number;
            resampleQuality?: number;
            streamPages?: boolean;
            wavBitDepth?: number;
            sourceNode?: MediaStreamAudioSourceNode;
            encoderComplexity?: number;
        });

        public ondataavailable?(data: ArrayBuffer): void;

        public readonly encodedSamplePosition: number;

        public start(): Promise<void>;

        public stop(): Promise<void>;

        public close(): void;
    }
}

declare module "opus-recorder/dist/encoderWorker.min.js" {
    const path: string;
    export default path;
}

declare module "opus-recorder/dist/waveWorker.min.js" {
    const path: string;
    export default path;
}

declare module "opus-recorder/dist/decoderWorker.min.js" {
    const path: string;
    export default path;
}
