/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import fetchMock from "@fetch-mock/vitest";

import SdkConfig, { DEFAULTS } from "../SdkConfig";
import "./setupGlobals.ts";
import { setupLanguageMock } from "./setupLanguage.ts";
import { mockIntlDateTimeFormat } from "./intlDateTimeFormatMock";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Captured before any test can install fake timers, so the drain in `afterEach` below always
// runs against a real immediate and cannot hang.
const realSetImmediate = globalThis.setImmediate;

// Deliberately *not* calling `manageFetchMockGlobally()` as it monkey-patches `vi.restoreAllMocks`,
// `vi.resetAllMocks` and `vi.unstubAllGlobals` such that they also tear the fetch mock down, putting the
// environment's real `fetch` back on the global.
// We re-set the mock before every test below, so the lifecycle integration buys us nothing.

beforeEach(() => {
    vi.stubEnv("TZ", "UTC");
    mockIntlDateTimeFormat();

    // set up fetch API mock. Unmatched requests 404 rather than reaching the network.
    fetchMock.hardReset();
    fetchMock.catch(404);
    fetchMock.mockGlobal();

    setupLanguageMock();
});

afterEach(async () => {
    await fetchMock.callHistory.flush();

    await act(async () => {
        await new Promise((resolve) => realSetImmediate(resolve));
    });
});

// uninitialised SdkConfig causes lots of warnings in console, init with defaults
SdkConfig.put(DEFAULTS);
