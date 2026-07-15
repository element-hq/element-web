/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
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
    // We are in a node environment, stub a basic window so singletons work.
    // Also stub `location` as a bare global: some libraries (e.g. posthog toolbar) access
    // `location` directly rather than via `window.location`.
    const locationStub = new URL("test://test/test");
    vi.stubGlobal("location", locationStub);
    vi.stubGlobal("window", {
        // Mock this as some code assumes it exists (needs to be done at the top level as
        // things try to access it before the beforeEach blocks run)
        addEventListener: vi.fn<typeof window.addEventListener>(),
        location: locationStub,
        setTimeout: globalThis.setTimeout,
    });
}

// uninitialised SdkConfig causes lots of warnings in console, init with defaults
SdkConfig.put(DEFAULTS);
