/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "test-utils-rtl";
import { logger } from "matrix-js-sdk/src/logger";

import ErrorBoundary from "./ErrorBoundary";
import { LegacyCryptoStoreError } from "../../../utils/LegacyCryptoStoreError.ts";
import defaultDispatcher from "../../../dispatcher/dispatcher";

/** Renders nothing but throws the given error, so that ErrorBoundary catches it. */
function Thrower({ error }: { error: Error }): never {
    throw error;
}

describe("<ErrorBoundary />", () => {
    beforeEach(() => {
        // React logs the caught error itself, and so does ErrorBoundary; keep the output readable.
        vi.spyOn(logger, "error").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders its children when nothing throws", () => {
        render(
            <ErrorBoundary>
                <span>all is well</span>
            </ErrorBoundary>,
        );
        expect(screen.getByText("all is well")).toBeInTheDocument();
    });

    it("renders the generic crash screen for an unremarkable error", () => {
        render(
            <ErrorBoundary>
                <Thrower error={new Error("boom")} />
            </ErrorBoundary>,
        );
        expect(screen.getByRole("heading", { name: "Something went wrong!" })).toBeInTheDocument();
    });

    describe("with a LegacyCryptoStoreError", () => {
        function renderLegacyError(): void {
            render(
                <ErrorBoundary>
                    <Thrower error={new LegacyCryptoStoreError()} />
                </ErrorBoundary>,
            );
        }

        it("explains that the session cannot be used", () => {
            renderLegacyError();

            expect(screen.getByRole("heading", { name: "This session cannot be used" })).toBeInTheDocument();
        });

        it("does not offer the generic crash affordances", () => {
            renderLegacyError();

            expect(screen.queryByRole("heading", { name: "Something went wrong!" })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Clear cache and reload" })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Submit debug logs" })).not.toBeInTheDocument();
        });

        it("signs the user out when the button is clicked", () => {
            const dispatch = vi.spyOn(defaultDispatcher, "dispatch");
            renderLegacyError();

            screen.getByRole("button", { name: "Sign out" }).click();

            expect(dispatch).toHaveBeenCalledWith({ action: "logout" });
        });
    });
});
