/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// The app's single entry point to maplibre-gl, so the worker URL is always set before any map is created.
// oxlint bans value imports of maplibre-gl everywhere else; import this module instead.

// oxlint-disable-next-line no-restricted-imports -- this is the wrapper the rule points to
import { setWorkerUrl } from "maplibre-gl";

declare const __webpack_public_path__: string | undefined;
declare const __webpack_get_script_filename__: ((chunkId: string) => string) | undefined;

// maplibre v6 derives its worker URL from `import.meta.url`, which webpack rewrites to a file:// path that maplibre
// rejects, leaving maps blank. webpack.config.ts builds the worker as its own entry, `maplibre.worker`, in the hashed
// bundle directory; the public path is the webapp root, so ask webpack for the entry's full filename.
// Outside webpack (unit tests) neither global exists, and maplibre is mocked anyway.
if (typeof __webpack_public_path__ === "string" && typeof __webpack_get_script_filename__ === "function") {
    setWorkerUrl(__webpack_public_path__ + __webpack_get_script_filename__("maplibre.worker"));
}

// oxlint-disable-next-line no-restricted-imports -- this is the wrapper the rule points to
export * from "maplibre-gl";
