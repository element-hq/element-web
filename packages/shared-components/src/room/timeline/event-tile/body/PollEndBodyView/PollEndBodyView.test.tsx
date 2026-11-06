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

import { PollEndBodyView } from "./PollEndBodyView";
import * as stories from "./PollEndBodyView.stories";

const { Default, NoVotes } = composeStories(stories);

describe("PollEndBodyView", () => {
    it("renders the poll result summary", () => {
        const { container } = render(<Default />);

        expect(screen.getByText("The poll has ended. Top answer: yes")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders the summary for a poll with no votes", () => {
        render(<NoVotes />);

        expect(screen.getByText("The poll has ended. No votes were cast.")).toBeInTheDocument();
    });

    it("hides the icon from assistive technology", () => {
        const { container } = render(<PollEndBodyView text="The poll has ended. Top answer: yes" />);

        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("applies a custom className to the root element", () => {
        const { container } = render(<PollEndBodyView text="Poll ended" className="custom-class another-class" />);

        expect(container.firstChild).toHaveClass("custom-class", "another-class");
    });

    it("forwards the provided ref to the root element", () => {
        const ref = React.createRef<HTMLSpanElement>();

        render(<PollEndBodyView text="Poll ended" ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLSpanElement);
        expect(ref.current).toHaveTextContent("Poll ended");
    });
});
