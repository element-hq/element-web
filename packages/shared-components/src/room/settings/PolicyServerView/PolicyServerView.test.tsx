/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, afterEach, expect } from "vitest";

import * as stories from "./PolicyServerView.stories";
import { PolicyServerView } from "./PolicyServerView";
import { MockViewModel } from "../../../core/viewmodel/MockViewModel";
import { type PolicyServerViewActions, type PolicyServerViewSnapshot } from "./types";

const { Default, Configured, LegacyConfig, LookupFailed, Busy, ReadOnly } = composeStories(stories);

describe("PolicyServerView", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Storybook snapshots", () => {
        it("renders the unconfigured state", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders the configured state with a support page", () => {
            const { container } = render(<Configured />);
            expect(container).toMatchSnapshot();
        });

        it("renders the legacy configuration state", () => {
            const { container } = render(<LegacyConfig />);
            expect(container).toMatchSnapshot();
        });

        it("renders the lookup failure state", () => {
            const { container } = render(<LookupFailed />);
            expect(container).toMatchSnapshot();
        });

        it("renders the busy state", () => {
            const { container } = render(<Busy />);
            expect(container).toMatchSnapshot();
        });

        it("renders the read-only state", () => {
            const { container } = render(<ReadOnly />);
            expect(container).toMatchSnapshot();
        });
    });

    describe("User interactions", () => {
        const setServerName = vi.fn();
        const apply = vi.fn();

        class TestViewModel extends MockViewModel<PolicyServerViewSnapshot> implements PolicyServerViewActions {
            public setServerName = setServerName;
            public apply = apply;
        }

        const snapshot: PolicyServerViewSnapshot = {
            serverName: "",
            currentServerName: "",
            isLegacyConfig: false,
            canChange: true,
            canApply: true,
            busy: false,
            error: null,
            supportUrl: null,
        };

        it("forwards typed input to the view model", async () => {
            const user = userEvent.setup();
            render(<PolicyServerView vm={new TestViewModel(snapshot)} />);

            await user.type(screen.getByRole("textbox", { name: "Policy server name" }), "p");
            expect(setServerName).toHaveBeenCalledWith("p");
        });

        it("applies the entered value when the form is submitted", async () => {
            const user = userEvent.setup();
            render(<PolicyServerView vm={new TestViewModel(snapshot)} />);

            await user.click(screen.getByRole("button", { name: "Apply" }));
            expect(apply).toHaveBeenCalledTimes(1);
        });

        it("does not allow applying when the view model says so", () => {
            render(<PolicyServerView vm={new TestViewModel({ ...snapshot, canApply: false })} />);

            expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
        });

        it("disables the input when the user may not change the policy server", () => {
            render(<PolicyServerView vm={new TestViewModel({ ...snapshot, canChange: false, canApply: false })} />);

            expect(screen.getByRole("textbox", { name: "Policy server name" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
        });

        it("disables the input while busy", () => {
            render(<PolicyServerView vm={new TestViewModel({ ...snapshot, busy: true, canApply: false })} />);

            expect(screen.getByRole("textbox", { name: "Policy server name" })).toBeDisabled();
            expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
        });

        it("shows an error when the lookup failed", () => {
            render(<PolicyServerView vm={new TestViewModel({ ...snapshot, error: "lookup_failed" })} />);

            expect(screen.getByText(/Could not find a policy server/)).toBeInTheDocument();
        });

        it("links to the support page advertised by the current policy server", () => {
            render(
                <PolicyServerView
                    vm={
                        new TestViewModel({
                            ...snapshot,
                            serverName: "policy.example.org",
                            currentServerName: "policy.example.org",
                            canApply: false,
                            supportUrl: "https://policy.example.org/support",
                        })
                    }
                />,
            );

            expect(screen.getByRole("link", { name: "policy server's support page" })).toHaveAttribute(
                "href",
                "https://policy.example.org/support",
            );
        });
    });
});
