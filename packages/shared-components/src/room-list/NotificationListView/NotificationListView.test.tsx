/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import { describe, it, expect } from "vitest";
import React from "react";

import * as stories from "./NotificationListView.stories";

const { Default, Empty } = composeStories(stories);

describe("NotificationListView", () => {
    it("calls onItemClick with the event id", async () => {
        render(<Default />);
        (await screen.findByRole("option", { name: /See you tomorrow/ })).click();
        expect(Default.args?.onItemClick).toHaveBeenCalledWith("$2");
    });

    it("renders the empty state", () => {
        render(<Empty />);
        expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    });
});
