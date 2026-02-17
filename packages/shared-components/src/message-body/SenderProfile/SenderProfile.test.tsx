/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import React from "react";
import { render, screen } from "@test-utils";
import { describe, expect, it } from "vitest";

import * as stories from "./SenderProfile.stories";

const { Default, Hidden, WithDisambiguation } = composeStories(stories);

describe("SenderProfileView", () => {
    it("renders default sender profile", () => {
        render(<Default />);
        expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    it("does not render when hidden", () => {
        render(<Hidden />);
        expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });

    it("renders disambiguated identifier", () => {
        render(<WithDisambiguation />);
        expect(screen.getByText("@alice:example.org")).toBeInTheDocument();
    });
});
