/*
Copyright 2026 PrinceXDev <princepanchani890@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, afterEach, vi } from "vitest";
import type * as SentryModule from "@sentry/browser";

import { initSentry, setSentryUser } from "./sentry";
import SdkConfig from "./SdkConfig";

vi.mock("@sentry/browser", () => ({
    init: vi.fn(),
    setUser: vi.fn(),
    eventFiltersIntegration: vi.fn().mockReturnValue({ name: "EventFilters" }),
    functionToStringIntegration: vi.fn().mockReturnValue({ name: "FunctionToString" }),
    breadcrumbsIntegration: vi.fn().mockReturnValue({ name: "Breadcrumbs" }),
    httpContextIntegration: vi.fn().mockReturnValue({ name: "HttpContext" }),
    dedupeIntegration: vi.fn().mockReturnValue({ name: "Dedupe" }),
    rewriteFramesIntegration: vi.fn().mockReturnValue({ name: "RewriteFrames" }),
}));

describe("initSentry", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("does nothing if no sentry config is given", async () => {
        await initSentry(undefined);
        expect(init).not.toHaveBeenCalled();
    });

    it("normalizes Element Desktop's vector:// stack frames so they group with Element Web", async () => {
        await initSentry({
            dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
            environment: "test",
        });

        expect(rewriteFramesIntegration).toHaveBeenCalledWith({
            root: "vector://vector/webapp",
            prefix: "app://",
        });

        const { integrations } = vi.mocked(init).mock.calls[0][0]!;
        expect(integrations).toEqual(expect.arrayContaining([{ name: "RewriteFrames" }]));
    });
});

describe("setSentryUser", () => {
    afterEach(() => {
        SdkConfig.reset();
        vi.clearAllMocks();
    });

    it("sets the user once Sentry has loaded, if Sentry is configured", async () => {
        SdkConfig.put({ sentry: { dsn: "https://examplePublicKey@o0.ingest.sentry.io/0", environment: "test" } });

        setSentryUser("@alice:example.org");

        await vi.waitFor(() => expect(setUser).toHaveBeenCalledWith({ username: "@alice:example.org" }));
    });

    it("does nothing if Sentry is not configured", async () => {
        setSentryUser("@alice:example.org");
        await vi.dynamicImportSettled();

        expect(setUser).not.toHaveBeenCalled();
    });
});

describe("rewriteFramesIntegration output", () => {
    // Uses the real Sentry SDK integration (not the mock above) to verify the actual rewritten
    // path, since it's easy to get the exact prefix/slash count wrong (e.g. `app:///` here would
    // double up with the leading slash already present in the frame, producing `app:////...`).
    // Relies on this test file's happy-dom environment providing a real `window`, which is what makes
    // the SDK's browser root/prefix substitution apply in the first place.
    it("rewrites a vector:// frame to a clean app:/// path", async () => {
        const RealSentry = await vi.importActual<typeof SentryModule>("@sentry/browser");

        const integration = RealSentry.rewriteFramesIntegration({
            root: "vector://vector/webapp",
            prefix: "app://",
        });

        const event: any = {
            exception: {
                values: [
                    {
                        stacktrace: {
                            frames: [
                                {
                                    filename: "vector://vector/webapp/bundles/abc123/bundle.js",
                                },
                            ],
                        },
                    },
                ],
            },
        };

        const processed = integration.processEvent!(event, {}, {} as any) as any;
        expect(processed.exception.values[0].stacktrace.frames[0].filename).toBe("app:///bundles/abc123/bundle.js");
    });
});
