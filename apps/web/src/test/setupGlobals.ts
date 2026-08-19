/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, beforeEach } from "vitest";
import { PredictableRandom } from "test-utils/predictableRandom.ts";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { mocks } from "../../test/setup/mocks.ts";
import SdkConfig, { DEFAULTS } from "../SdkConfig";

// Fake random strings to give a predictable snapshot for IDs
vi.mock("matrix-js-sdk/src/randomstring");
beforeEach(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const mockRandom = new PredictableRandom();
    // needless to say, the mock is not cryptographically secure
    vi.mocked(secureRandomString).mockImplementation((len) => {
        let ret = "";
        for (let i = 0; i < len; ++i) {
            const v = mockRandom.get() * chars.length;
            const m = ((v % chars.length) + chars.length) % chars.length; // account for negative modulo
            ret += chars.charAt(Math.floor(m));
        }
        return ret;
    });
});

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
