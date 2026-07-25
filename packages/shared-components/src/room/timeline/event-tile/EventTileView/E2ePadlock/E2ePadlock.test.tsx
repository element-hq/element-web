/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { render, screen } from "@test-utils";

import { E2ePadlock, E2ePadlockIcon } from "./E2ePadlock";
import * as stories from "./E2ePadlock.stories";

const { Normal, Warning, DecryptionFailure } = composeStories(stories);

describe("E2ePadlock", () => {
    it("renders a 'Normal' icon", () => {
        const { container } = render(<Normal />);

        expect(container).toMatchSnapshot();
    });

    it("renders a 'Warning' icon", () => {
        const { container } = render(<Warning />);

        expect(container).toMatchSnapshot();
    });

    it("renders a 'DecryptionFailure' icon", () => {
        const { container } = render(<DecryptionFailure />);

        expect(container).toMatchSnapshot();
    });

    it("applies a custom className to the icon container", () => {
        render(<E2ePadlock icon={E2ePadlockIcon.Normal} title="Test tooltip" className="custom-e2e-padlock" />);

        expect(screen.getByTestId("e2e-padlock")).toHaveClass("custom-e2e-padlock");
    });
});
