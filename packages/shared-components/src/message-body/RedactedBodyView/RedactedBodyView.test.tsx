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
import { describe, expect, it } from "vitest";

import { MockViewModel } from "../../viewmodel";
import { RedactedBodyView, type RedactedBodyViewModel, type RedactedBodyViewSnapshot } from "./RedactedBodyView";
import * as stories from "./RedactedBodyView.stories";

const { Default, SelfRedaction } = composeStories(stories);

describe("RedactedBodyView", () => {
    it("renders the default redacted body", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
    });

    it("renders without a tooltip when none is provided", () => {
        const { container } = render(<SelfRedaction />);

        expect(container).toMatchSnapshot();
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("shows the tooltip on hover when tooltip text exists", async () => {
        const user = userEvent.setup();
        const vm = new MockViewModel<RedactedBodyViewSnapshot>({
            text: "Message deleted by Alice",
            tooltip: "This message was deleted on Thu, 17 Nov 2022, 4:58:32 pm",
        }) as RedactedBodyViewModel;

        render(<RedactedBodyView vm={vm} />);

        await user.hover(screen.getByText("Message deleted by Alice"));

        expect(await screen.findByRole("tooltip")).toHaveTextContent(
            "This message was deleted on Thu, 17 Nov 2022, 4:58:32 pm",
        );
    });

    it("applies a custom className to the root span", () => {
        const vm = new MockViewModel<RedactedBodyViewSnapshot>({
            text: "Message deleted",
        }) as RedactedBodyViewModel;

        const { container } = render(<RedactedBodyView vm={vm} className="custom-redacted another-class" />);

        expect(container.firstChild).toHaveClass("custom-redacted", "another-class");
    });

    it("forwards the provided ref to the root span", () => {
        const ref = React.createRef<HTMLSpanElement>();
        const vm = new MockViewModel<RedactedBodyViewSnapshot>({
            text: "Message deleted",
        }) as RedactedBodyViewModel;

        render(<RedactedBodyView vm={vm} ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLSpanElement);
        expect(ref.current).toHaveTextContent("Message deleted");
    });
});
