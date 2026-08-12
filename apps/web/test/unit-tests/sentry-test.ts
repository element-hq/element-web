/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as Sentry from "@sentry/browser";

import { initSentry } from "../../src/sentry";

jest.mock("@sentry/browser", () => ({
    init: jest.fn(),
    inboundFiltersIntegration: jest
        .fn()
        .mockReturnValue({ name: "InboundFilters" }),
    functionToStringIntegration: jest
        .fn()
        .mockReturnValue({ name: "FunctionToString" }),
    breadcrumbsIntegration: jest.fn().mockReturnValue({ name: "Breadcrumbs" }),
    httpContextIntegration: jest.fn().mockReturnValue({ name: "HttpContext" }),
    dedupeIntegration: jest.fn().mockReturnValue({ name: "Dedupe" }),
    rewriteFramesIntegration: jest
        .fn()
        .mockReturnValue({ name: "RewriteFrames" }),
}));

describe("initSentry", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("does nothing if no sentry config is given", async () => {
        await initSentry(undefined);
        expect(Sentry.init).not.toHaveBeenCalled();
    });

    it("normalizes Element Desktop's vector:// stack frames so they group with Element Web", async () => {
        await initSentry({
            dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
            environment: "test",
        });

        expect(Sentry.rewriteFramesIntegration).toHaveBeenCalledWith({
            root: "vector://vector/webapp",
            prefix: "app://",
        });

        const { integrations } = jest.mocked(Sentry.init).mock.calls[0][0]!;
        expect(integrations).toEqual(
            expect.arrayContaining([{ name: "RewriteFrames" }]),
        );
    });
});

describe("rewriteFramesIntegration output", () => {
    // Uses the real Sentry SDK integration (not the mock above) to verify the actual rewritten
    // path, since it's easy to get the exact prefix/slash count wrong (e.g. `app:///` here would
    // double up with the leading slash already present in the frame, producing `app:////...`).
    // Relies on this test file's jsdom environment providing a real `window`, which is what makes
    // the SDK's browser root/prefix substitution apply in the first place.
    it("rewrites a vector:// frame to a clean app:/// path", async () => {
        const RealSentry = jest.requireActual<typeof Sentry>("@sentry/browser");

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
                                    filename:
                                        "vector://vector/webapp/bundles/abc123/bundle.js",
                                },
                            ],
                        },
                    },
                ],
            },
        };

        const processed = integration.processEvent!(
            event,
            {},
            {} as any,
        ) as any;
        expect(
            processed.exception.values[0].stacktrace.frames[0].filename,
        ).toBe("app:///bundles/abc123/bundle.js");
    });
});
