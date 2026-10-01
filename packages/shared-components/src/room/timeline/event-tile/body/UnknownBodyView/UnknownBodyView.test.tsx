/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import { UnknownBodyView } from "./UnknownBodyView";
import * as stories from "./UnknownBodyView.stories";

const { Default, Multiline } = composeStories(stories);

describe("UnknownBodyView", () => {
    it("renders the default story", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("Unsupported message body")).toBeInTheDocument();
    });

    it("renders multiline content", () => {
        const { container } = render(<Multiline />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText(/with preserved line breaks/)).toBeInTheDocument();
    });

    it("applies a custom className to the root element", () => {
        const { container } = render(<UnknownBodyView text="Unsupported message body" className="custom-unknown" />);

        expect(container.firstChild).toHaveClass("custom-unknown");
    });

    it("forwards the provided ref to the root element", () => {
        const ref = React.createRef<HTMLDivElement>();

        render(<UnknownBodyView text="Unsupported message body" ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLDivElement);
        expect(ref.current).toHaveTextContent("Unsupported message body");
    });
});
