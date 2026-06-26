/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import React from "react";

import * as stories from "./MessageComposerUrlPreview.stories.tsx";

const { Default, WithImage } = composeStories(stories);

describe("MessageComposerUrlPreview", () => {
    it("renders a preview", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
    it("renders a preview with an image", () => {
        const { container } = render(<WithImage />);
        expect(container).toMatchSnapshot();
    });
});
