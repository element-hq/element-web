/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@test-utils";

import * as stories from "./StatusTextView.stories";

const { Default } = composeStories(stories);

describe("StatusTextView", () => {
    it("should display the status text and emoji", () => {
        render(<Default />);
        expect(screen.getByText("Flamboyant")).toBeInTheDocument();
        expect(screen.getByText("🦩")).toBeInTheDocument();
    });
});
