/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect } from "vitest";
import { render, type RenderResult } from "test-utils-rtl";
import React, { type ComponentProps } from "react";

import { LoginSplashView } from "./LoginSplashView";

describe("<LoginSplashView />", () => {
    function getComponent(props: Partial<ComponentProps<typeof LoginSplashView>> = {}): RenderResult {
        const defaultProps = {
            onLogoutClick: () => {},
            syncError: null,
        };
        return render(<LoginSplashView {...defaultProps} {...props} />);
    }

    it("Renders a spinner", () => {
        const rendered = getComponent();
        expect(rendered.getByTestId("spinner")).toBeInTheDocument();
        expect(rendered.asFragment()).toMatchSnapshot();
    });

    it("Renders an error message", () => {
        const rendered = getComponent({ syncError: new Error("boohoo") });
        expect(rendered.asFragment()).toMatchSnapshot();
    });

    it("Calls onLogoutClick", () => {
        const onLogoutClick = vi.fn();
        const rendered = getComponent({ onLogoutClick });
        expect(onLogoutClick).not.toHaveBeenCalled();
        rendered.getByRole("button", { name: "Logout" }).click();
        expect(onLogoutClick).toHaveBeenCalled();
    });
});
