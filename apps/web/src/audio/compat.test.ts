/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";

import { createAudioContext } from "./compat";

describe("createAudioContext", () => {
    it("should throw if AudioContext is not supported", () => {
        window.AudioContext = undefined as any;
        expect(createAudioContext).toThrow("Unsupported browser");
    });
});
