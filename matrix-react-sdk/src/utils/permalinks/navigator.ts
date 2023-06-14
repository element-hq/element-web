/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { tryTransformPermalinkToLocalHref } from "./Permalinks";

/**
 * Converts a permalink to a local HREF and navigates accordingly. Throws if the permalink
 * cannot be transformed.
 * @param uri The permalink to navigate to.
 */
export function navigateToPermalink(uri: string): void {
    const localUri = tryTransformPermalinkToLocalHref(uri);
    if (!localUri || localUri === uri) {
        // parse failure can lead to an unmodified URL
        throw new Error("Failed to transform URI");
    }
    window.location.hash = localUri; // it'll just be a fragment
}
