/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, beforeEach } from "vitest";
import fetchMock, { manageFetchMockGlobally } from "@fetch-mock/vitest";

import { mocks } from "../../test/setup/mocks.ts";
import SdkConfig, { DEFAULTS } from "../SdkConfig";

manageFetchMockGlobally();

beforeEach(() => {
    // set up fetch API mock
    fetchMock.hardReset();
    fetchMock.catch(404);
    fetchMock.mockGlobal();
});

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
