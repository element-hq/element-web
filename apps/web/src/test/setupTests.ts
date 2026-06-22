/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, vi } from "vitest";
import fetchMock, { manageFetchMockGlobally } from "@fetch-mock/vitest";

import "./setupGlobals.ts";
import { setupLanguageMock } from "./setupLanguage.ts";

manageFetchMockGlobally();

beforeEach(() => {
    vi.stubEnv("TZ", "UTC");

    // set up fetch API mock
    fetchMock.hardReset();
    fetchMock.catch(404);
    fetchMock.mockGlobal();

    setupLanguageMock();
});
