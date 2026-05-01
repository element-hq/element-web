/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import React from "react";
import { render } from "@test-utils";
import { describe, it, expect } from "vitest";
import { composeStories } from "@storybook/react-vite";
import { userEvent } from "vitest/browser";
import { fn } from "storybook/test";

import * as stories from "./UploadButton.stories.tsx";

const { Default } = composeStories(stories);

describe("UploadButton", () => {
    it("renders a default button", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
});
