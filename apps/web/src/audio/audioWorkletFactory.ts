/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Files with tests cannot import these paths directly, as "AudioWorkletProcessor" will
// be missing and the tests will fail. This implementation keeps the loader dynamic and
// prevents this issue from occurring.

import mxRecorderWorkletPath from "./RecorderWorklet";
import audiofoxWorkletPath from "./AudiofoxWorklet";

const loadableWorklets = {
    recorder: mxRecorderWorkletPath,
    audiofox: audiofoxWorkletPath,
};

type LoadableWorklet = keyof typeof loadableWorklets;

export default function audioWorkletFactory<W extends LoadableWorklet>(
    context: AudioContext,
    worklet: W,
): Promise<void> {
    // In future we should be using the built-in worklet support in Webpack 5 with the syntax
    // described in https://github.com/webpack/webpack.js.org/issues/6869:
    // addModule(/* webpackChunkName: "recorder.worklet" */ new URL("./RecorderWorklet.ts", import.meta.url));
    return context.audioWorklet.addModule(loadableWorklets[worklet]);
}
