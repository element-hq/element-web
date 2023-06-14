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

/* This file replaces rust-crypto/index.ts when the js-sdk is being built for browserify.
 *
 * It is a stub, so that we do not import the whole of the base64'ed wasm artifact into the browserify bundle.
 * It deliberately does nothing except raise an exception.
 */

import { IHttpOpts, MatrixHttpApi } from "../http-api";

export async function initRustCrypto(
    _http: MatrixHttpApi<IHttpOpts & { onlyData: true }>,
    _userId: string,
    _deviceId: string,
): Promise<Crypto> {
    throw new Error("Rust crypto is not supported under browserify.");
}
