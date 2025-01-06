/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
