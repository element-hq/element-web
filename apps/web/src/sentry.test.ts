/*
Copyright 2026 PrinceXDev <princepanchani890@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { captureException, captureMessage, init, rewriteFramesIntegration, setUser } from "@sentry/browser";
import type * as SentryModule from "@sentry/browser";

import { initSentry, sendSentryReport, setSentryUser } from "./sentry";
import SdkConfig from "./SdkConfig";
import { stubClient } from "test-utils";

vi.mock("@sentry/browser", () => ({
    init: vi.fn(),
    setUser: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
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

describe("sendSentryReport", () => {
    beforeEach(() => {
        const client = stubClient();
        // The crypto context isn't under test here
        vi.mocked(client.getCrypto).mockReturnValue(undefined);
        SdkConfig.put({ sentry: { dsn: "https://examplePublicKey@o0.ingest.sentry.io/0", environment: "test" } });
    });

    afterEach(() => {
        SdkConfig.reset();
        vi.clearAllMocks();
    });

    it("does nothing if Sentry is not configured", async () => {
        SdkConfig.reset();

        await sendSentryReport("it broke", "https://github.com/element-hq/element-web/issues/1", new Error("oops"));

        expect(captureException).not.toHaveBeenCalled();
        expect(captureMessage).not.toHaveBeenCalled();
    });

    it("captures the error with the user's report attached", async () => {
        const error = new Error("oops");

        await sendSentryReport("it broke", "https://github.com/element-hq/element-web/issues/1", error);

        expect(captureException).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                extra: { user_text: "it broke", issue_url: "https://github.com/element-hq/element-web/issues/1" },
            }),
        );
        expect(captureMessage).not.toHaveBeenCalled();
    });

    it("captures a message for the issue if there is no error", async () => {
        await sendSentryReport("it broke", "https://github.com/element-hq/element-web/issues/1");

        expect(captureMessage).toHaveBeenCalledWith(
            "Issue: https://github.com/element-hq/element-web/issues/1",
            expect.objectContaining({ extra: expect.objectContaining({ user_text: "it broke" }) }),
        );
        expect(captureException).not.toHaveBeenCalled();
    });

    it("sends nothing if there is neither an error nor an issue", async () => {
        await sendSentryReport("it broke", "");

        expect(captureException).not.toHaveBeenCalled();
        expect(captureMessage).not.toHaveBeenCalled();
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
