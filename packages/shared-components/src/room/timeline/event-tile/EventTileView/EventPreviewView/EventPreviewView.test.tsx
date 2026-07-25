/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import { describe, expect, it } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel";
import { EventPreviewView, type EventPreviewViewModel, type EventPreviewViewSnapshot } from "./EventPreviewView";
import * as stories from "./EventPreviewView.stories";

const { Default, WithPrefix, Hidden } = composeStories(stories);

describe("EventPreviewView", () => {
    it("renders the default event preview", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
    });

    it("renders a prefixed event preview", () => {
        const { container } = render(<WithPrefix />);

        expect(container).toMatchSnapshot();
    });

    it("does not render when hidden", () => {
        render(<Hidden />);

        expect(screen.queryByText("A short text message preview")).not.toBeInTheDocument();
    });

    it("applies custom span props without using native title tooltips", () => {
        const vm = new MockViewModel<EventPreviewViewSnapshot>({
            isVisible: true,
            previewContent: "Preview text",
            previewTooltip: "Preview text",
        }) as EventPreviewViewModel;

        render(<EventPreviewView vm={vm} className="custom-preview" data-testid="event-preview" />);

        expect(screen.getByTestId("event-preview")).toHaveClass("mx_EventPreview", "custom-preview");
        expect(screen.getByTestId("event-preview")).not.toHaveAttribute("title");
    });
});
