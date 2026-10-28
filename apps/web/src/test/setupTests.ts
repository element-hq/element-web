/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import fetchMock from "@fetch-mock/vitest";
import { mockIntlDateTimeFormat } from "test-utils/date";

import SdkConfig, { DEFAULTS } from "../SdkConfig";
import "./setupGlobals.ts";
import { setupLanguageMock } from "./setupLanguage.ts";

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

// Utility to check for React errors during the tests
// Fails tests on errors like the following:
// In HTML, <div> cannot be a descendant of <p>.
// In HTML, <form> cannot be a descendant of <form>.
// In HTML, text nodes cannot be a child of <thead>.
// This will cause a hydration error.
// You provided a `checked` prop to a form field without an `onChange` handler.
let errors: any[] = [];
beforeEach(() => {
    errors = [];
    const originalError = console.error;
    vi.spyOn(console, "error").mockImplementation((...args) => {
        if (/validateDOMNesting|Hydration failed|hydration error|prop to a form field without an/i.test(args[0])) {
            errors.push(args[0]);
        }
        originalError.call(console, ...args);
    });
});
afterEach(() => {
    vi.mocked(console.error).mockRestore?.();
    if (errors.length > 0) {
        throw new Error("Test failed due to React hydration errors in the console.");
    }
});
