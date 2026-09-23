/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import { describe, expect, it } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel";
import { HiddenBodyView, type HiddenBodyViewModel, type HiddenBodyViewSnapshot } from "./HiddenBodyView";
import * as stories from "./HiddenBodyView.stories";

const { Default, WithReason } = composeStories(stories);

describe("HiddenBodyView", () => {
    it("renders the default hidden body", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("Message pending moderation")).toBeInTheDocument();
    });

    it("renders a hidden body with a reason", () => {
        const { container } = render(<WithReason />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("Message pending moderation: spam")).toBeInTheDocument();
    });

    it("applies a custom className to the root span", () => {
        const vm = new MockViewModel<HiddenBodyViewSnapshot>({
            reason: undefined,
        }) as HiddenBodyViewModel;

        const { container } = render(<HiddenBodyView vm={vm} className="custom-hidden another-class" />);

        expect(container.firstChild).toHaveClass("custom-hidden", "another-class");
    });

    it("forwards the provided ref to the root span", () => {
        const ref = React.createRef<HTMLSpanElement>();
        const vm = new MockViewModel<HiddenBodyViewSnapshot>({
            reason: undefined,
        }) as HiddenBodyViewModel;

        render(<HiddenBodyView vm={vm} ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLSpanElement);
        expect(ref.current).toHaveTextContent("Message pending moderation");
    });
});
