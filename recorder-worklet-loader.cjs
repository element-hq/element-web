/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Inspired by https://github.com/reklawnos/worklet-loader which doesn't
// formally support Webpack 5

const SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");

module.exports = function () {};

module.exports.pitch = function pitch(request) {
    const cb = this.async();
    const filename = "recorder.worklet.js";

    const compiler = this._compilation.createChildCompiler("worker", {
        filename,
        chunkFilename: `[id].${filename}`,
        namedChunkFilename: null,
    });

    new SingleEntryPlugin(this.context, `!!${request}`, "main").apply(compiler);

    compiler.runAsChild((err, entries, compilation) => {
        if (err) {
            return cb(err);
        }
        if (entries[0]) {
            return cb(null, `module.exports = __webpack_public_path__ + ${JSON.stringify([...entries[0].files][0])};`);
        }
        return cb(null, null);
    });
};
