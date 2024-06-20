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
