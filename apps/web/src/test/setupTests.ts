/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, beforeEach, afterEach } from "vitest";
import fetchMock, { manageFetchMockGlobally } from "@fetch-mock/vitest";

import SdkConfig, { DEFAULTS } from "../SdkConfig";
import "./setupGlobals.ts";
import { setupLanguageMock } from "./setupLanguage.ts";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Ignore benign post-teardown exceptions as they cause flakes
const guardState = globalThis as unknown as { __vitestTestRunning?: boolean; __teardownGuardInstalled?: boolean };
if (!guardState.__teardownGuardInstalled) {
    guardState.__teardownGuardInstalled = true;
    const isPostTeardownStraggler = (): boolean => !guardState.__vitestTestRunning || typeof window === "undefined";
    process.on("uncaughtException", (err) => {
        if (isPostTeardownStraggler()) return;
        throw err;
    });
    process.on("unhandledRejection", (reason) => {
        if (isPostTeardownStraggler()) return;
        throw reason;
    });
}

manageFetchMockGlobally();

beforeEach(() => {
    guardState.__vitestTestRunning = true;

    vi.stubEnv("TZ", "UTC");

    // set up fetch API mock
    fetchMock.hardReset();
    fetchMock.catch(404);
    fetchMock.mockGlobal();

    setupLanguageMock();
});

afterEach(() => {
    guardState.__vitestTestRunning = false;
    return fetchMock.callHistory.flush();
});

// uninitialised SdkConfig causes lots of warnings in console, init with defaults
SdkConfig.put(DEFAULTS);
