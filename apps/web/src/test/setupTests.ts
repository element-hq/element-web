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
const isBenignTeardownArtifact = (err: unknown): boolean => {
    // During any running test `window` is defined by happy-dom, or node-env stub from setupGlobals.
    // Only undefined once happy-dom has torn the environment down.
    if (typeof window === "undefined") return true;
    const name = (err as { name?: string } | null)?.name;
    const message = err instanceof Error ? err.message : String(err);
    if (name === "EnvironmentTeardownError" || message.includes("Closing rpc while")) return true;
    return /\b(?:window|document|navigator|self) is not defined\b/.test(message);
};

process.on("uncaughtException", (err) => {
    if (isBenignTeardownArtifact(err)) return;
    throw err;
});
process.on("unhandledRejection", (reason) => {
    if (isBenignTeardownArtifact(reason)) return;
    throw reason;
});

manageFetchMockGlobally();

beforeEach(() => {
    vi.stubEnv("TZ", "UTC");

    // set up fetch API mock
    fetchMock.hardReset();
    fetchMock.catch(404);
    fetchMock.mockGlobal();

    setupLanguageMock();
});

afterEach(() => fetchMock.callHistory.flush());

// uninitialised SdkConfig causes lots of warnings in console, init with defaults
SdkConfig.put(DEFAULTS);
