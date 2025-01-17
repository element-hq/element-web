/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import mxRecorderWorkletPath from "./RecorderWorklet";

export default function recorderWorkletFactory(context: AudioContext): Promise<void> {
    // In future we should be using the built-in worklet support in Webpack 5 with the syntax
    // described in https://github.com/webpack/webpack.js.org/issues/6869:
    // addModule(/* webpackChunkName: "recorder.worklet" */ new URL("./RecorderWorklet.ts", import.meta.url));
    return context.audioWorklet.addModule(mxRecorderWorkletPath);
}
