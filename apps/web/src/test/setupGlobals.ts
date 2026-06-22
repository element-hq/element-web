/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi } from "vitest";

import { mocks } from "../../test/setup/mocks.ts";
import SdkConfig, { DEFAULTS } from "../SdkConfig";

// set up AudioContext API mock
vi.stubGlobal("AudioContext", function () {
    return mocks.AudioContext;
});

if (globalThis.window === undefined) {
    // We are in a node environment, stub a basic window so singletons work
    vi.stubGlobal("window", {});
}

// uninitialised SdkConfig causes lots of warnings in console, init with defaults
SdkConfig.put(DEFAULTS);
