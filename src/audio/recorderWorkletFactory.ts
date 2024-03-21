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

import mxRecorderWorkletPath from "./RecorderWorklet";

export default function recorderWorkletFactory(context: AudioContext): Promise<void> {
    // In future we should be using the built-in worklet support in Webpack 5 with the syntax
    // described in https://github.com/webpack/webpack.js.org/issues/6869:
    // addModule(/* webpackChunkName: "recorder.worklet" */ new URL("./RecorderWorklet.ts", import.meta.url));
    return context.audioWorklet.addModule(mxRecorderWorkletPath);
}
