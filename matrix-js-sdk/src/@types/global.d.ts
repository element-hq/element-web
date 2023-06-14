/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

// this is needed to tell TS about global.Olm
import "@matrix-org/olm";

export {};

declare global {
    // use `number` as the return type in all cases for global.set{Interval,Timeout},
    // so we don't accidentally use the methods on NodeJS.Timeout - they only exist in a subset of environments.
    // The overload for clear{Interval,Timeout} is resolved as expected.
    // We use `ReturnType<typeof setTimeout>` in the code to be agnostic of if this definition gets loaded.
    function setInterval(handler: TimerHandler, timeout: number, ...arguments: any[]): number;
    function setTimeout(handler: TimerHandler, timeout: number, ...arguments: any[]): number;

    namespace NodeJS {
        interface Global {
            localStorage: Storage;
            // marker variable used to detect both the browser & node entrypoints being used at once
            __js_sdk_entrypoint: unknown;
        }
    }

    interface Window {
        webkitAudioContext: typeof AudioContext;
    }

    interface Crypto {
        webkitSubtle?: Window["crypto"]["subtle"];
    }

    interface MediaDevices {
        // This is experimental and types don't know about it yet
        // https://github.com/microsoft/TypeScript/issues/33232
        getDisplayMedia(constraints: MediaStreamConstraints | DesktopCapturerConstraints): Promise<MediaStream>;
        getUserMedia(constraints: MediaStreamConstraints | DesktopCapturerConstraints): Promise<MediaStream>;
    }

    interface DesktopCapturerConstraints {
        audio:
            | boolean
            | {
                  mandatory: {
                      chromeMediaSource: string;
                      chromeMediaSourceId: string;
                  };
              };
        video:
            | boolean
            | {
                  mandatory: {
                      chromeMediaSource: string;
                      chromeMediaSourceId: string;
                  };
              };
    }

    interface DummyInterfaceWeShouldntBeUsingThis {}

    interface Navigator {
        // We check for the webkit-prefixed getUserMedia to detect if we're
        // on webkit: we should check if we still need to do this
        webkitGetUserMedia: DummyInterfaceWeShouldntBeUsingThis;
    }

    export interface ISettledFulfilled<T> {
        status: "fulfilled";
        value: T;
    }
    export interface ISettledRejected {
        status: "rejected";
        reason: any;
    }

    interface PromiseConstructor {
        allSettled<T>(promises: Promise<T>[]): Promise<Array<ISettledFulfilled<T> | ISettledRejected>>;
    }

    interface RTCRtpTransceiver {
        // This has been removed from TS
        // (https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1029),
        // but we still need this for MatrixCall::getRidOfRTXCodecs()
        setCodecPreferences(codecs: RTCRtpCodecCapability[]): void;
    }
}
