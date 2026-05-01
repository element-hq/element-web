/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import React from "react";
import { render, screen } from "@test-utils";
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
    it("can open the menu and select an option", async () => {
        const onUploadOptionSelected = fn();
        const { container, getByRole } = render(<Default onUploadOptionSelected={onUploadOptionSelected} />);
        await userEvent.click(getByRole("button", { name: "Open attachment menu" }));
        expect(container).toMatchSnapshot();
        await userEvent.click(screen.getByRole("menuitem", { name: "Fun Button" }));
        expect(onUploadOptionSelected).toHaveBeenCalledWith("fun");
    });
    it("can ctrl click to get the first option", async () => {
        userEvent.setup();
        const onUploadOptionSelected = fn();
        const { getByRole } = render(<Default onUploadOptionSelected={onUploadOptionSelected} />);
        await userEvent.keyboard("[ControlLeft>]");
        await userEvent.click(getByRole("button", { name: "Open attachment menu" }));
        expect(onUploadOptionSelected).toHaveBeenCalledWith("local");
    });
});
