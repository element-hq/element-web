/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { mockPlatformPeg } from "test-utils";

import { PlatformApi } from "./PlatformApi";

describe("PlatformApi", () => {
    it("should return the pickle key from the platform", async () => {
        const mockPlatform = mockPlatformPeg();
        vi.spyOn(mockPlatform, "getPickleKey").mockResolvedValue("test-pickle-key");

        const api = new PlatformApi();
        await expect(api.getPickleKey("@alice:example.org", "DEVICE123")).resolves.toBe("test-pickle-key");
        expect(mockPlatform.getPickleKey).toHaveBeenCalledWith("@alice:example.org", "DEVICE123");
    });

    it("should return null if the platform has no pickle key stored", async () => {
        const mockPlatform = mockPlatformPeg();
        vi.spyOn(mockPlatform, "getPickleKey").mockResolvedValue(null);

        const api = new PlatformApi();
        await expect(api.getPickleKey("@alice:example.org", "DEVICE123")).resolves.toBeNull();
    });
});
