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

import * as stories from "./MessageEventView.stories";

const { Default, WithCaption } = composeStories(stories);

describe("MessageEventView", () => {
    it("renders the default event body without a caption wrapper", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
    });

    it("renders the caption layout when the event has a caption", () => {
        const { container } = render(<WithCaption />);

        expect(container).toMatchSnapshot();
    });

    it("does not render the caption body when the snapshot marks the event as uncaptioned", () => {
        render(<Default />);

        expect(screen.getByTestId("message-event-primary-body")).toBeInTheDocument();
        expect(screen.queryByTestId("message-event-caption-body")).not.toBeInTheDocument();
    });
});
