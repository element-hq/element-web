/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, afterEach, vi } from "vitest";
import fetchMock, { manageFetchMockGlobally } from "@fetch-mock/vitest";

import SdkConfig, { DEFAULTS } from "../SdkConfig";
import "./setupGlobals.ts";
import { setupLanguageMock } from "./setupLanguage.ts";

manageFetchMockGlobally();

// Mock this as some code assumes it exists (needs to be done at the top level as
// things try to access it before the beforeEach blocks run)
window.addEventListener = vi.fn();

beforeEach(() => {
    // set up fetch API mock
    fetchMock.hardReset();
    fetchMock.catch(404);
    fetchMock.mockGlobal();

    setupLanguageMock();
});

afterEach(() => fetchMock.callHistory.flush());

// uninitialised SdkConfig causes lots of warnings in console, init with defaults
SdkConfig.put(DEFAULTS);
