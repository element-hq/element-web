/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { waitFor, renderHook } from "test-utils-rtl";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils/test-utils";

import { useUnstableFeatureSupport } from "./useUnstableFeatureSupport";
import { MatrixClientPeg } from "../MatrixClientPeg";

describe("useUnstableFeatureSupport", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
    });

    it("reports an advertised feature as supported", async () => {
        cli.doesServerSupportUnstableFeature = vi.fn().mockResolvedValue(true);
        const { result } = renderHook(() => useUnstableFeatureSupport("org.example.feature"));
        await waitFor(() => expect(result.current).toBe(true));
    });

    it("reports an unadvertised feature as unsupported", async () => {
        cli.doesServerSupportUnstableFeature = vi.fn().mockResolvedValue(false);
        const { result } = renderHook(() => useUnstableFeatureSupport("org.example.feature"));
        // Starts false and stays false.
        expect(result.current).toBe(false);
        await waitFor(() => expect(cli.doesServerSupportUnstableFeature).toHaveBeenCalled());
        expect(result.current).toBe(false);
    });

    it("treats an unreachable /versions as unsupported", async () => {
        cli.doesServerSupportUnstableFeature = vi.fn().mockRejectedValue(new Error("no versions for you"));
        const { result } = renderHook(() => useUnstableFeatureSupport("org.example.feature"));
        await waitFor(() => expect(cli.doesServerSupportUnstableFeature).toHaveBeenCalled());
        expect(result.current).toBe(false);
    });
});
