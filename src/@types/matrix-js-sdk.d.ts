/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { BLURHASH_FIELD } from "../utils/image-media";

// Matrix JS SDK extensions
declare module "matrix-js-sdk" {
    export interface FileInfo {
        /**
         * @see https://github.com/matrix-org/matrix-spec-proposals/pull/2448
         */
        [BLURHASH_FIELD]?: string;
    }
}
