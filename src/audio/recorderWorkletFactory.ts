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

// This import is needed for dead code analysis but not actually used because the
// built-in worker / worklet handling in Webpack 5 only supports static paths
// @ts-ignore no-unused-locals
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import mxRecorderWorkletPath from "./RecorderWorklet";

export default function recorderWorkletFactory(context: AudioContext): Promise<void> {
    // The context.audioWorklet.addModule syntax is required for Webpack 5 to correctly recognise
    // this as a worklet rather than an asset. This also requires the parser.javascript.worker
    // configuration described in https://github.com/webpack/webpack.js.org/issues/6869.
    return context.audioWorklet.addModule(new URL("./RecorderWorklet.ts", import.meta.url));
}
