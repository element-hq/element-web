/*
 Copyright 2025 New Vector Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React from "react";
import { describe, it, expect } from "vitest";

import * as stories from "./EventContentBody.stories";

const { PlainText, BigEmoji, HtmlContent, CodeBlock, AsSpan, WithHighlight } = composeStories(stories);

describe("EventContentBodyView", () => {
    it("renders plain text correctly", () => {
        const { container } = render(<PlainText />);
        expect(container).toMatchSnapshot();
    });

    it("renders big emoji correctly", () => {
        const { container } = render(<BigEmoji />);
        expect(container).toMatchSnapshot();
    });

    it("renders HTML content correctly", () => {
        const { container } = render(<HtmlContent />);
        expect(container).toMatchSnapshot();
    });

    it("renders code block correctly", () => {
        const { container } = render(<CodeBlock />);
        expect(container).toMatchSnapshot();
    });

    it("renders as span when specified", () => {
        const { container } = render(<AsSpan />);
        expect(container).toMatchSnapshot();
        expect(container.querySelector("span")).toBeInTheDocument();
    });

    it("renders highlighted content correctly", () => {
        const { container } = render(<WithHighlight />);
        expect(container).toMatchSnapshot();
    });

    it("displays expected text content", () => {
        render(<PlainText />);
        expect(screen.getByText("Hello, this is a plain text message.")).toBeInTheDocument();
    });
});
