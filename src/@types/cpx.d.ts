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

declare module "cpx" {
    export class Cpx {
        public constructor(source: string, outDir: string, options?: object);

        public on(eventName: "copy", fn: (event: { srcPath: string; dstPath: string }) => void): void;
        public on(eventName: "remove", fn: (event: { path: string }) => void): void;
        public on(eventName: "watch-ready", fn: () => void): void;
        public on(eventName: "watch-error", fn: (error: Error) => void): void;

        /**
         * Copy all files that matches `this.source` pattern to `this.outDir`.
         *
         * @param {function} [cb = null] - A callback function.
         * @returns {void}
         */
        public copy(cb: Function | null): void;

        /**
         * Copy all files that matches `this.source` pattern to `this.outDir`.
         * And watch changes in `this.base`, and copy only the file every time.
         *
         * @returns {void}
         * @throws {Error} This had been watching already.
         */
        public watch(): void;
    }
}
